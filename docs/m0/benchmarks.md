# thaiwrap v0.1 benchmarks

Numbers are a new baseline for this machine.
They are not comparable with the Linux x64 prototype.

## Machine

| Item | Value |
| --- | --- |
| OS | macOS 26.6.2 (25G83) |
| Arch | arm64 |
| CPU | Apple M1 Pro |
| Rust | stable per `rust-toolchain.toml`, release profile (lto, codegen-units 1) |
| criterion | 0.8.2 |
| mitata | 1.0.34 |
| Node | 22.19.0, 24.22.2 |
| Bun | 1.3.5 (installed), 1.4.4 (via `npx -y bun@1.4.4`) |

The machine was not guaranteed idle.
Numbers are single runs per runtime.

## Pure Rust (`cargo bench -p thaiwrap-core`, criterion mean)

| Benchmark | Input | maxLength | us per call |
| --- | --- | --- | --- |
| short | 1x sample (38 chars) | 10 | 1.82 |
| long | 300x sample | 10 | 538.39 |
| mixed | 50x mixed Thai/Latin/emoji | 20 | 114.19 |
| overflow_max4 | 300x sample | 4 | 725.62 |
| graphemes_long | 300x sample, `Measure::Graphemes` | 10 | 600.57 |

## napi binding vs Intl.Segmenter reference (mitata avg)

| Runtime | Case | thaiwrap us | reference us | Speedup | Target | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Node 22.19.0 | short | 3.17 | 8.10 | 2.56x | >= 2x | pass |
| Node 22.19.0 | long | 807.13 | 1810 | 2.24x | >= 2x | pass |
| Node 24.22.2 | short | 3.32 | 5.86 | 1.77x | >= 2x | FAIL |
| Node 24.22.2 | long | 850.81 | 1250 | 1.47x | >= 2x | FAIL |
| Bun 1.3.5 | short | 2.83 | 7.18 | 2.54x | >= 1.6x | pass |
| Bun 1.3.5 | long | 678.64 | 1690 | 2.49x | >= 1.6x | pass |
| Bun 1.4.4 | short | 2.77 | 5.85 | 2.11x | >= 1.6x | pass |
| Bun 1.4.4 | long | 692.96 | 1380 | 1.99x | >= 1.6x | pass |

## Other targets

| Target | Measured | Result |
| --- | --- | --- |
| `graphemes_long` at most 1.5x `long` | 600.57 / 538.39 = 1.12x | pass |
| Release `.node` size at most 3.6 MB | 3,492,224 bytes (3.49 MB) | pass |

## Notes

- The 2x Node target is missed on Node 24.22.2 (1.77x short, 1.47x long).
  The reference is faster on Node 24 than on Node 22, while thaiwrap is about the same.
  No code was tuned in this task.
- The napi `long` call (807 us on Node 22) is about 1.5x the pure-Rust `long` (538 us).
  The gap is the JS string conversion and the `Vec<String>` result.

- Note, 2026-10-31: with the line segmenter (ADR 0001) the release darwin-arm64 `.node` is 1,477,760 bytes (observed with `ls -l`), because the CJ dictionary is no longer linked.
  The 3,492,224 bytes above were measured with the word segmenter.

## After ADR 0001 (line segmenter), 2026-10-31

Same machine as above (Apple M1 Pro, macOS arm64).
Nothing else heavy ran during these runs.

### Pure Rust: word segmenter vs line segmenter

`cargo bench -p thaiwrap-core`, criterion mean per run.
Each tree was built from `git archive` into its own `CARGO_TARGET_DIR`.
Runs alternated word, line, word, line, word, line.
The change compares the median of the 3 runs.

| Benchmark | Word segmenter (33317f0), runs 1/2/3 us | Line segmenter (44bae54), runs 1/2/3 us | Median word us | Median line us | Change |
| --- | --- | --- | --- | --- | --- |
| short | 1.88 / 1.85 / 1.91 | 1.92 / 1.88 / 1.89 | 1.88 | 1.89 | +0.5% |
| long | 576.03 / 541.51 / 534.19 | 569.68 / 555.62 / 555.40 | 541.51 | 555.62 | +2.6% |
| mixed | 116.14 / 115.97 / 113.30 | 115.90 / 116.37 / 115.13 | 115.97 | 115.90 | -0.1% |
| overflow_max4 | 733.37 / 735.13 / 727.35 | 754.57 / 760.63 / 760.21 | 733.37 | 760.21 | +3.7% |
| graphemes_long | 598.80 / 604.92 / 598.38 | 629.59 / 632.32 / 635.98 | 598.80 | 632.32 | +5.6% (over +5%) |

`graphemes_long` is above the +5% limit in AGENTS.md.
It needs a decision before merge.
No code was tuned.

### napi binding vs Intl.Segmenter reference (mitata avg, HEAD)

| Runtime | Case | thaiwrap us | reference us | Speedup |
| --- | --- | --- | --- | --- |
| Node 22.19.0 | short | 3.35 | 19.8 | 5.92x |
| Node 22.19.0 | long | 869.47 | 5010 | 5.76x |
| Node 24.22.2 | short | 3.46 | 11.0 | 3.19x |
| Node 24.22.2 | long | 858.87 | 2630 | 3.06x |
| Bun 1.4.4 | short | 2.90 | 9.7 | 3.34x |
| Bun 1.4.4 | long | 714.08 | 2140 | 3.00x |

The reference in `__test__/reference.mjs` got slower after `aa886db` (it builds a grapheme set per paragraph).
These speedups are therefore larger than the ones measured before that commit.
The reference breaks at word boundaries, so it does the same work as `thaiwrap` only on Thai-letter text such as these inputs.
The release darwin-arm64 `.node` is 1,477,760 bytes.
