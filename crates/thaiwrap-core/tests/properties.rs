//! Property tests. The Thai rule predicates below are a deliberate second copy of
//! `thai.rs`, so a bug there cannot hide itself.
use std::ops::Range;
use std::sync::OnceLock;

use icu_segmenter::options::WordBreakInvariantOptions;
use icu_segmenter::{GraphemeClusterSegmenter, WordSegmenter, WordSegmenterBorrowed};
use proptest::prelude::*;
use thaiwrap_core::{wrap, Measure, Overflow, WrapOptions};

const CONSONANTS: &[char] = &[
    'ก', 'ข', 'ค', 'ง', 'จ', 'ช', 'ด', 'ต', 'ท', 'น', 'บ', 'ป', 'พ', 'ม', 'ย', 'ร', 'ล', 'ว', 'ส',
    'ห', 'อ',
];
const LEADING: &[char] = &['เ', 'แ', 'โ', 'ใ', 'ไ'];
const MARKS: &[char] = &['ั', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', '่', '้', '๊', '๋', '็', '์'];
const FOLLOWING: &[char] = &['ะ', 'า', 'ำ'];
const SPECIAL: &[&str] = &[
    " ",
    "  ",
    "\n",
    "\r\n",
    "\n\n",
    "\u{200B}",
    "\u{00A0}",
    "👍",
    "👨‍👩‍👧",
    "!",
    "(",
    ")",
    ",",
    "ๆ",
    " ๆ",
    "ฯ",
    "่",
    "1,250.50",
    "๒๕๖๗",
    "\u{00AD}",
    " \u{200E}",
    "\u{0301}",
    "\u{200D}",
    "\u{FE0F}",
];
const MEASURES: &[Measure] = &[Measure::CodeUnits, Measure::Graphemes];
const OVERFLOWS: &[Overflow] = &[Overflow::Split, Overflow::Keep];

fn cluster() -> impl Strategy<Value = String> {
    (
        prop::option::of(prop::sample::select(LEADING)),
        prop::sample::select(CONSONANTS),
        prop::collection::vec(prop::sample::select(MARKS), 0..=2),
        prop::option::of(prop::sample::select(FOLLOWING)),
    )
        .prop_map(|(l, c, m, f)| l.into_iter().chain([c]).chain(m).chain(f).collect())
}

fn piece() -> impl Strategy<Value = String> {
    prop_oneof![
        6 => prop::collection::vec(cluster(), 1..=4).prop_map(|v| v.concat()),
        2 => "[a-zA-Z]{1,8}",
        1 => "[0-9]{1,6}",
        2 => Just(" ".to_string()),
        2 => prop::sample::select(SPECIAL).prop_map(str::to_string),
    ]
}

fn text() -> impl Strategy<Value = String> {
    prop::collection::vec(piece(), 0..40).prop_map(|v| v.concat())
}

fn measure_strategy() -> impl Strategy<Value = Measure> {
    prop::sample::select(MEASURES)
}

fn overflow_strategy() -> impl Strategy<Value = Overflow> {
    prop::sample::select(OVERFLOWS)
}

// Test-local copies of the Thai rules (AGENTS.md rules 1-3, and D7 for no-break characters).

fn is_combining_mark(c: char) -> bool {
    matches!(c, '\u{0E31}' | '\u{0E34}'..='\u{0E3A}' | '\u{0E47}'..='\u{0E4E}')
}

fn is_leading_vowel(c: char) -> bool {
    matches!(c, 'เ' | 'แ' | 'โ' | 'ใ' | 'ไ')
}

fn is_no_line_start(c: char) -> bool {
    matches!(c, 'ะ' | 'า' | 'ำ' | 'ๆ' | 'ฯ')
}

fn is_no_break_char(c: char) -> bool {
    matches!(
        c,
        '\u{00A0}' | '\u{2007}' | '\u{202F}' | '\u{2060}' | '\u{FEFF}'
    )
}

fn is_break_space(c: char) -> bool {
    c == '\u{200B}' || (c.is_whitespace() && !matches!(c, '\u{00A0}' | '\u{2007}' | '\u{202F}'))
}

fn is_visible(c: char) -> bool {
    !(c.is_whitespace() || c == '\u{200B}')
}

fn is_hard_break(c: char) -> bool {
    matches!(
        c,
        '\n' | '\u{000B}' | '\u{000C}' | '\r' | '\u{0085}' | '\u{2028}' | '\u{2029}'
    )
}

/// May a line break at byte `pos` of the paragraph `para`?
fn allowed(para: &str, pos: usize) -> bool {
    let (Some(before), Some(after)) = (para.get(..pos), para.get(pos..)) else {
        return false;
    };
    let (last, first) = (before.chars().next_back(), after.chars().next());
    if first.is_some_and(is_break_space) {
        return false;
    }
    if last.is_some_and(is_no_break_char) || first.is_some_and(is_no_break_char) {
        return false;
    }
    let prev = before.chars().rev().find(|&c| !is_break_space(c));
    let next = after.chars().find(|&c| !is_break_space(c));
    match (prev, next) {
        (Some(prev), Some(next)) => {
            !(is_combining_mark(next) || is_no_line_start(next) || is_leading_vowel(prev))
        }
        _ => true,
    }
}

/// Paragraph ranges, split at the hard breaks of D8; a final break adds no empty paragraph.
fn paragraphs(text: &str) -> Vec<Range<usize>> {
    let mut out = Vec::new();
    let mut chars = text.char_indices().peekable();
    let mut start = 0;
    while let Some((i, c)) = chars.next() {
        if is_hard_break(c) {
            out.push(start..i);
            start = i + c.len_utf8();
            if c == '\r' && chars.next_if(|&(_, next)| next == '\n').is_some() {
                start += 1;
            }
        }
    }
    if start < text.len() {
        out.push(start..text.len());
    }
    out
}

fn word_segmenter() -> &'static WordSegmenterBorrowed<'static> {
    static SEGMENTER: OnceLock<WordSegmenterBorrowed<'static>> = OnceLock::new();
    SEGMENTER.get_or_init(|| WordSegmenter::new_dictionary(WordBreakInvariantOptions::default()))
}

fn grapheme_boundaries(s: &str) -> Vec<usize> {
    GraphemeClusterSegmenter::new().segment_str(s).collect()
}

fn measure_of(s: &str, measure: Measure) -> usize {
    match measure {
        Measure::Graphemes if s.is_empty() => 0,
        Measure::Graphemes => grapheme_boundaries(s).len() - 1,
        _ => s.encode_utf16().count(),
    }
}

fn options(measure: Measure, overflow: Overflow) -> WrapOptions {
    let mut o = WrapOptions::default();
    o.measure = measure;
    o.overflow = overflow;
    o
}

fn run(text: &str, max: usize, o: &WrapOptions) -> Vec<Range<usize>> {
    wrap(text, max, o).unwrap()
}

fn is_soft_break(text: &str, prev: &Range<usize>, next: &Range<usize>) -> bool {
    text.get(prev.end..next.start)
        .is_some_and(|gap| !gap.chars().any(is_hard_break))
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1024))]

    // P1: soft breaks never start a line with a mark or ะ า ำ ๆ ฯ, nor inside a grapheme cluster,
    // nor end it with เ แ โ ใ ไ.
    #[test]
    fn wrap_should_obey_thai_rules_at_every_soft_break(
        text in text(), max in 1usize..=40, measure in measure_strategy(), overflow in overflow_strategy(),
    ) {
        let lines = run(&text, max, &options(measure, overflow));
        for pair in lines.windows(2) {
            let (prev, next) = (&pair[0], &pair[1]);
            if prev.is_empty() || next.is_empty() || !is_soft_break(&text, prev, next) {
                continue;
            }
            let first = text[next.clone()].chars().next().unwrap();
            let last = text[prev.clone()].chars().next_back().unwrap();
            prop_assert!(
                !(is_combining_mark(first) || is_no_line_start(first)),
                "line starts with {first:?}: text={text:?} max={max} {measure:?} {overflow:?} lines={lines:?}"
            );
            prop_assert!(
                !is_leading_vowel(last),
                "line ends with {last:?}: text={text:?} max={max} {measure:?} {overflow:?} lines={lines:?}"
            );
            let para = paragraphs(&text)
                .into_iter()
                .find(|p| p.start <= next.start && next.start < p.end)
                .unwrap();
            let offset = next.start - para.start;
            prop_assert!(
                grapheme_boundaries(&text[para]).contains(&offset),
                "line starts inside a grapheme cluster: text={text:?} max={max} {measure:?} {overflow:?} lines={lines:?}"
            );
        }
    }

    // P2: every line fits, unless it holds one unit with no legal cut inside.
    #[test]
    fn wrap_should_fit_every_line_unless_it_cannot_be_cut(
        text in text(), max in 1usize..=40, measure in measure_strategy(), overflow in overflow_strategy(),
    ) {
        let lines = run(&text, max, &options(measure, overflow));
        let paras = paragraphs(&text);
        for line in lines.iter().filter(|l| !l.is_empty()) {
            if measure_of(&text[line.clone()], measure) <= max {
                continue;
            }
            let para = paras
                .iter()
                .find(|p| p.start <= line.start && line.end <= p.end)
                .unwrap();
            let para_text = &text[para.clone()];
            let (start, end) = (line.start - para.start, line.end - para.start);
            let graphemes = grapheme_boundaries(para_text);
            let cuts: Vec<usize> = match overflow {
                Overflow::Keep => word_segmenter()
                    .segment_str(para_text)
                    .filter(|b| graphemes.contains(b))
                    .collect(),
                _ => graphemes,
            };
            let legal = cuts.into_iter().find(|&b| b > start && b < end && allowed(para_text, b));
            prop_assert!(
                legal.is_none(),
                "line {line:?} is too long but can be cut at {legal:?}: text={text:?} max={max} {measure:?} {overflow:?} lines={lines:?}"
            );
        }
    }

    // P3: ranges are ordered and disjoint, and only spaces fall outside them.
    #[test]
    fn wrap_should_not_lose_text(
        text in text(), max in 1usize..=40, measure in measure_strategy(), overflow in overflow_strategy(),
    ) {
        let lines = run(&text, max, &options(measure, overflow));
        for pair in lines.windows(2) {
            prop_assert!(
                pair[0].end <= pair[1].start && pair[0].start < pair[1].start,
                "ranges overlap: text={text:?} max={max} lines={lines:?}"
            );
        }
        let mut covered = vec![false; text.len()];
        for line in &lines {
            prop_assert!(
                !text[line.clone()].chars().any(is_hard_break),
                "range holds a hard break: text={text:?} max={max} lines={lines:?}"
            );
            covered[line.clone()].fill(true);
        }
        for (i, c) in text.char_indices() {
            prop_assert!(
                covered[i] || c.is_whitespace() || c == '\u{200B}',
                "{c:?} at {i} is lost: text={text:?} max={max} {measure:?} {overflow:?} lines={lines:?}"
            );
        }
    }

    // P4: no line starts or ends with a break space.
    #[test]
    fn wrap_should_trim_both_edges_of_every_line(
        text in text(), max in 1usize..=40, measure in measure_strategy(), overflow in overflow_strategy(),
    ) {
        for line in run(&text, max, &options(measure, overflow)) {
            let s = &text[line];
            prop_assert!(
                !(s.starts_with(is_break_space) || s.ends_with(is_break_space)),
                "untrimmed line {s:?}: text={text:?} max={max} {measure:?} {overflow:?}"
            );
        }
    }

    // P5: a line that already fits is a fixed point.
    #[test]
    fn wrap_should_leave_a_line_that_fits_unchanged(
        text in text(), max in 1usize..=40, measure in measure_strategy(), overflow in overflow_strategy(),
    ) {
        let o = options(measure, overflow);
        for line in run(&text, max, &o).into_iter().filter(|l| !l.is_empty()) {
            let s = &text[line];
            if measure_of(s, measure) <= max {
                prop_assert_eq!(
                    run(s, max, &o),
                    vec![0..s.len()],
                    "line {:?} changes when wrapped alone: text={:?} max={} {:?} {:?}",
                    s, text, max, measure, overflow
                );
            }
        }
    }

    // P6: every range is on char boundaries.
    #[test]
    fn wrap_should_return_ranges_on_char_boundaries(
        text in text(), max in 1usize..=40, measure in measure_strategy(), overflow in overflow_strategy(),
    ) {
        for line in run(&text, max, &options(measure, overflow)) {
            prop_assert!(
                line.start <= line.end
                    && line.end <= text.len()
                    && text.is_char_boundary(line.start)
                    && text.is_char_boundary(line.end),
                "bad range {line:?}: text={text:?} max={max}"
            );
        }
    }

    // P8: no soft break next to a no-break space or joiner.
    #[test]
    fn wrap_should_not_break_next_to_no_break_characters(
        text in text(), max in 1usize..=40, measure in measure_strategy(), overflow in overflow_strategy(),
    ) {
        let lines = run(&text, max, &options(measure, overflow));
        for pair in lines.windows(2) {
            let (prev, next) = (&pair[0], &pair[1]);
            if prev.is_empty() || next.is_empty() || !is_soft_break(&text, prev, next) {
                continue;
            }
            let pos = next.start;
            let before = text[..pos].chars().next_back().unwrap();
            let after = text[pos..].chars().next().unwrap();
            prop_assert!(
                !is_no_break_char(before) && !is_no_break_char(after),
                "break at {pos} between {before:?} and {after:?}: text={text:?} max={max} {measure:?} {overflow:?} lines={lines:?}"
            );
        }
    }

    // P7: blank paragraphs between visible lines stay, edges are dropped, nothing else is empty.
    #[test]
    fn wrap_should_keep_blank_lines_between_visible_lines_only(
        text in text(), max in 1usize..=40, measure in measure_strategy(), overflow in overflow_strategy(),
    ) {
        let lines = run(&text, max, &options(measure, overflow));
        prop_assert!(
            lines.first().is_none_or(|l| !l.is_empty()) && lines.last().is_none_or(|l| !l.is_empty()),
            "blank edge: text={text:?} max={max} lines={lines:?}"
        );
        let paras = paragraphs(&text);
        let visible: Vec<bool> = paras.iter().map(|p| text[p.clone()].chars().any(is_visible)).collect();
        let first = visible.iter().position(|&v| v);
        let last = visible.iter().rposition(|&v| v);
        let expected_blank = match (first, last) {
            (Some(f), Some(l)) => visible[f..=l].iter().filter(|&&v| !v).count(),
            _ => 0,
        };
        let blank = lines.iter().filter(|l| l.is_empty()).count();
        prop_assert_eq!(
            blank, expected_blank,
            "blank line count: text={:?} max={} {:?} {:?} lines={:?}",
            text, max, measure, overflow, lines
        );
        if first.is_none() {
            prop_assert!(lines.is_empty(), "invisible input gave lines: text={text:?} lines={lines:?}");
        }
        // Each blank line sits in a blank paragraph, in order.
        let blank_paras: Vec<usize> = (0..paras.len())
            .filter(|&i| !visible[i] && first.is_some_and(|f| i > f) && last.is_some_and(|l| i < l))
            .collect();
        let blank_starts: Vec<usize> = lines.iter().filter(|l| l.is_empty()).map(|l| l.start).collect();
        let expected_starts: Vec<usize> = blank_paras.iter().map(|&i| paras[i].start).collect();
        prop_assert_eq!(
            blank_starts, expected_starts,
            "blank line positions: text={:?} max={} {:?} {:?} lines={:?}",
            text, max, measure, overflow, lines
        );
    }
}
