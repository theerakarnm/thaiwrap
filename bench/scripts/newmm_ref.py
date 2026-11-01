#!/usr/bin/env python3
"""Emit PyThaiNLP newmm token boundaries for a fixture, as JSON.

Used by bench/bench-quality.mjs as the reference segmentation for the
"mid-word cut" metric. Run through an ephemeral environment so pythainlp never
becomes a project dependency:

  uv run --with 'pythainlp==5.4.0' python bench/scripts/newmm_ref.py <fixture>

Prints {"engine": "...", "pythainlp": "...", "tokens": ["...", ...]} with
whitespace tokens kept (the JS side strips them consistently on both sides).
"""

import json
import sys

import pythainlp
from pythainlp.tokenize import word_tokenize

path = sys.argv[1]
text = open(path, encoding="utf-8").read()
tokens = word_tokenize(text, engine="newmm", keep_whitespace=True)
assert "".join(tokens) == text, "newmm tokens must reconstruct the input exactly"
print(json.dumps({"engine": "newmm", "pythainlp": pythainlp.__version__, "tokens": tokens}, ensure_ascii=False))
