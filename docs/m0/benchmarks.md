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
