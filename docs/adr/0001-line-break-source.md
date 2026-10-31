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
Task 21 of docs/plans/2026-10-30-thaiwrap-v0.1.md switched `break_candidates` to the line segmenter in the commit `feat(core): break lines with the UAX 14 segmenter`.
The matrix rows M2 and M4 and the corpus snapshots changed; the Thai-only parity results against `Intl.Segmenter` did not.
Other change classes in the snapshots, all from the group (b) table:
- No break before closing punctuation `? ! , : ; %`.
- No break around `-` and `/` in numbers, phone numbers and URLs, and none before `–` in year ranges.
- CJK, kana and Hangul break between every letter, not only `ㅠ`.
A visible cost: a word now stays with the punctuation after it, so a dictionary mis-split inside that word shows.
Observed with the built addon: `wrapThai("ระบบเก็บเสียงดีมาก?", 10)` gives `["ระบบเก็บ", "เสียงดีมา", "ก?"]`.
No Thai rule is broken, but a lone final consonant before `?` is visible.
