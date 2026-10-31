//! M0.2: compares the break positions of the word segmenter (used in v0.1) with the UAX #14
//! line segmenter and writes the report that ADR 0001 is decided on.
//!
//! Run with `cargo test -p thaiwrap-core --lib compare_segmenters -- --ignored --nocapture`.
use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;
use std::fs;

use icu_segmenter::options::LineBreakOptions;
use icu_segmenter::{LineSegmenter, LineSegmenterBorrowed};

use crate::{lines, segment, thai};

/// Every input string of `tests/matrix.rs`, including the ones printed by `print_observed_rows`.
const MATRIX_INPUTS: [&str; 45] = [
    "กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า",
    "ที่",
    "ก\u{0301}ข",
    "กข\u{200D}ค",
    "ไทย\u{FE0F}ดี",
    "กา",
    "กำ",
    "เกเก",
    "abc",
    "supercalifragilistic",
    "👨\u{200d}👩\u{200d}👧",
    "ใช้ React กับ TypeScript",
    "ราคา 1,250.50 บาท",
    "👍👍👍",
    "👨\u{200d}👩\u{200d}👧 ok",
    "😰😰😰์",
    "เด็กๆ เล่น",
    "กรุงเทพฯ เป็นเมืองหลวง",
    "่ก",
    "ก ่ข",
    "ส่งมอบ\u{200b}และ",
    "ส่งมอบ   และ",
    "  สวัสดี  ",
    "บรรทัดแรก\nบรรทัดสอง",
    "ก   \n   ข",
    "",
    "   ",
    "\n\n",
    "ก\n\nข",
    "\n\nก\n\n",
    "ก\n\n\nข",
    "ก\r\n\r\nข\n",
    "ก\u{a0}ข",
    "ราคา 100\u{a0}บาท",
    "\u{a0} \u{a0}",
    "a \u{a0}b",
    "ก \u{a0} ข",
    "x\n\u{a0} ก",
    "ก\n \n\u{a0}\nข",
    " \n\u{a0}\n\u{200b}",
    "สวัสดี! (ภาษาไทย)",
    "ปี๒๕๖๗",
    "แชท คัดลอก",
    "ของดี ๆ มีเยอะ",
    "ผัก ผลไม้ ฯลฯ",
];

const EXAMPLES_PER_PATTERN: usize = 5;
const CONTEXT_CHARS: usize = 10;
/// Rows with examples per group in the markdown report; the CSV files hold every difference.
const PATTERNS_SHOWN_B: usize = 150;
const PATTERNS_SHOWN_A: usize = 30;

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Side {
    WordOnly,
    LineOnly,
}

impl Side {
    fn label(self) -> &'static str {
        match self {
            Self::WordOnly => "word-only",
            Self::LineOnly => "line-only",
        }
    }
}

/// One position where exactly one of the two segmenters reports a break.
struct Diff {
    source: &'static str,
    /// 1-based line of `lines.txt`, or 1-based index in `MATRIX_INPUTS`.
    line: usize,
    /// Byte offset in that line or input.
    offset: usize,
    side: Side,
    thai: bool,
    subcategory: &'static str,
    /// `Some(rule)` for group (a): `segment::units` drops the position, so no output changes.
    reason: Option<&'static str>,
    prev: char,
    next: char,
    context: String,
}

impl Diff {
    fn script(&self) -> &'static str {
        if self.thai {
            "Thai"
        } else {
            "non-Thai"
        }
    }
    fn group(&self) -> char {
        if self.reason.is_some() {
            'a'
        } else {
            'b'
        }
    }
    fn example(&self) -> String {
        match self.source {
            "wikipedia-th" => format!("wikipedia-th:{}:{}", self.line, self.offset),
            source => format!("{} ({source}:{})", code_span(&self.context), self.line),
        }
    }
}

#[derive(Default)]
struct Source {
    name: &'static str,
    inputs: usize,
    paragraphs: usize,
    diffs: Vec<Diff>,
}

fn is_thai(c: char) -> bool {
    matches!(c, '\u{0E01}'..='\u{0E3A}' | '\u{0E40}'..='\u{0E4E}' | '\u{0E50}'..='\u{0E59}')
}

