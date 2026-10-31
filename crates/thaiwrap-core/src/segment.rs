//! Break candidates from ICU4X, grouped into units that a line cannot split.
use std::ops::Range;
use std::sync::OnceLock;

use icu_segmenter::options::WordBreakInvariantOptions;
use icu_segmenter::{
    GraphemeClusterSegmenter, GraphemeClusterSegmenterBorrowed, WordSegmenter,
    WordSegmenterBorrowed,
};

use crate::thai;

static GRAPHEMES: GraphemeClusterSegmenterBorrowed<'static> = GraphemeClusterSegmenter::new();

fn word_segmenter() -> &'static WordSegmenterBorrowed<'static> {
    static SEGMENTER: OnceLock<WordSegmenterBorrowed<'static>> = OnceLock::new();
    SEGMENTER.get_or_init(|| WordSegmenter::new_dictionary(WordBreakInvariantOptions::default()))
}

/// Byte offsets inside `para` where the segmenter allows a break, without 0 and `para.len()`.
/// The word segmenter reports "ส่งมอบ| |และ"; `thai::allowed` later drops the offset before the
/// space, so the word and line segmenters (which never break before a space) give the same units.
pub(crate) fn break_candidates(para: &str) -> impl Iterator<Item = usize> + '_ {
    word_segmenter()
        .segment_str(para)
        .filter(move |&b| b > 0 && b < para.len())
}

/// Grapheme cluster boundaries of `s`, including 0 and `s.len()`.
pub(crate) fn grapheme_boundaries(s: &str) -> impl Iterator<Item = usize> + '_ {
    GRAPHEMES.segment_str(s)
}

/// Text between two allowed breaks: visible content plus the break spaces after it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Unit {
    pub(crate) content: Range<usize>,
    pub(crate) trailing: Range<usize>,
}

/// The units of a paragraph, in order. Only the first unit can have empty content
/// (when the paragraph starts with spaces).
pub(crate) fn units(para: &str) -> impl Iterator<Item = Unit> + '_ {
    // The word segmenter also breaks inside a grapheme cluster, for example between a Thai
    // letter and a following U+0301 or ZWJ, so keep only the breaks that are cluster
    // boundaries. Both lists are sorted, so one pass merges them without allocating.
    let mut graphemes = grapheme_boundaries(para).peekable();
    let mut ends = break_candidates(para)
        .filter(move |&b| {
            while graphemes.next_if(|&g| g < b).is_some() {}
            graphemes.peek() == Some(&b)
        })
        .filter(move |&b| thai::allowed(para, b))
        .chain(std::iter::once(para.len()));
    let mut start = 0;
    std::iter::from_fn(move || {
        let end = ends.next()?;
        let unit = unit(para, start..end);
        start = end;
        Some(unit)
    })
}

fn unit(para: &str, range: Range<usize>) -> Unit {
    let text = para.get(range.clone()).unwrap_or_default();
    let leading = text.len() - text.trim_start_matches(thai::is_break_space).len();
    let content_end = range.start + text.trim_end_matches(thai::is_break_space).len();
    let content_start = (range.start + leading).min(content_end);
    Unit {
        content: content_start..content_end,
        trailing: content_end..range.end,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unit_texts(para: &str) -> Vec<(&str, &str)> {
        units(para)
            .map(|u| (&para[u.content], &para[u.trailing]))
            .collect()
    }

    #[test]
    fn units_should_split_acceptance_input_at_verified_words() {
        let para = "กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า";
        assert_eq!(
            unit_texts(para),
            [
                ("กระบวนการ", ""),
                ("สื่อสาร", " "),
                ("ส่ง", ""),
                ("มอบ", " "),
                ("และ", ""),
                ("สร้าง", ""),
                ("คุณค่า", "")
            ]
        );
    }
    #[test]
    fn units_should_give_empty_content_for_leading_spaces() {
        assert_eq!(unit_texts("  ก").first(), Some(&("", "  ")));
    }
}
