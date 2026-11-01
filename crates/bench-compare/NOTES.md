# bench-compare notes

`bench-compare` benchmarks `thaiwrap-core` against other Thai segmenters on the committed fixtures.
It is `publish = false` and never packaged.
Segmentation-only tools are wrapped by `greedy_wrap` in `src/lib.rs`, which mirrors `bench/lib/greedy.mjs`.

## Commands

```bash
cargo bench -p bench-compare -- --save-baseline r1      # criterion matrix
cargo run --release -p bench-compare --bin dump-outputs # bench/out/rust-outputs/*.json
cargo test -p bench-compare
```

## Tools

Every tool's state is built once in `Tools::new()`, before any measured closure.
The measured closure is `tools.wrap(tool, text, max)`: one full wrap of the whole fixture, returning `Vec<String>`.

| Tool id | Crate (pinned) | Status | Construction | API used per paragraph |
|---|---|---|---|---|
| `thaiwrap-core` | path crate | included | `OnceLock` inside the crate; first call is in criterion warm-up | `thaiwrap_core::wrap(text, max, &WrapOptions::default())`, ranges mapped to owned `String`s like the napi binding |
| `icu-greedy` | `icu_segmenter =2.4.0` (`compiled_data`, no default features) | included | outside loop | `WordSegmenter::new_dictionary(WordBreakInvariantOptions::default())`, then `segment_str(para)` boundaries sliced into tokens |
| `chamkho-greedy` | `chamkho =1.5.0` via `wordcut-engine =1.2.2` | included (see below) | outside loop | `Wordcut::new_with_cluster_re(load_dict(data/chamkho-words_th.txt), load_cluster_rules(thai_cluster_path()))`, then `segment_into_strings(para)` |
| `nlpo3-greedy` | `nlpo3 =1.4.0` | included | outside loop | `NewmmTokenizer::new("data/words_th.txt")`, then `segment(para, false, false)` (safe mode off like PyThaiNLP's default, no rayon parallelism) |
| `thaibreak-greedy` | `thaibreak =1.5.0` (`default-features = false`, `embedded-dict`) | included | outside loop | `Tokenizer::new(ThaiTrie::embedded()?, None)`, then `tokenize(para, true)` |
| `kham-greedy` | `kham-core =0.8.2` | included | outside loop | `kham_core::Tokenizer::new()`, then `segment(para)` mapped to `token.text` |

No crate was excluded.

### chamkho

- chamkho 1.5.0 has no library target (`autolib = false`, only `[[bin]] wordcut`), so it cannot be a Cargo library dependency.
- Its segmentation is entirely in `wordcut-engine`, by the same author, which chamkho re-exports in `src/init.rs`.
- We reproduce the chamkho CLI's Thai defaults: chamkho's own `data/words_th.txt` (copied to `data/chamkho-words_th.txt`, see `data/README.md`) and `thai_cluster_rules.txt` (byte-identical in wordcut-engine, so we use `wordcut_engine::thai_cluster_path()`).
- The CLI also applies `thai-replace-rules.json` (one rule: `ํา` to `ำ`) before segmenting. We skip it, because it rewrites the text and the outputs must keep the input text.
- **License:** `wordcut-engine` is `LGPL-2.1`, which is not in `deny.toml`'s allow list.
  `deny.toml` has a scoped `[[licenses.exceptions]]` entry for `wordcut-engine` only, justified by it being reachable only from this bench crate.
  Remove the exception if `chamkho-greedy` is dropped.

### thaibreak

- Builds fine as a plain dependency with `default-features = false, features = ["embedded-dict"]`: `pyo3`, `wasm-bindgen`, `libc` and the typst plugin are all optional and stay off.
- `thaibreak::words()` searches cwd-relative paths (`data/words.fst`, `../data/words.txt`, ...) before its embedded dictionary, so we build the `Tokenizer` from `ThaiTrie::embedded()` directly to be cwd-independent.
  With no bigram file present this is what `words()` would load anyway.
- We pass `keep_whitespace = true`, matching `thaibreak.words(p, true)` in `bench/lib/tools.mjs`; whitespace tokens are dropped by the wrapper either way.

### nlpo3

- The crate ships no dictionary, so `data/words_th.txt` is the list from the nlpo3 repository at tag `v1.4.0` (Apache-2.0 repo; the README credits PyThaiNLP, CC0-1.0).
- `NewmmTokenizer::new` unwraps internally if the file is missing; the path is built from `CARGO_MANIFEST_DIR`.

## Greedy wrapper semantics

Same as `bench/lib/greedy.mjs`:

- Split on `'\n'`; whitespace-only paragraphs become `""`, dropped before the first and after the last visible line.
- Whitespace-only tokens are separators; other tokens are atoms joined by one space and never cut.
- Fit test: `line_len + 1 + word_len <= max`, lengths in UTF-16 code units.
- Rust `str::trim` uses Unicode `White_Space`, like JS `\s`, except that JS also treats U+FEFF as whitespace. Neither treats ZWSP (U+200B) as whitespace.

## Criterion

- Config in `benches/compare.rs`: warm-up 500 ms, measurement 2 s, sample size 50.
  No single iteration is near 100 ms (round 1 means: about 0.2-0.9 ms small, 2-8 ms medium, 9-41 ms large), so the sample size was kept.
  Criterion prints "Unable to complete 50 samples in 2.0s" for slower ids and extends the measurement time automatically.
- Benchmark ids are `<tool>/<size>/ml<NN>` (group = tool). Criterion turns the `/` inside the function id into `_` on disk.
- Per-baseline estimates:

  ```
  target/criterion/<tool>/<size>_ml<NN>/<baseline>/estimates.json
  ```

  Glob: `target/criterion/*/*_ml*/r[123]/estimates.json`.
  Each `estimates.json` has `mean`, `median`, `std_dev`, `median_abs_dev`, `slope` objects with `point_estimate` and `confidence_interval`, in nanoseconds per iteration.
  The original id is in `target/criterion/<tool>/<size>_ml<NN>/<baseline>/benchmark.json` (`full_id`).
- `[lib] bench = false` and `[[bin]] bench = false` are set so `cargo bench -p bench-compare -- --save-baseline rN` passes criterion flags only to the criterion target (the default libtest bench harness rejects `--save-baseline`).

## Gotchas

- `thaiwrap::wrap` returns `Vec<Range<usize>>`; the bench maps them to owned strings so all tools pay for line allocation.
- `thaiwrap-core` trims ZWSP at line edges (rule 5), so its joined output has a few fewer ZWSP characters than the input; the greedy tools keep ZWSP inside tokens.
- `bench-compare` does not set `rust-version`; it is not part of the MSRV contract of the published crates.
