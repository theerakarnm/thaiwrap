//! Line length, counted the way the caller asked.
use crate::{segment, Measure};

pub(crate) fn measure(s: &str, measure: Measure) -> usize {
    match measure {
        Measure::CodeUnits => s
            .chars()
            .fold(0usize, |n, c| n.saturating_add(c.len_utf16())),
        // The boundary iterator yields 0 and s.len(), so n clusters have n + 1 boundaries.
        Measure::Graphemes if s.is_empty() => 0,
        Measure::Graphemes => segment::grapheme_boundaries(s).count().saturating_sub(1),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn code_units_should_match_js_length() {
        assert_eq!(measure("สื่อสาร", Measure::CodeUnits), 7);
        assert_eq!(measure("👍", Measure::CodeUnits), 2);
    }
    #[test]
    fn graphemes_should_count_a_consonant_with_its_marks_once() {
        assert_eq!(measure("สื่อสาร", Measure::Graphemes), 5);
        assert_eq!(measure("👨‍👩‍👧", Measure::Graphemes), 1);
        assert_eq!(measure("", Measure::Graphemes), 0);
    }
}
