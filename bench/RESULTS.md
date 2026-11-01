# Benchmark results: thaiwrap vs Thai wrapping/segmentation tools

Generated 2026-11-01 by the benchmark suite described in [Method](#method).
Numbers below are reproducible with the commands in [How to reproduce](#how-to-reproduce).
An interactive version with charts is on the site at `/benchmarks/comparison/` (built by `bench/scripts/build-site-page.mjs` from the same data).

## TL;DR

thaiwrap is the fastest JS option in all 9 configurations (3 sizes x 3 `maxLength` values) and the only tool, apart from the slow `Intl.Segmenter` reference wrap, with zero rule problems on the fixture set.
On the 50-page fixture at `maxLength` 40 it wraps at **12.3 ms / call (81 ops/s, 11.8M chars/s, 33.7 MB/s)**.
That is 1.9x faster than `Intl.Segmenter` + a simple greedy wrap, 4.6x faster than `thai-break words()` + the same wrap, 6.0x faster than `thai-break wrap()`, and ~33x faster than `wordcut` / `thai-wordcut-ts`.
The smallest lead over any other JS tool in any configuration is 1.9x.
At the Rust-core level thaiwrap-core (9.51 ms) is within 10% of raw ICU4X dictionary segmentation + the same wrap in every configuration (9% faster to 10% slower), so the Thai rule engine costs about nothing, and it is 2.3x to 3.1x faster than `wordcut-engine` (chamkho), `nlpo3`, `thaibreak` and `kham-core` plus the same wrap.
Cold start is 3.5 ms module load + 0.36 ms first call, versus 10-132 ms for the other tools (the wordcut family loads a dictionary on first use).
Peak memory is 107 MB RSS versus 158-230 MB for every competitor.
Every tool preserves the input text.
Only thaiwrap (and the slow Intl reference wrap) never break a Thai typography rule or the length limit.
The other tools break a rule on 0.1% to 0.6% of lines: lines that start with a tone mark, `ะ า ำ ๆ ฯ`, or end with a leading vowel, or lines longer than the limit (see [Quality](#quality)).
These problems are rare per line, so they only show up over a whole document.

## Environment

| | |
|---|---|
| Machine | Apple M1 Pro (MacBookPro18,3), 8 cores, 16 GB RAM, arm64 |
| OS | macOS 26.6.2 |
| Node | v22.19.0 (speed, cold start, memory, quality, bundle) |
| Bun | 1.4.4 (`bun test` only; upgraded from 1.3.5 during this work - see [Notes](#notes-and-exclusions)) |
| Rust | rustc 1.99.0, cargo 1.99.0, criterion 0.8.2 |
| Python (reference) | PyThaiNLP 5.4.0 (`newmm`), run via ephemeral `uv run --with pythainlp==5.4.0` |

The machine was **not idle** during the speed and memory runs: macOS system services (Storage Management extensions) used CPU and pushed the load average well above the core count for long periods.
This is why results report the median of 3 runs and the fastest-to-slowest range instead of a mean and standard deviation.
Ratios are stable across runs; single absolute numbers can move by 10-20% (and rarely 2x for one disturbed run).

Compared versions: thaiwrap 0.1.1 (local build of the published npm package), wordcut 0.9.1, thai-wordcut-ts 1.0.2, thai-break 1.5.0 (npm), icu_segmenter 2.4.0, wordcut-engine 1.2.2 (chamkho 1.5.0's engine), nlpo3 1.4.0, thaibreak 1.5.0 (crate, `embedded-dict`), kham-core 0.8.2.

## Method

### Fixtures

`bench/fixtures/wrapthai-test-50pages.txt` is a 50-page Thai test document: 414,790 bytes, 144,706 UTF-16 code units (144,676 code points - 30 astral characters, emoji), 622 lines, 421 non-empty paragraphs, 25 embedded ZWSP (U+200B) break hints around loanwords, 22 NBSP (U+00A0), Thai digits, English tokens, numbers and punctuation.
`small.txt` (3,319 UTF-16 units, ~1 page) and `medium.txt` (28,942 units, ~10 pages) are deterministic whole-line prefixes produced by `bench/scripts/make-fixtures.mjs`; the full file is the `large` size.

### Fairness

Segmentation-only tools are wrapped by one shared greedy wrapper, identical on both sides (`bench/lib/greedy.mjs` and `bench_compare::greedy_wrap`).
It splits paragraphs on `\n` and keeps blank lines as thaiwrap does.
It fills each line with as many word tokens as fit and never cuts a word.
A single space is kept between two words only where the input had whitespace between them; adjacent tokens are joined directly, because Thai has no spaces between words.
U+200B is removed from tokens, as thaiwrap does.
Length is counted in UTF-16 code units.
A word longer than `maxLength` stays whole on its own line, because the wrapper has no overflow strategy.
It has no rule for `ะ า ำ ๆ ฯ` or leading vowels; that is what the Quality table measures.
A no-break space is treated as a normal space by this wrapper (22 occurrences in the fixture).
`thai-break wrap()` is additionally measured through its own API; note it counts width in display columns (Thai combining marks are zero-width), so the same numeric `maxLength` is a weaker limit in real units.
All tool construction (dictionaries, tries, segmenters) happens once, outside measured loops; thaiwrap caches its ICU4X segmenter in a `OnceLock`, matching that setup.
The Rust-side thaiwrap-core numbers include allocating owned line `String`s, like the napi binding returns.

### Units

thaiwrap default measure is UTF-16 code units (JS `.length`), which is what every "u16" number below counts; "grapheme" counts grapheme clusters via `Intl.Segmenter` granularity `grapheme`.
The quality checker reports line lengths in both, plus `thai-break`'s display-width unit where relevant.

### Rounds and variance

JS speed: 3 rounds in fresh Node child processes (`node bench/index.mjs`).
Tables show the median of the 3 round means, then the fastest and slowest round in brackets.
Rust speed: 3 criterion baselines (`--save-baseline r1|r2|r3`, warm-up 500 ms, measurement 2 s, 50 samples).
Tables show the median of the 3 criterion median estimates, then the range.
Cold start: median of 15 fresh processes per tool.
Memory: single process per tool, 300 iterations over the large fixture at `maxLength` 40.

## Speed - JS layer (Node 22, lower ms is better)

### small

| tool | ml20 ms | ml40 ms | ml80 ms |
|---|---|---|---|
| thaiwrap (ours) | 0.272 (0.271 to 0.282; 3,671 ops/s) | 0.266 (0.254 to 0.271; 3,763 ops/s) | 0.248 (0.248 to 0.257; 4,025 ops/s) |
| Intl+Thai-rule ref wrap | 1.621 (1.604 to 1.905; 617 ops/s) | 1.581 (1.550 to 1.812; 632 ops/s) | 1.580 (1.564 to 1.602; 633 ops/s) |
| Intl.Segmenter+greedy | 0.506 (0.491 to 0.524; 1,977 ops/s) | 0.505 (0.471 to 0.522; 1,980 ops/s) | 0.496 (0.473 to 0.510; 2,017 ops/s) |
| wordcut+greedy | 9.277 (8.113 to 9.757; 108 ops/s) | 9.508 (8.103 to 10.421; 105 ops/s) | 9.103 (8.989 to 9.228; 110 ops/s) |
| thai-wordcut-ts+greedy | 8.675 (8.653 to 9.009; 115 ops/s) | 9.599 (8.499 to 9.769; 104 ops/s) | 8.800 (8.632 to 8.991; 114 ops/s) |
| thai-break words+greedy | 1.190 (1.131 to 1.191; 841 ops/s) | 1.172 (1.119 to 1.185; 854 ops/s) | 1.126 (1.112 to 1.202; 888 ops/s) |
| thai-break wrap() | 1.662 (1.628 to 1.668; 602 ops/s) | 1.603 (1.519 to 1.628; 624 ops/s) | 1.552 (1.530 to 1.663; 644 ops/s) |

### medium

| tool | ml20 ms | ml40 ms | ml80 ms |
|---|---|---|---|
| thaiwrap (ours) | 2.515 (2.413 to 2.536; 398 ops/s) | 2.341 (2.319 to 2.590; 427 ops/s) | 2.324 (2.283 to 2.474; 430 ops/s) |
| Intl+Thai-rule ref wrap | 14.074 (13.935 to 16.039; 71 ops/s) | 13.958 (13.824 to 15.239; 72 ops/s) | 13.871 (13.712 to 15.018; 72 ops/s) |
| Intl.Segmenter+greedy | 4.905 (4.568 to 4.955; 204 ops/s) | 4.486 (4.325 to 4.939; 223 ops/s) | 4.616 (4.300 to 5.032; 217 ops/s) |
| wordcut+greedy | 80.238 (73.556 to 82.494; 12 ops/s) | 83.028 (79.314 to 86.692; 12 ops/s) | 81.967 (81.594 to 85.102; 12 ops/s) |
| thai-wordcut-ts+greedy | 87.888 (79.584 to 96.278; 11 ops/s) | 79.266 (75.215 to 80.598; 13 ops/s) | 77.099 (73.036 to 80.589; 13 ops/s) |
| thai-break words+greedy | 10.044 (10.038 to 11.584; 100 ops/s) | 10.082 (9.890 to 11.046; 99 ops/s) | 10.032 (9.894 to 10.608; 100 ops/s) |
| thai-break wrap() | 15.410 (14.863 to 16.422; 65 ops/s) | 14.095 (14.000 to 15.293; 71 ops/s) | 13.907 (13.694 to 14.490; 72 ops/s) |

### large

| tool | ml20 ms | ml40 ms | ml80 ms |
|---|---|---|---|
| thaiwrap (ours) | 12.339 (12.287 to 13.235; 81 ops/s) | 12.291 (11.661 to 12.924; 81 ops/s) | 11.496 (11.484 to 11.518; 87 ops/s) |
| Intl+Thai-rule ref wrap | 69.735 (66.606 to 71.562; 14 ops/s) | 70.352 (69.684 to 74.403; 14 ops/s) | 70.968 (65.024 to 72.027; 14 ops/s) |
| Intl.Segmenter+greedy | 23.095 (22.308 to 23.222; 43 ops/s) | 23.219 (21.556 to 24.104; 43 ops/s) | 22.872 (21.747 to 22.984; 44 ops/s) |
| wordcut+greedy | 386.438 (366.018 to 387.959; 3 ops/s) | 401.408 (363.783 to 427.561; 2 ops/s) | 412.946 (399.353 to 427.104; 2 ops/s) |
| thai-wordcut-ts+greedy | 367.598 (367.094 to 384.838; 3 ops/s) | 376.706 (369.432 to 394.546; 3 ops/s) | 374.832 (356.874 to 386.550; 3 ops/s) |
| thai-break words+greedy | 52.337 (51.398 to 55.257; 19 ops/s) | 56.278 (53.350 to 56.624; 18 ops/s) | 53.339 (50.059 to 58.509; 19 ops/s) |
| thai-break wrap() | 70.045 (69.330 to 82.680; 14 ops/s) | 73.986 (69.847 to 78.610; 14 ops/s) | 73.530 (72.700 to 73.639; 14 ops/s) |

### throughput, large fixture

| tool | ml40 chars/s | ml40 MB/s | p99 ms (mean of rounds) |
|---|---|---|---|
| thaiwrap (ours) | 11.77M | 33.75 | 23.31 |
| Intl+Thai-rule ref wrap | 2.06M | 5.90 | 78.19 |
| Intl.Segmenter+greedy | 6.23M | 17.86 | 26.13 |
| wordcut+greedy | 0.36M | 1.03 | 420.98 |
| thai-wordcut-ts+greedy | 0.38M | 1.10 | 404.42 |
| thai-break words+greedy | 2.57M | 7.37 | 72.38 |
| thai-break wrap() | 1.96M | 5.61 | 82.58 |

## Speed - Rust core (criterion, ms per full-fixture wrap)

### small (criterion median estimate, median of 3 baselines, ms)

| tool | ml20 | ml40 | ml80 |
|---|---|---|---|
| thaiwrap-core (wrap) | 0.216 (0.196 to 0.244) | 0.233 (0.189 to 0.309) | 0.214 (0.185 to 0.313) |
| ICU4X+greedy | 0.218 (0.201 to 0.218) | 0.212 (0.195 to 0.216) | 0.204 (0.191 to 0.229) |
| wordcut-engine(chamkho)+greedy | 0.451 (0.433 to 0.517) | 0.453 (0.426 to 0.567) | 0.444 (0.426 to 0.532) |
| nlpo3 newmm+greedy | 0.580 (0.575 to 1.409) | 0.586 (0.564 to 1.017) | 0.585 (0.561 to 1.094) |
| thaibreak+greedy | 0.529 (0.517 to 0.549) | 0.524 (0.505 to 0.570) | 0.518 (0.503 to 0.537) |
| kham-core+greedy | 0.651 (0.599 to 0.656) | 0.629 (0.618 to 0.649) | 0.603 (0.600 to 0.644) |

### medium (criterion median estimate, median of 3 baselines, ms)

| tool | ml20 | ml40 | ml80 |
|---|---|---|---|
| thaiwrap-core (wrap) | 2.017 (1.810 to 2.287) | 1.903 (1.753 to 2.024) | 1.848 (1.726 to 1.859) |
| ICU4X+greedy | 2.067 (1.894 to 2.071) | 1.978 (1.830 to 2.185) | 1.916 (1.781 to 1.950) |
| wordcut-engine(chamkho)+greedy | 4.409 (4.163 to 8.460) | 4.407 (4.172 to 5.307) | 4.332 (4.145 to 7.670) |
| nlpo3 newmm+greedy | 5.617 (5.473 to 7.064) | 5.570 (5.301 to 8.296) | 5.543 (5.277 to 6.021) |
| thaibreak+greedy | 5.166 (5.026 to 5.274) | 5.121 (4.906 to 5.472) | 5.040 (4.917 to 5.277) |
| kham-core+greedy | 6.532 (5.889 to 7.046) | 6.320 (6.062 to 7.823) | 5.918 (5.568 to 6.809) |

### large (criterion median estimate, median of 3 baselines, ms)

| tool | ml20 | ml40 | ml80 |
|---|---|---|---|
| thaiwrap-core (wrap) | 9.721 (9.103 to 9.887) | 9.512 (8.828 to 9.850) | 9.308 (8.705 to 9.567) |
| ICU4X+greedy | 10.345 (9.532 to 10.501) | 10.148 (9.247 to 11.198) | 10.241 (8.990 to 11.307) |
| wordcut-engine(chamkho)+greedy | 22.407 (21.240 to 45.868) | 22.178 (21.039 to 49.941) | 21.997 (21.099 to 43.152) |
| nlpo3 newmm+greedy | 28.446 (27.105 to 29.584) | 28.486 (26.524 to 30.018) | 28.315 (26.554 to 28.625) |
| thaibreak+greedy | 26.130 (25.225 to 26.355) | 25.185 (24.882 to 26.844) | 25.130 (24.764 to 25.486) |
| kham-core+greedy | 30.606 (26.822 to 35.071) | 29.715 (26.608 to 46.717) | 30.188 (26.282 to 50.413) |

The napi/string boundary adds ~2.8 ms for thaiwrap on `large` (12.3 ms through Node vs 9.51 ms in-core), part of which is UTF-16 conversion and owned-string allocation, identical to what any user of the npm package pays.

## Cold start (fresh process, median of 15)

| tool | load ms | init ms | first call ms | warm call ms |
|---|---|---|---|---|
| thaiwrap | 3.54 | - | 0.36 | 0.29 |
| intl-reference | 0.00 | - | 10.16 | 0.05 |
| intl-simple | 0.00 | - | 10.21 | 0.04 |
| wordcut-greedy | 10.80 | 119.82 | 1.16 | 0.20 |
| thai-wordcut-ts-greedy | 8.93 | - | 91.18 | 0.17 |
| thai-break-greedy | 5.74 | - | 9.64 | 0.08 |
| thai-break-wrap | 5.74 | - | 17.85 | 7.00 |

wordcut requires an explicit `init()` (dictionary parse); thai-wordcut-ts loads its dictionary lazily on first call; thai-break auto-loads its DAWG on import.
Intl.Segmenter's ~10 ms first call is V8 lazily building the Thai dictionary segmenter; thaiwrap's load time includes dlopen of the native binary with ICU data compiled in.

## Peak memory (large fixture, 300 wraps, `maxLength` 40)

| tool | peak RSS (time -l) | max RSS sampled | max heap | heap after GC |
|---|---|---|---|---|
| thaiwrap (ours) | 109840 KB | 109,648 KB | 37,069 KB | 18,631 KB |
| Intl+Thai-rule ref wrap | 182528 KB | 178,656 KB | 90,615 KB | 18,735 KB |
| Intl.Segmenter+greedy | 202480 KB | 202,432 KB | 110,118 KB | 18,888 KB |
| wordcut+greedy | 167648 KB | 167,616 KB | 83,821 KB | 18,986 KB |
| thai-wordcut-ts+greedy | 235504 KB | 226,480 KB | 151,198 KB | 28,386 KB |
| thai-break words+greedy | 220096 KB | 220,096 KB | 122,820 KB | 19,467 KB |
| thai-break wrap() | 161904 KB | 150,048 KB | 108,377 KB | 19,405 KB |

Base Node RSS is ~86 MB. thaiwrap allocates only its output lines; every other tool materializes token arrays per call.

## Bundle / install size

| package | tarball (download) | unpacked (install) | payload gzip |
|---|---|---|---|
| thaiwrap@0.1.1 | 12 KB | 52 KB | 13 KB |
| @thaiwrap/binding-darwin-arm64@0.1.1 | 830 KB | 1444 KB | 830 KB |
| wordcut@0.9.1 | 112 KB | 477 KB | 112 KB |
| thai-wordcut-ts@1.0.2 | 112 KB | 484 KB | 115 KB |
| thai-break@1.5.0 | 182 KB | 396 KB | 183 KB |
| nlpo3@0.2.1 | 6 KB | 59 KB | 6 KB |
| Intl.Segmenter (builtin)@v22.19.0 | 0 KB | 0 KB | 0 KB |

For thaiwrap the JS entry is 12 KB; the 830 KB platform binary (1.4 MB unpacked, ICU data included) is what actually loads on a given machine and is not browser-usable.
wordcut / thai-wordcut-ts / thai-break are pure JS (dictionary JS or DAWG binary inside) and could ship to a browser.
nlpo3's 6 KB npm tarball contains no binary at all - see [Notes](#notes-and-exclusions).

## Quality

All tools x sizes x `maxLength` {20, 40, 80}; counts are totals over the 9 combinations.
"mid-word" counts line breaks that fall inside a reference token, against both references: newmm (PyThaiNLP, the task's standard) and ICU word segmentation (V8 `Intl.Segmenter`, closest JS proxy for ICU4X).

| tool | lines | over-limit u16 / grapheme | mid-word (newmm) | mid-word (ICU) | starts w/ mark | starts w/ ะ า ำ ๆ ฯ | ends w/ เ แ โ ใ ไ | text preserved |
|---|---|---|---|---|---|---|---|---|
| thaiwrap | 18,009 | 0 / 0 | 3,493 | 91 | 0 | 0 | 0 | yes |
| intl-reference | 17,987 | 0 / 0 | 3,528 | 10 | 0 | 0 | 0 | yes |
| intl-simple | 17,781 | 10 / 9 | 3,532 | 0 | 0 | 4 | 0 | yes |
| wordcut-greedy | 17,805 | 9 / 9 | 3,175 | 620 | 4 | 8 | 2 | yes |
| thai-wordcut-ts-greedy | 17,805 | 9 / 9 | 3,175 | 620 | 4 | 8 | 2 | yes |
| thai-break-greedy | 17,829 | 30 / 30 | 3,006 | 462 | 0 | 82 | 0 | yes |
| thai-break-wrap | 14,725 | 10773 / 65 | 2,362 | 361 | 0 | 0 | 0 | yes |
| thaiwrap-core | 18,009 | 0 / 0 | 3,493 | 91 | 0 | 0 | 0 | yes |
| icu-greedy | 17,768 | 9 / 9 | 3,645 | 168 | 0 | 81 | 0 | yes |
| chamkho-greedy | 18,302 | 9 / 9 | 157 | 406 | 0 | 37 | 0 | yes |
| nlpo3-greedy | 18,303 | 9 / 9 | 105 | 357 | 0 | 37 | 0 | yes |
| thaibreak-greedy | 17,829 | 30 / 30 | 3,006 | 462 | 0 | 82 | 0 | yes |
| kham-greedy | 17,861 | 9 / 9 | 159 | 301 | 0 | 41 | 0 | yes |

### How to read the mid-word numbers

newmm's dictionary keeps many compounds whole (`ข้อเสนอแนะ`, `การเขียน`, `สละเวลา`), while ICU4X/ICU4C and thai-break segment those at sub-word boundaries.
So 19% of thaiwrap's line breaks fall inside a newmm word, but only 1% inside an ICU word, and nothing is typographically wrong.
The cross-check validates this: nlpo3 (Rust port of newmm itself) has 1% against PyThaiNLP newmm, and chamkho/wordcut-engine (PyThaiNLP word list lineage) 1% - dictionary-family agreement.
Against the ICU reference, thaiwrap's 91 breaks are explainable: overflow splits of tokens longer than `maxLength` (default `split` strategy, e.g. `supercalifragilisticexpialidocious` at `maxLength` 20 becomes `supercalifragilistic` + `expialidocious`) and UAX #14 line-break opportunities at script boundaries (e.g. `com|ตลาด`) that a word reference does not contain.
The greedy-wrapped segmenters keep overlong tokens whole instead (that is their 9-30 over-limit lines) and have no overflow strategy at all.

### Thai rule problems, with fixture examples

Problems are rare per line (0.1% to 0.6% of lines for the tools that have them), so a short excerpt may show none.
Example from the fixture, `maxLength` 20, input `เพื่อติดตามความคืบหน้าของโครงการและแก้ไขปัญหาที่เกิดขึ้น เด็กๆ เล่นเท่าๆๆ กัน`: thaiwrap never starts a line with `ๆ`; Intl + simple wrap, wordcut, thai-wordcut-ts and thai-break words() + simple wrap each do at least once.
- wordcut / thai-wordcut-ts: 4 lines starting with a tone or vowel mark (for example `่ สวย งาม ( คั่น...`), 8 starting with `ะ า ำ ๆ ฯ`, 2 ending with a leading vowel.
- Intl.Segmenter + simple wrap: 4 lines starting with `ๆ` or `ฯ` (`ฯลฯ`, `ๆๆ` become standalone tokens).
- ICU4X + simple wrap (Rust): 81 such lines - raw dictionary segmentation has no Thai no-start rules.
- thai-break words() / thaibreak: 82; chamkho/wordcut-engine 37, nlpo3 37, kham-core 41.
- thaiwrap and the Intl.Segmenter Thai-rule reference: zero violations across all 9 configurations.

`thai-break wrap()`'s 10,773 "over-limit" lines in UTF-16 units are the unit difference: its width counts Thai combining marks as zero-width, so at display width 20 a line may carry up to ~28 UTF-16 units.
In its own unit 42 lines exceed the width (unbreakable single units).
This is a legitimate design choice, but it means `wrap(t, n)` from thai-break and `wrapThai(t, n)` accept different `n` for the same rendered width.

### Text preservation

Every tool, in every configuration, reproduced the input exactly after removing whitespace and ZWSP (the fixture's ZWSP break hints are break opportunities, not content, so they legitimately disappear from wrapped output).
This was verified against `newmm` token reconstruction of the same fixture.

## Wins / losses summary

Wins: fastest in every JS configuration; within a few percent of raw ICU4X in Rust; smallest memory; smallest start-up; zero Thai-rule problems and zero over-limit lines (overflow `split` strategy); `overflow` and `measure` options the others lack.
Losses / trade-offs: not browser-usable (native binding, 830 KB per platform) where wordcut/thai-break are pure JS; ICU4X segmentation disagrees with PyThaiNLP-style dictionaries on compounds (19% of breaks vs newmm), which matters if you need newmm-compatible word boundaries specifically; per-call UTF-16 conversion cost through napi (~2.8 ms on the 50-page input).
The fairest "do it yourself in JS" baseline is `Intl.Segmenter` + a correct Thai-rule wrap (the reference implementation): it is 5.7x slower than thaiwrap for the same zero-problem output.

## Notes and exclusions

- **nlpo3 npm 0.2.1 excluded from JS benchmarks**: `npm i nlpo3` fails on a clean machine - its install script runs `cargo-cp-artifact` (not present) and would require a local Rust toolchain anyway (`npm error sh: cargo-cp-artifact: command not found`).
  There are no prebuilt binaries.
  The crate `nlpo3` 1.4.0 is benchmarked at the Rust core level instead, with the dictionary of its own v1.4.0 release.
- **chamkho**: the crate ships only a `wordcut` binary (no lib target), so the benchmark links `wordcut-engine` 1.2.2 (its engine) with chamkho's own `words_th.txt` and Thai cluster rules - the same defaults as the chamkho CLI.
  **`wordcut-engine` is LGPL-2.1**; `deny.toml` gained a scoped `[[licenses.exceptions]]` for it (bench-only dependency, never reachable from thaiwrap-core or thaiwrap-node).
- **thai-break crate**: builds cleanly with `default-features = false, features = ["embedded-dict"]`; its default features pull pyo3 and wasm-bindgen.
- **Bun was upgraded 1.3.5 -> 1.4.4** on this machine during the work: `bun test` failed on 1.3.5 with a lone-surrogate N-API string bug (`a\uD800b` lost the trailing `b` through the addon), which 1.4.4 fixes.
  All 50 JS tests pass on Bun 1.4.4 and Node 22.
- The fixture contains 25 ZWSP and 22 NBSP; NBSP is content for thaiwrap (never a break), ZWSP is a break hint (trimmed from line edges like spaces).
- **Shared wrapper correction**: an earlier draft of the shared greedy wrapper inserted a space between every pair of tokens, which made the competitors' lines shorter and their line counts about 15% higher.
  It now joins adjacent tokens directly and keeps a space only where the input had one.
  All speed, memory and quality numbers here were measured with the corrected wrapper.
- Cold start and bundle size do not depend on the wrapper and are unchanged by that correction.

## How to reproduce

```sh
bun install                                   # installs the pinned dev dependencies
bun run build                                 # builds the native addon
node bench/index.mjs                          # JS speed, 3 rounds -> bench/out/js-speed.json
node bench/bench-cold-start.mjs               # cold start   -> bench/out/cold-start.json
node bench/bench-memory-run.mjs               # peak memory  -> bench/out/memory.json
node bench/bench-bundle-size.mjs              # bundle sizes -> bench/out/bundle-size.json
node bench/bench-quality.mjs                  # quality      -> bench/out/quality.json (uses uv + pythainlp)
cargo run --release -p bench-compare --bin dump-outputs               # Rust outputs for the quality check
cargo bench -p bench-compare --bench compare -- --save-baseline r1   # repeat for r2, r3
python3 bench/scripts/report_tables.py        # regenerates the tables above from bench/out/*.json
node bench/scripts/build-site-page.mjs        # rebuilds site/public/benchmarks/comparison/index.html
```

`npm run` shortcuts: `bench` (JS speed), `bench:quality`, `bench:rust`, `bench:cold-start`, `bench:memory`, `bench:bundle-size`, `bench:site`.
Run the quality step after `dump-outputs` so the Rust tools are included.
Fixture regeneration: `bun bench/scripts/make-fixtures.mjs`.
