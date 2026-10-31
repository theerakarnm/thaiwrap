# wisesight-sentiment

Upstream: https://github.com/PyThaiNLP/wisesight-sentiment
Commit: c1d063649abc3a6870b5fd1aae26cd1c64bdde7b
License: CC0 1.0 (see LICENSE).
Files: word-tokenization/wisesight-1000-samples-tokenised.txt, neu.txt
Selection rule: every line of the tokenised file, then the first 500 lines of neu.txt whose UTF-16 length is at least 40.
Each line is trimmed and empty lines are dropped. Nothing else is changed, including malformed input.
