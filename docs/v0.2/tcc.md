# TCC splitting: benchmark record

Task 3 of the v0.2 plan changed `Overflow::Split` to cut Thai words at Thai Character Cluster ends.
This file records the criterion numbers before and after that change, and the optimization that followed.

## Method

Same method as docs/m0/benchmarks.md:68-73.
The "before" tree is `git archive HEAD` of the Task 2 commit (33e3f50), the "after" tree is a fresh copy of the working tree with the Task 3 change.
Each tree has its own `CARGO_TARGET_DIR`.
`cargo bench -p thaiwrap-core --bench wrap -- --noplot` ran 3 times per tree, alternating before and after, with no other load.
The table takes the middle value of criterion's `time:` interval for each run, then the median of the 3 runs.

Machine: Apple M1 Pro (`sysctl -n machdep.cpu.brand_string`).

## Results (after the optimization)

| bench | before | after | change |
| --- | --- | --- | --- |
| short | 1.94 us | 1.92 us | -1.0% |
| long | 565.28 us | 566.05 us | +0.1% |
| mixed | 119.07 us | 131.18 us | +10.2% |
| overflow_max4 | 766.22 us | 932.55 us | +21.7% |
| graphemes_long | 634.26 us | 636.92 us | +0.4% |

Runs (us, middle value):

- short: before 1.91, 1.97, 1.94; after 1.92, 1.96, 1.92
- long: before 565.28, 655.69, 560.00; after 566.05, 564.79, 567.23
- mixed: before 118.67, 119.07, 119.27; after 131.18, 132.94, 121.06
- overflow_max4: before 766.22, 774.89, 763.48; after 1015.50, 926.84, 932.55
- graphemes_long: before 634.61, 634.26, 633.03; after 669.00, 636.92, 634.30

`mixed` reads +10.2% in this table because two of its three "after" runs were slow outliers (131.18 and 132.94 us).
`mixed` never takes the overflow path.
Three more alternating runs of `mixed` only gave before 118.33, 117.89, 120.28 and after 119.72, 149.74, 119.22 (one outlier), which is +1.2% by median.

`overflow_max4` is still more than 5% slower: +21.7%.
The unoptimized Task 3 code gave 764.83 us -> 1844.20 us (+141.1%).

## Optimization

User decision: "Optimize first", at most 4 attempts, output must not change.

Profile of the new overflow path on `overflow_max4` (1200 words of at most 4 code units to cut, average 6.75 characters; criterion, scratch copy with the internals made public):

| step per run over the 1200 words | time |
| --- | --- |
| `tcc::cluster_ends` (unoptimized) | 931.5 us |
| grapheme boundaries + `thai::allowed` + collect into a Vec | 203.5 us |
| grapheme boundaries only | 47.4 us |
| code unit measure | 11.2 us |
| `segment::units` of the whole text (not part of the split path) | 579.7 us |

So `cluster_ends` is about 86% of the +1080 us.
The extra Vecs in `split_overflow` and the grapheme work are small.
A sampling profile (`sample`) put about 75% of `cluster_ends` in `match_rule` and `Class::has` and about 10% in malloc and free.

| attempt | change | `overflow_max4` |
| --- | --- | --- |
| 0 | Task 3 code as first written | 1844 us |
| 1 | `cluster_ends` skips rules whose first class rejects the character; `ends` Vec gets its capacity up front | 1547 us |
| 2 | `split_overflow` without the 3 intermediate Vecs: `cluster_ends` returns an iterator, merged on the fly with the grapheme boundaries; the grapheme fallback is computed only for a too-long cluster | 1520 us |
| 3 | character classes as bit sets (one AND per step instead of `Class::has`); a rule is skipped when one of its leading required steps does not match; no second Vec for byte lengths; the char vector is pre-sized (it was reallocating) | 1085 us |
| 4 | a consonant that no rule can extend is a one-character cluster without trying any rule (`is_lone_consonant`) | 925 us |

Measured and rejected: precomputing the first set of each of the 29 rules (`FIRST` table) after attempt 4.
It gave about 8% on `cluster_ends` (164 us to 152 us) for 12 more lines, so it was dropped.
The rule list and its order are unchanged; the new checks only skip a rule that cannot match, or answer for a consonant that no rule extends.

The remaining cost is the matcher itself: it runs for every cluster that is not a lone consonant (vowels, tone marks, leading vowels).
Reaching +5% needs `cluster_ends` for these 1200 words in about 40 us, against about 150 us now.

### Output identity

- `corpus/*/snapshot.txt` regenerated after each attempt: `cmp` with the copies taken before the optimization shows no difference.
- `tcc` unit tests, including both corpus fixtures from Task 1, pass.
- Differential test in a scratch copy (not committed), baseline `tcc.rs` as `tcc_old`: `cluster_ends` on all 1693 corpus lines and 60,000 random strings (Thai consonants, vowels, tone marks, ์, leading vowels, Latin, digits, emoji, space): 0 differences.
- The same scratch copy also compares `wrap` with the baseline `wrap.rs` on 160,000 random cases (40,000 strings, both measures, both overflow modes, max length 1 to 12): 0 differences.
- Negative control: changing the look-ahead of `is_lone_consonant` from 3 to 2 characters gives 11 corpus differences, so the test does fire.
- `cargo test --workspace --release --locked`: all green (properties 8, acceptance 1, matrix 56).

## Decision

The gate failed: `overflow_max4` is +21.7% (766.22 us to 932.55 us).
`mixed` also reads +10.2% in the table, but that is outlier noise (+1.2% by median in the re-run) and `mixed` never takes the overflow path.
That benchmark only runs for words longer than maxLength, and the cost is about 0.14 us per split word.
The user chose to accept it after one optimization pass (+141.1% down to +21.7%).
A harder matcher rewrite was estimated at +10-12% at best, so it was not done.