/// Same set as the private `thai::is_no_break`.
fn is_no_break(c: char) -> bool {
    matches!(
        c,
        '\u{00A0}' | '\u{2007}' | '\u{202F}' | '\u{2060}' | '\u{FEFF}'
    )
}

fn is_punctuation(c: char) -> bool {
    c.is_ascii_punctuation() || "“”‘’…«»()[]{}".contains(c)
}

fn is_latin_or_digit(c: char) -> bool {
    c.is_ascii_alphanumeric()
}

fn is_symbol(c: char) -> bool {
    !c.is_ascii() && !is_thai(c) && !c.is_alphabetic()
}

/// Sub-category of a non-Thai difference, from the two neighbour characters.
fn subcategory(prev: Option<char>, next: Option<char>) -> &'static str {
    let (Some(a), Some(b)) = (prev, next) else {
        return "other";
    };
    if (is_thai(a) && is_latin_or_digit(b)) || (is_latin_or_digit(a) && is_thai(b)) {
        "Thai|Latin-or-digit"
    } else if is_punctuation(a) || is_punctuation(b) {
        "punctuation"
    } else if is_symbol(a) || is_symbol(b) {
        "emoji-or-symbol"
    } else {
        "other"
    }
}

/// The rule that removes `pos` from `segment::units`: `grapheme` first (the position is
/// inside a grapheme cluster), then the rules of `thai::allowed` in the order of that function.
fn rejected_by(para: &str, pos: usize, graphemes: &BTreeSet<usize>) -> Option<&'static str> {
    if !graphemes.contains(&pos) {
        return Some("grapheme");
    }
    if thai::allowed(para, pos) {
        return None;
    }
    let before = para.get(..pos).unwrap_or_default();
    let after = para.get(pos..).unwrap_or_default();
    if after.chars().next().is_some_and(thai::is_break_space) {
        Some("space-normalization")
    } else if before.chars().next_back().is_some_and(is_no_break)
        || after.chars().next().is_some_and(is_no_break)
    {
        Some("no-break")
    } else {
        Some("thai-filter")
    }
}

/// Printable form of one character; invisible ones show their code point, and so does the
/// em dash, which repo rules keep out of Markdown files.
fn show(c: char) -> String {
    let invisible = c.is_control()
        || (c.is_whitespace() && c != ' ')
        || matches!(
            c,
            '\u{200B}'..='\u{200F}' | '\u{2014}' | '\u{2060}' | '\u{FEFF}' | '\u{00AD}'
        );
    if invisible {
        format!("⟦U+{:04X}⟧", u32::from(c))
    } else if thai::is_combining_mark(c) {
        format!("◌{c}")
    } else {
        c.to_string()
    }
}

fn show_all(s: &str) -> String {
    s.chars().map(show).collect()
}

fn context(para: &str, pos: usize) -> String {
    let before: Vec<char> = para
        .get(..pos)
        .unwrap_or_default()
        .chars()
        .rev()
        .take(CONTEXT_CHARS)
        .collect();
    let after = para
        .get(pos..)
        .unwrap_or_default()
        .chars()
        .take(CONTEXT_CHARS);
    let mut out: String = before.into_iter().rev().map(show).collect();
    out.push_str("⟨|⟩");
    out.extend(after.map(show));
    out
}

/// Markdown code span that survives backticks in the text.
fn code_span(text: &str) -> String {
    let longest = text
        .split(|c| c != '`')
        .map(str::len)
        .max()
        .unwrap_or_default();
    let fence = "`".repeat(longest + 1);
    format!("{fence} {text} {fence}")
}

/// Table cell text: the `|` of `Thai|Latin-or-digit` must not end the cell.
fn cell(text: &str) -> String {
    text.replace('|', "\\|")
}

fn csv_field(text: &str) -> String {
    format!("\"{}\"", text.replace('"', "\"\""))
}

