# ADR 0001: Source of line break positions

Status: accepted

## Context
v0.1 uses ICU4X `WordSegmenter::new_dictionary`.
UAX #14 `LineSegmenter::new_dictionary` is the Unicode standard for line breaks and handles punctuation, but it changes some break positions.
The comparison is in docs/m0/segmenter-comparison.md.

## Decision
Accepted by the maintainer on 2026-10-30 after reviewing both groups.
Switch `break_candidates` to `LineSegmenter::new_dictionary`.
Group (a) differences are removed by `thai::allowed` and the grapheme filter, so they cannot change output.
Group (b) has only one Thai-to-Thai difference (`ปี|๒๕๖๗`), so breaks inside Thai text stay the same.
The other group (b) differences are improvements for real text: no break inside `...`, `!!!`, `^^`, `พ.ศ.`, or a hashtag, none between a Thai word and `555`, and none after `(` or before `)`.
The cost is accepted: runs of Korean `ㅠ` get breaks between letters.

## Consequences
If approved, Task 21 of docs/plans/2026-10-30-thaiwrap-v0.1.md switches `break_candidates` to the line segmenter.
