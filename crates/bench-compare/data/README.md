# Dictionary data for bench-compare

These files are used only by the `bench-compare` benchmarks.
They are never packaged (`bench-compare` is `publish = false`).

## words_th.txt (nlpo3)

- Source: https://github.com/PyThaiNLP/nlpo3/blob/b40f9f46b6968cc069272a3334f2037ddec46028/words_th.txt
- Version: nlpo3 tag `v1.4.0`, commit `b40f9f46b6968cc069272a3334f2037ddec46028`
- SHA-256: `24acb820c71695a8a6ad0089d421b56ae79711271950372af873b8bf5db04e24`
- License: the nlpo3 repository is Apache-2.0 (https://github.com/PyThaiNLP/nlpo3/blob/v1.4.0/LICENSE).
  The nlpo3 README credits the list to PyThaiNLP's `pythainlp/corpus/words_th.txt`, which it describes as CC0-1.0.
  Both licenses allow redistribution.
- Used as the dictionary for `NewmmTokenizer::new`, because the nlpo3 crate ships no dictionary.

## chamkho-words_th.txt (chamkho)

- Source: `data/words_th.txt` inside the `chamkho` 1.5.0 crate from crates.io.
- SHA-256: `3fa95da892cb841fcb58cff8744e3dc1d32cf135c7d6b1de4f1861f57a74893c`
- License: Apache-2.0, the PyThaiNLP word list as shipped by chamkho with its `LICENSE-PyThaiNLP` file.
- Copied because chamkho has no library target, so its data directory cannot be reached from a dependency.
  It is the default Thai dictionary of the chamkho 1.5.0 `wordcut` CLI.
  It differs slightly from the nlpo3 list (62,017 vs 62,018 lines, different content hash).
