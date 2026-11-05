//! Break candidates from ICU4X, grouped into units that a line cannot split.
use std::ops::Range;
use std::sync::OnceLock;

use icu_provider_blob::BlobDataProvider;
use icu_segmenter::options::LineBreakOptions;
use icu_segmenter::{GraphemeClusterSegmenter, LineSegmenter};

use crate::thai;

/// Thai-only ICU4X data, written by `scripts/gen-icu-data.mjs` (never edit it by hand).
/// It has no Lao, Khmer or Burmese dictionary, so runs of those scripts get no break inside.
static ICU_DATA: &[u8] = include_bytes!("../data/icu-thai.postcard");

pub(crate) struct Segmenters {
    line: LineSegmenter,
    graphemes: GraphemeClusterSegmenter,
}

/// The segmenters built from `ICU_DATA`, once, or `None` if the data cannot be read.
pub(crate) fn segmenters() -> Option<&'static Segmenters> {
    static SEGMENTERS: OnceLock<Option<Segmenters>> = OnceLock::new();
    SEGMENTERS
        .get_or_init(|| {
            let provider = BlobDataProvider::try_new_from_static_blob(ICU_DATA).ok()?;
            Some(Segmenters {
                line: LineSegmenter::try_new_dictionary_with_buffer_provider(
                    &provider,
                    LineBreakOptions::default(),
                )
                .ok()?,
                graphemes: GraphemeClusterSegmenter::try_new_with_buffer_provider(&provider)
                    .ok()?,
            })
        })
        .as_ref()
}

/// Byte offsets inside `para` where the segmenter allows a break, without 0 and `para.len()`.
/// This is the UAX #14 line break opportunity list (ADR 0001); it never breaks before a space.
pub(crate) fn break_candidates(para: &str) -> impl Iterator<Item = usize> + '_ {
    segmenters()
        .into_iter()
        .flat_map(move |s| s.line.as_borrowed().segment_str(para))
        .filter(move |&b| b > 0 && b < para.len())
}

/// Grapheme cluster boundaries of `s`, including 0 and `s.len()`.
pub(crate) fn grapheme_boundaries(s: &str) -> impl Iterator<Item = usize> + '_ {
    segmenters()
        .into_iter()
        .flat_map(move |seg| seg.graphemes.as_borrowed().segment_str(s))
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
    // The line segmenter can also break inside a grapheme cluster, for example between a Thai
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

    #[test]
    fn the_embedded_data_should_load() {
        assert!(segmenters().is_some());
    }

    /// Line and grapheme boundaries that differ between the blob and compiled data, summed over `texts`.
    fn differences(texts: &str) -> usize {
        let seg = segmenters().unwrap();
        let line = LineSegmenter::new_dictionary(LineBreakOptions::default());
        let graphemes = GraphemeClusterSegmenter::new();
        texts
            .lines()
            .map(|t| {
                let pairs = [
                    (
                        seg.line.as_borrowed().segment_str(t).collect::<Vec<_>>(),
                        line.segment_str(t).collect::<Vec<_>>(),
                    ),
                    (
                        seg.graphemes.as_borrowed().segment_str(t).collect(),
                        graphemes.segment_str(t).collect(),
                    ),
                ];
                pairs
                    .iter()
                    .map(|(a, b)| {
                        a.iter().filter(|x| !b.contains(x)).count()
                            + b.iter().filter(|x| !a.contains(x)).count()
                    })
                    .sum::<usize>()
            })
            .sum()
    }

    #[test]
    fn embedded_data_should_match_compiled_data_except_lao_khmer_burmese() {
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let read = |p: &str| std::fs::read_to_string(format!("{root}/{p}")).unwrap();
        for name in [
            "corpus/wisesight/lines.txt",
            "corpus/wikipedia-th/lines.txt",
            "corpus/samples/matrix-inputs.txt",
            "corpus/samples/thai.txt",
            "corpus/samples/latin.txt",
            "corpus/samples/digits.txt",
            "corpus/samples/punct.txt",
            "corpus/samples/emoji.txt",
            "corpus/samples/cjk.txt",
        ] {
            let n = differences(&read(name));
            println!("{name}: {n} differences");
            assert_eq!(n, 0, "{name}");
        }
        // Unsupported on purpose (README "Unsupported scripts"): no Lao, Khmer or Burmese dictionary.
        // Observed with ICU4X 2.4.0: 5 differences in sea.txt.
        let sea = differences(&read("corpus/samples/sea.txt"));
        println!("corpus/samples/sea.txt: {sea} differences");
        assert!(sea > 0);
    }
}
