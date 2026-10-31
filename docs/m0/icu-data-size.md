# ICU4X data size measurement (Task 22)

This report measures how much custom baked ICU4X data can shrink the native binary.
It is the input for the v0.2 data decision (D17).
The user picks the option afterwards; nothing here is merged.

The segmenter in use is the UAX #14 `LineSegmenter` (ADR 0001, accepted).
All spike code lives on branch `spike/icu-data-size` (commit `7d8a7a0`, never merged).

## Result

| option | segmenter | .node bytes (darwin-arm64) | .node bytes (linux-arm64-gnu) | differences by category | eligible |
| --- | --- | --- | --- | --- | --- |
| compiled data (today) | `LineSegmenter` | 1,477,760 | 1,446,800 | reference | reference |
| (a) Thai only | `LineSegmenter` | 569,584 (-908,176, -61.5%) | 595,552 (-851,248, -58.8%) | Thai 0, Latin 0, digits 0, punctuation 0, emoji 0, CJK 0, Lao/Khmer/Burmese 5 | yes |
| (b) all dictionaries | `LineSegmenter` | 1,477,760 (same as compiled) | 1,447,520 (+720) | Thai 0, Latin 0, digits 0, punctuation 0, emoji 0, CJK 0, Lao/Khmer/Burmese 0 | yes |
| (a) + CJK | `LineSegmenter` | 569,584 (same as (a)) | 595,552 (same as (a)) | Thai 0, Latin 0, digits 0, punctuation 0, emoji 0, CJK 0, Lao/Khmer/Burmese 5 | yes |

"Eligible" means zero differences on Thai, Latin, digits, punctuation, and emoji (D17).
Sizes are `stat -f %z thaiwrap.darwin-arm64.node` after `bun run build` (release: lto, codegen-units 1, strip).
Compiled data was rebuilt on the spike branch with default features; the committed `feat/v0.1` build had the same size.
The linux-arm64-gnu sizes were measured on 2026-10-31 after a podman storage reset, in `docker.io/library/rust:1-bookworm` on an arm64 podman machine.
Each option was built from the spike branch with `bunx napi build --platform --release --manifest-path crates/thaiwrap-node/Cargo.toml` (plus `--no-default-features --features data_a|data_b|data_c`), and the size is `ls -l` of the produced `.node`.

## What the numbers mean

- Dropping the Lao, Khmer, and Burmese dictionaries (option (a)) saves 908,176 bytes on darwin-arm64.
  Option (b) keeps all four Southeast Asian dictionaries and is byte-for-byte the same size as compiled data.
  Compiled data already carries only those four, so (b) saves nothing.
- Option (a) + CJK is the same size as (a).
  The line segmenter never loads the CJ dictionary, so adding `cjdict` costs nothing in the binary.
- Lao, Khmer, and Burmese text is the one place (a) and (a) + CJK change behaviour.
  On a 3-line sample (one Lao, one Khmer, one Burmese line) they differ from compiled data at 5 boundaries.
  ICU4X prints `No segmentation model for complex script: Lao` and falls back to no break inside the run.
  The corpus contains one Wikipedia line with 17 Lao letters in short runs; it shows no difference.
  This difference is outside the D17 categories, so it does not affect "eligible".
  The user decides whether Lao, Khmer, and Burmese matter for a Thai-focused package.

## Step 1: does the line segmenter use the CJ dictionary?

No.
`LineSegmenter::try_new_dictionary_unstable` needs only `SegmenterBreakLineV1`, `SegmenterDictionaryExtendedV2`, and `SegmenterBreakGraphemeClusterV1`.
`cjdict` lives in `SegmenterDictionaryAutoV2`, which only `WordSegmenter` loads.
The icu_segmenter 2.4.0 source says so too (`line.rs`, `load_dictionary_unstable`: "Line segmenter doesn't need to load CJ dictionary because UAX 14 rules handles CJK characters").

Proof by running:
- Input: 100 lines of Chinese and Japanese written for this test (50 each, CC0, `crates/thaiwrap-core/spike/sample_cjk.txt` on the spike branch) plus both corpora.
- Option (a) has no `cjdict`.
- `LineSegmenter` boundaries with (a) data and with compiled data are identical on all of it: 0 differences, 3,000 boundaries compared on the CJK sample (line and grapheme boundaries together).
- Control that the sample is sensitive to the dictionary: compiled `WordSegmenter` finds 105 boundaries on the sample that compiled `LineSegmenter` does not have.
  So a segmenter that uses `cjdict` would differ; the line segmenter does not use it.
- Control that the harness detects differences: option (a) differs from compiled data on the Lao, Khmer, and Burmese sample (5 boundaries).

