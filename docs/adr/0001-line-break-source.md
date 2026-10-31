# ADR 0001: Source of line break positions

Status: proposed

## Context
v0.1 uses ICU4X `WordSegmenter::new_dictionary`.
UAX #14 `LineSegmenter::new_dictionary` is the Unicode standard for line breaks and handles punctuation, but it changes some break positions.
The comparison is in docs/m0/segmenter-comparison.md.

## Decision
Pending the maintainer's review of both groups.
Group (b) differences block the switch until approved.

## Consequences
If approved, Task 21 of docs/plans/2026-10-30-thaiwrap-v0.1.md switches `break_candidates` to the line segmenter.