/// Differences of one paragraph. `base` is the paragraph's byte offset in its line.
fn paragraph_diffs(
    source: &'static str,
    line: usize,
    base: usize,
    para: &str,
    line_segmenter: &LineSegmenterBorrowed<'_>,
) -> Vec<Diff> {
    let words: BTreeSet<usize> = segment::break_candidates(para).collect();
    let line_breaks: BTreeSet<usize> = line_segmenter
        .segment_str(para)
        .filter(|&b| b > 0 && b < para.len())
        .collect();
    let graphemes: BTreeSet<usize> = segment::grapheme_boundaries(para).collect();
    words
        .symmetric_difference(&line_breaks)
        .map(|&pos| {
            let before = para.get(..pos).unwrap_or_default();
            let after = para.get(pos..).unwrap_or_default();
            let near_before = before.chars().rev().find(|&c| !thai::is_break_space(c));
            let near_after = after.chars().find(|&c| !thai::is_break_space(c));
            let thai = near_before.is_some_and(is_thai) && near_after.is_some_and(is_thai);
            Diff {
                source,
                line,
                offset: base + pos,
                side: if words.contains(&pos) {
                    Side::WordOnly
                } else {
                    Side::LineOnly
                },
                thai,
                subcategory: if thai {
                    "Thai|Thai"
                } else {
                    subcategory(near_before, near_after)
                },
                reason: rejected_by(para, pos, &graphemes),
                prev: before.chars().next_back().unwrap_or(' '),
                next: after.chars().next().unwrap_or(' '),
                context: context(para, pos),
            }
        })
        .collect()
}

fn compare_input(
    source: &mut Source,
    line: usize,
    text: &str,
    line_segmenter: &LineSegmenterBorrowed<'_>,
) {
    source.inputs += 1;
    for range in lines::split_lines(text) {
        source.paragraphs += 1;
        if let Some(para) = text.get(range.clone()) {
            let diffs = paragraph_diffs(source.name, line, range.start, para, line_segmenter);
            source.diffs.extend(diffs);
        }
    }
}

fn compare_corpus(
    name: &'static str,
    root: &str,
    line_segmenter: &LineSegmenterBorrowed<'_>,
) -> Source {
    let text = fs::read_to_string(format!("{root}/corpus/{name}/lines.txt")).unwrap();
    let mut source = Source {
        name,
        ..Source::default()
    };
    for (index, line) in text.split('\n').enumerate().filter(|(_, l)| !l.is_empty()) {
        compare_input(&mut source, index + 1, line, line_segmenter);
    }
    source
}

fn compare_matrix(line_segmenter: &LineSegmenterBorrowed<'_>) -> Source {
    let mut source = Source {
        name: "matrix",
        ..Source::default()
    };
    for (index, text) in MATRIX_INPUTS.iter().enumerate() {
        compare_input(&mut source, index + 1, text, line_segmenter);
    }
    source
}

fn write_csv(path: &str, source: &Source) {
    let mut out = String::new();
    let header = [
        "line",
        "byte_offset",
        "side",
        "script",
        "subcategory",
        "group",
        "group_reason",
        "context",
    ];
    out.push_str(&header.map(csv_field).join(","));
    out.push('\n');
    for d in &source.diffs {
        let row = [
            d.line.to_string(),
            d.offset.to_string(),
            d.side.label().to_string(),
            d.script().to_string(),
            d.subcategory.to_string(),
            d.group().to_string(),
            d.reason.unwrap_or("none").to_string(),
            d.context.clone(),
        ];
        out.push_str(&row.map(|f| csv_field(&f)).join(","));
        out.push('\n');
    }
    fs::create_dir_all(std::path::Path::new(path).parent().unwrap()).unwrap();
    fs::write(path, out).unwrap();
}