## Step 4: parity method and inputs

For each input text, the harness takes `segment_str` boundaries of `LineSegmenter` (break candidates) and of `GraphemeClusterSegmenter`, once with compiled data and once with the baked option.
It counts the positions that are in one set and not in the other.
A position's category is the highest-priority class of the two characters next to it: Thai, other Southeast Asian (Lao, Khmer, Burmese), CJK, emoji, digits, Latin, punctuation (this includes spaces).
Boundaries compared (line plus grapheme), the same for every option:

| source | texts | boundaries |
| --- | --- | --- |
| `corpus/wisesight/lines.txt` | 1,493 | 106,252 |
| `corpus/wikipedia-th/lines.txt` | 200 | 81,864 |
| test matrix inputs (every string literal in `tests/matrix.rs`) | 129 | 1,163 |
| Thai sample | 3 | 115 |
| Latin sample | 6 | 309 |
| digits sample | 6 | 153 |
| punctuation sample (quotes, brackets, URL, e-mail) | 7 | 257 |
| emoji sample (ZWJ, skin tone, flags, keycaps) | 7 | 110 |
| CJK sample | 100 | 3,000 |
| Lao, Khmer, Burmese sample | 3 | 75 |

Differences per option: (b) has none in any category, including the Southeast Asian sample.
(a) and (a) + CJK have none except 5 line boundaries in the Lao, Khmer, and Burmese sample.
The grapheme segmenter has no difference in any option.

## Commands

Tool: `icu4x-datagen 2.4.0`, installed with `cargo install icu4x-datagen --version 2.4.0 --locked --root /tmp/thaiwrap-tools`.
It downloads CLDR 49.0.0 and ICU 79.1rc export data at run time, so it needs network access.

```text
M="SegmenterBreakLineV1 SegmenterDictionaryExtendedV2 SegmenterBreakGraphemeClusterV1"

# (a) Thai only
icu4x-datagen --format baked --use-separate-crates --locales und --markers $M \
  --segmenter-models thaidict --out crates/thaiwrap-core/baked/a

# (b) all dictionaries
icu4x-datagen --format baked --use-separate-crates --locales und --markers $M \
  --segmenter-models thaidict laodict khmerdict burmesedict --out crates/thaiwrap-core/baked/b

# (a) + CJK
icu4x-datagen --format baked --use-separate-crates --locales und \
  --markers $M SegmenterDictionaryAutoV2 \
  --segmenter-models thaidict cjdict --out crates/thaiwrap-core/baked/c
```

Build, per option: `bun run build -- --no-default-features --features data_a` (or `data_b`, `data_c`), then `stat -f %z thaiwrap.darwin-arm64.node`.
Marker and model lists are space separated; a comma list is rejected as an unknown marker.
Each built `.node` loaded in Node 22 and returned the acceptance output.

## Findings for the v0.2 decision

- `--locales und` is required.
  With `--locales none` the command succeeds but the dictionary payloads are empty (`IdentifierNotFound`), and the `.node` would be small for the wrong reason.
- Baked data is generated code that contains `unsafe` (`ZeroVec::from_bytes_unchecked`).
  The core crate's `#![forbid(unsafe_code)]` and the "no `unsafe` in v0.x" rule cannot hold with custom data in the core crate.
  The spike made `forbid` conditional on `not(feature = "custom_data")`.
  A v0.2 design would need the user's explicit approval, for example the baked data in its own crate.
- Segmenters built from a provider are not `Send + Sync` by default.
  Storing them in a `OnceLock` static needs the `icu_provider` `sync` feature.
- ICU4X crates the spike added to `thaiwrap-core`: `icu_collections =2.4.0`, `icu_provider =2.4.0` (features `baked`, `sync`), `zerotrie 0.2.5`, `zerovec 0.11.9`.
  All four were already in `Cargo.lock` through `icu_segmenter`; no new crate entered the lockfile.
  No non-ICU4X crate was added.
- Datagen used its default trie type (`small`).
  The equal size of (b) and compiled data suggests compiled data uses the same type.
- Constructors used: `LineSegmenter::try_new_dictionary_unstable(&Baked, LineBreakOptions::default())` and `GraphemeClusterSegmenter::try_new_unstable(&Baked)`, owned values stored in a `OnceLock`, then `.as_borrowed()`.

## Not measured

- linux-arm64-gnu `.node` size: podman's container storage is broken (`readlink .../storage/overlay: invalid argument`).
  The orchestrator can fill the column in after the user approves a podman reset.
- Runtime speed with baked data: out of scope for this task.