type PatternKey = (bool, &'static str, Side, char, char);

struct Pattern {
    count: usize,
    examples: Vec<String>,
}

fn patterns(sources: &[Source], group: char) -> Vec<(PatternKey, Pattern)> {
    let mut map: BTreeMap<PatternKey, Pattern> = BTreeMap::new();
    for d in sources
        .iter()
        .flat_map(|s| &s.diffs)
        .filter(|d| d.group() == group)
    {
        let entry = map
            .entry((d.thai, d.subcategory, d.side, d.prev, d.next))
            .or_insert_with(|| Pattern {
                count: 0,
                examples: Vec::new(),
            });
        entry.count += 1;
        if entry.examples.len() < EXAMPLES_PER_PATTERN {
            entry.examples.push(d.example());
        }
    }
    let mut sorted: Vec<_> = map.into_iter().collect();
    sorted.sort_by(|a, b| b.1.count.cmp(&a.1.count).then(a.0.cmp(&b.0)));
    sorted
}

fn count(sources: &[Source], keep: impl Fn(&Diff) -> bool) -> usize {
    sources
        .iter()
        .flat_map(|s| &s.diffs)
        .filter(|d| keep(d))
        .count()
}

fn write_summary(out: &mut String, sources: &[Source]) {
    let inputs: usize = sources.iter().map(|s| s.inputs).sum();
    let paragraphs: usize = sources.iter().map(|s| s.paragraphs).sum();
    let per_source: Vec<String> = sources
        .iter()
        .map(|s| format!("{} {}", s.name, s.inputs))
        .collect();
    out.push_str("## Summary\n\n");
    writeln!(
        out,
        "Compared {inputs} inputs ({}) and {paragraphs} paragraphs.\n",
        per_source.join(", ")
    )
    .unwrap();
    out.push_str("| Script | (a) removed by filter | (b) remain |\n|---|---|---|\n");
    for (label, thai) in [("Thai", true), ("non-Thai", false)] {
        let a = count(sources, |d| d.thai == thai && d.group() == 'a');
        let b = count(sources, |d| d.thai == thai && d.group() == 'b');
        writeln!(out, "| {label} | {a} | {b} |").unwrap();
    }
    out.push_str("\nGroup (a) by rule:\n\n| Rule | Count |\n|---|---|\n");
    for rule in ["grapheme", "space-normalization", "no-break", "thai-filter"] {
        let n = count(sources, |d| d.reason == Some(rule));
        writeln!(out, "| {rule} | {n} |").unwrap();
    }
    out.push_str(
        "\nGroup (b) by side and sub-category:\n\n| Side | Sub-category | Count |\n|---|---|---|\n",
    );
    let mut cells: BTreeMap<(Side, &str), usize> = BTreeMap::new();
    for d in sources
        .iter()
        .flat_map(|s| &s.diffs)
        .filter(|d| d.group() == 'b')
    {
        *cells.entry((d.side, d.subcategory)).or_default() += 1;
    }
    for ((side, sub), n) in cells {
        writeln!(out, "| {} | {} | {n} |", side.label(), cell(sub)).unwrap();
    }
    out.push('\n');
}

fn glyph(c: char) -> String {
    if c == ' ' {
        "␠".to_string()
    } else {
        show(c)
    }
}

/// The most frequent patterns get a row with examples; the long tail is rolled up by
/// script, sub-category and side, because every difference is in the CSV files anyway.
fn write_patterns(out: &mut String, sources: &[Source], group: char, shown: usize) {
    let all = patterns(sources, group);
    for (index, ((thai, sub, side, prev, next), pattern)) in all.iter().take(shown).enumerate() {
        let script = if *thai { "Thai" } else { "non-Thai" };
        writeln!(
            out,
            "{}. {script} / {sub} / {} / before {} / after {} - {} occurrences",
            index + 1,
            side.label(),
            code_span(&glyph(*prev)),
            code_span(&glyph(*next)),
            pattern.count
        )
        .unwrap();
        for example in &pattern.examples {
            writeln!(out, "    - {example}").unwrap();
        }
    }
    let mut tail: BTreeMap<(bool, &str, Side), (usize, usize)> = BTreeMap::new();
    for ((thai, sub, side, _, _), pattern) in all.iter().skip(shown) {
        let cell = tail.entry((*thai, sub, *side)).or_default();
        cell.0 += 1;
        cell.1 += pattern.count;
    }
    if !tail.is_empty() {
        writeln!(
            out,
            "\nThe other {} patterns, rolled up:\n\n| Script | Sub-category | Side | Patterns | Occurrences |\n|---|---|---|---|---|",
            all.len().saturating_sub(shown)
        )
        .unwrap();
        for ((thai, sub, side), (patterns, occurrences)) in tail {
            let script = if thai { "Thai" } else { "non-Thai" };
            writeln!(
                out,
                "| {script} | {sub} | {} | {patterns} | {occurrences} |",
                side.label()
            )
            .unwrap();
        }
    }
    out.push('\n');
}

fn write_matrix(out: &mut String, matrix: &Source) {
    out.push_str("## Differences in the matrix inputs\n\n");
    if matrix.diffs.is_empty() {
        out.push_str("None.\n");
        return;
    }
    for d in &matrix.diffs {
        let input = MATRIX_INPUTS.get(d.line - 1).copied().unwrap_or_default();
        let group = match d.reason {
            Some(rule) => format!("(a) {rule}"),
            None => "(b)".to_string(),
        };
        writeln!(
            out,
            "- input #{} {}: byte {}, {}, {} / {}, group {group}, {}",
            d.line,
            code_span(&show_all(input)),
            d.offset,
            d.side.label(),
            d.script(),
            d.subcategory,
            code_span(&d.context)
        )
        .unwrap();
    }
}

fn render(sources: &[Source]) -> String {
    let matrix = sources.iter().find(|s| s.name == "matrix");
    let mut out = String::from("# Word segmenter and line segmenter: M0.2 comparison\n\n");
    out.push_str(
        "Generated by `cargo test -p thaiwrap-core --lib compare_segmenters -- --ignored`.\n\
         Do not edit by hand.\n\n\
         The comparison uses raw break positions and is strict.\n\
         For each paragraph it takes the break positions of `WordSegmenter::new_dictionary` and of `LineSegmenter::new_dictionary` (positions 0 and the end removed) and reports every position that only one of them returns.\n\
         Group (a) is every difference that `segment::units` drops, so it cannot change any output line.\n\
         The rule that drops it is named: `grapheme` (the position is inside a grapheme cluster, for example between a letter and U+0301, ZWJ or U+FE0F), `space-normalization` (the position is followed by a break space), `no-break` (next to NBSP, U+2007, U+202F, U+2060 or U+FEFF), or `thai-filter` (Thai rules 1-3).\n\
         Group (b) is everything else, and those differences change the wrapped output.\n\
         \"Thai\" means the nearest non-space character on both sides is Thai; otherwise the difference is \"non-Thai\" with a sub-category.\n\
         The markdown lists the most frequent patterns with examples; the rest are rolled up, and every difference is in the CSV files `corpus/<source>/derived/segmenter-diffs.csv`.\n\
         In examples, `⟨|⟩` marks the position and `◌` marks a combining mark shown alone.\n\n",
    );
    write_summary(&mut out, sources);
    out.push_str("## Group (b): differences that remain after the filter\n\n");
    write_patterns(&mut out, sources, 'b', PATTERNS_SHOWN_B);
    out.push_str("## Group (a): differences the filter removes\n\n");
    write_patterns(&mut out, sources, 'a', PATTERNS_SHOWN_A);
    if let Some(matrix) = matrix {
        write_matrix(&mut out, matrix);
    }
    out
}

#[test]
#[ignore = "writes docs/m0/segmenter-comparison.md"]
fn compare_segmenters_should_write_the_report() {
    let root = format!("{}/../..", env!("CARGO_MANIFEST_DIR"));
    let line_segmenter = LineSegmenter::new_dictionary(LineBreakOptions::default());
    let sources = vec![
        compare_corpus("wisesight", &root, &line_segmenter),
        compare_corpus("wikipedia-th", &root, &line_segmenter),
        compare_matrix(&line_segmenter),
    ];
    for source in sources.iter().filter(|s| s.name != "matrix") {
        write_csv(
            &format!("{root}/corpus/{}/derived/segmenter-diffs.csv", source.name),
            source,
        );
    }
    fs::create_dir_all(format!("{root}/docs/m0")).unwrap();
    fs::write(
        format!("{root}/docs/m0/segmenter-comparison.md"),
        render(&sources),
    )
    .unwrap();

    let corpus: usize = sources
        .iter()
        .filter(|s| s.name != "matrix")
        .map(|s| s.diffs.len())
        .sum();
    let matrix = sources
        .iter()
        .find(|s| s.name == "matrix")
        .map_or(0, |s| s.diffs.len());
    println!(
        "differences: corpus={corpus} matrix={matrix} total={}",
        corpus + matrix
    );
}
