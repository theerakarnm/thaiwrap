use thaiwrap_core::{wrap, Measure, Overflow, WrapError, WrapOptions};

fn opts(measure: Measure, overflow: Overflow) -> WrapOptions {
    let mut o = WrapOptions::default();
    o.measure = measure;
    o.overflow = overflow;
    o
}

fn lines(text: &str, max: usize, o: WrapOptions) -> Vec<&str> {
    wrap(text, max, &o)
        .unwrap()
        .into_iter()
        .map(|r| &text[r])
        .collect()
}

fn default_lines(text: &str, max: usize) -> Vec<&str> {
    lines(text, max, WrapOptions::default())
}

/// Thai marks and ะ า ำ ๆ ฯ: no line may start with one.
fn is_no_line_start(c: char) -> bool {
    matches!(
        c,
        '\u{0E31}'
            | '\u{0E34}'..='\u{0E3A}'
            | '\u{0E47}'..='\u{0E4E}'
            | '\u{0E30}'
            | '\u{0E32}'
            | '\u{0E33}'
            | '\u{0E46}'
            | '\u{0E2F}'
    )
}

/// Thai rules 1-3 on every line: no line starts with a mark or ะ า ำ ๆ ฯ, and none ends with a leading vowel.
fn assert_thai_line_rules(lines: &[&str]) {
    for line in lines {
        assert!(
            !line.starts_with(is_no_line_start),
            "line starts with a mark or ะ า ำ ๆ ฯ: {line}"
        );
        assert!(
            !line.ends_with(['เ', 'แ', 'โ', 'ใ', 'ไ']),
            "line ends with a leading vowel: {line}"
        );
    }
}

/// Characters that continue the grapheme cluster before them, so no line may start with one.
fn continues_grapheme(c: char) -> bool {
    matches!(c, '\u{0300}'..='\u{036F}' | '\u{200D}' | '\u{FE00}'..='\u{FE0F}')
}

const ACCEPTANCE: &str = "กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า";
const DEFAULT: (Measure, Overflow) = (Measure::CodeUnits, Overflow::Split);

#[test]
fn acceptance_text_should_wrap_at_words_at_ten_code_units() {
    assert_eq!(
        default_lines(ACCEPTANCE, 10),
        ["กระบวนการ", "สื่อสาร", "ส่งมอบ และ", "สร้าง", "คุณค่า"]
    );
}

#[test]
fn graphemes_should_count_marks_with_their_consonant() {
    assert_eq!(
        lines(ACCEPTANCE, 10, opts(Measure::Graphemes, Overflow::Split)),
        ["กระบวนการ", "สื่อสาร ส่ง", "มอบ และ", "สร้างคุณค่า"]
    );
}

#[test]
fn naive_slice_regression_should_never_start_a_line_with_a_mark() {
    for max in 1..=40 {
        for measure in [Measure::CodeUnits, Measure::Graphemes] {
            for overflow in [Overflow::Split, Overflow::Keep] {
                for line in lines(ACCEPTANCE, max, opts(measure, overflow)) {
                    assert!(
                        !line.chars().next().is_some_and(is_no_line_start),
                        "max {max}: {line:?}"
                    );
                    assert_ne!(line, "ื่อสาร ส่ง", "max {max}");
                }
            }
        }
    }
}

#[test]
fn split_should_cut_long_words_only_where_thai_rules_allow() {
    assert_eq!(
        lines(ACCEPTANCE, 4, opts(DEFAULT.0, DEFAULT.1)),
        [
            "กระบ",
            "วนกา",
            "ร",
            "สื่อ",
            "สาร",
            "ส่ง",
            "มอบ",
            "และ",
            "สร้า",
            "ง",
            "คุณ",
            "ค่า"
        ]
    );
}

#[test]
fn keep_should_leave_long_words_whole() {
    assert_eq!(
        lines(ACCEPTANCE, 4, opts(Measure::CodeUnits, Overflow::Keep)),
        ["กระบวนการ", "สื่อสาร", "ส่ง", "มอบ", "และ", "สร้าง", "คุณค่า"]
    );
}

#[test]
fn huge_max_length_should_keep_the_text_on_one_line() {
    assert_eq!(
        default_lines(ACCEPTANCE, 2_147_483_648),
        ["กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า"]
    );
}

#[test]
fn one_unsplittable_grapheme_should_exceed_max_length_alone() {
    assert_eq!(default_lines("ที่", 1), ["ที่"]);
}

#[test]
fn leading_vowel_and_no_line_start_letters_should_stay_with_their_neighbour() {
    assert_eq!(default_lines("กา", 1), ["กา"]);
    assert_eq!(default_lines("กำ", 1), ["กำ"]);
    assert_eq!(default_lines("เกเก", 1), ["เก", "เก"]);
}

#[test]
fn latin_words_should_split_per_character_or_stay_whole_with_keep() {
    assert_eq!(default_lines("abc", 1), ["a", "b", "c"]);
    assert_eq!(
        lines("abc", 1, opts(Measure::CodeUnits, Overflow::Keep)),
        ["abc"]
    );
    assert_eq!(
        default_lines("supercalifragilistic", 5),
        ["super", "calif", "ragil", "istic"]
    );
}

#[test]
fn family_emoji_should_stay_one_grapheme() {
    assert_eq!(default_lines("👨‍👩‍👧", 2), ["👨‍👩‍👧"]);
}

#[test]
fn mixed_latin_and_thai_should_break_at_spaces() {
    assert_eq!(
        default_lines("ใช้ React กับ TypeScript", 10),
        ["ใช้ React", "กับ", "TypeScript"]
    );
}

#[test]
fn numbers_with_separators_should_stay_whole() {
    assert_eq!(
        default_lines("ราคา 1,250.50 บาท", 10),
        ["ราคา", "1,250.50", "บาท"]
    );
}

#[test]
fn emoji_should_split_between_graphemes() {
    assert_eq!(default_lines("👍👍👍", 4), ["👍👍", "👍"]);
}

#[test]
fn family_emoji_should_count_as_one_grapheme() {
    assert_eq!(
        lines("👨‍👩‍👧 ok", 4, opts(Measure::Graphemes, Overflow::Split)),
        ["👨‍👩‍👧 ok"]
    );
}

#[test]
fn corpus_emoji_with_thanthakhat_should_not_start_a_line_with_the_mark() {
    assert_eq!(default_lines("😰😰😰์", 2), ["😰", "😰", "😰์"]);
}

#[test]
fn maiyamok_should_stay_with_its_word() {
    assert_eq!(default_lines("เด็กๆ เล่น", 5), ["เด็กๆ", "เล่น"]);
}

#[test]
fn paiyannoi_should_stay_with_its_word() {
    assert_eq!(default_lines("กรุงเทพฯ เป็นเมืองหลวง", 8)[0], "กรุงเทพฯ");
}

#[test]
fn input_start_should_be_kept_as_written() {
    assert_eq!(default_lines("่ก", 10), ["่ก"]);
}

#[test]
fn a_leading_vowel_before_a_space_should_stay_with_the_next_character() {
    assert_eq!(default_lines("เ ก", 1), ["เ ก"]);
}

#[test]
fn a_space_before_a_soft_hyphen_should_be_trimmed_from_the_line_end() {
    assert_eq!(default_lines("ab \u{00AD}cd", 3), ["ab", "\u{00AD}cd"]);
}

#[test]
fn the_last_chunk_of_a_split_word_should_take_the_next_unit() {
    assert_eq!(default_lines("abcdef g", 4), ["abcd", "ef g"]);
}

#[test]
fn a_mark_after_a_space_should_stay_on_the_line_of_the_space() {
    assert_eq!(default_lines("ก ่ข", 1), ["ก ่", "ข"]);
}

#[test]
fn zero_width_space_should_be_a_break_space() {
    assert_eq!(default_lines("ส่งมอบ\u{200B}และ", 6), ["ส่งมอบ", "และ"]);
}

#[test]
fn interior_spaces_should_be_kept_when_the_line_fits() {
    assert_eq!(default_lines("ส่งมอบ   และ", 20), ["ส่งมอบ   และ"]);
}

#[test]
fn interior_spaces_should_be_trimmed_at_a_wrap() {
    assert_eq!(default_lines("ส่งมอบ   และ", 6), ["ส่งมอบ", "และ"]);
}

#[test]
fn edge_spaces_should_be_trimmed() {
    assert_eq!(default_lines("  สวัสดี  ", 20), ["สวัสดี"]);
}

#[test]
fn line_feed_should_end_a_line() {
    assert_eq!(
        default_lines("บรรทัดแรก\nบรรทัดสอง", 50),
        ["บรรทัดแรก", "บรรทัดสอง"]
    );
}

#[test]
fn spaces_around_a_line_feed_should_be_trimmed() {
    assert_eq!(default_lines("ก   \n   ข", 10), ["ก", "ข"]);
}

#[test]
fn empty_text_should_give_no_lines() {
    assert_eq!(default_lines("", 10), Vec::<&str>::new());
}

#[test]
fn spaces_only_should_give_no_lines() {
    assert_eq!(default_lines("   ", 10), Vec::<&str>::new());
}

#[test]
fn line_feeds_only_should_give_no_lines() {
    assert_eq!(default_lines("\n\n", 10), Vec::<&str>::new());
}

#[test]
fn one_blank_line_between_paragraphs_should_be_kept() {
    assert_eq!(default_lines("ก\n\nข", 10), ["ก", "", "ข"]);
}

#[test]
fn blank_lines_at_the_edges_should_be_dropped() {
    assert_eq!(default_lines("\n\nก\n\n", 10), ["ก"]);
}

#[test]
fn several_blank_lines_between_paragraphs_should_not_be_collapsed() {
    assert_eq!(default_lines("ก\n\n\nข", 10), ["ก", "", "", "ข"]);
}

#[test]
fn crlf_should_be_one_line_break() {
    assert_eq!(default_lines("ก\r\n\r\nข\n", 10), ["ก", "", "ข"]);
}

#[test]
fn no_break_space_should_never_break() {
    assert_eq!(default_lines("ก\u{00A0}ข", 1), ["ก\u{00A0}ข"]);
}

#[test]
fn no_break_space_should_keep_its_neighbours_on_one_line() {
    assert_eq!(
        default_lines("ราคา 100\u{00A0}บาท", 8),
        ["ราคา", "100\u{00A0}บาท"]
    );
}

#[test]
fn no_break_space_and_spaces_only_should_give_no_lines() {
    assert_eq!(default_lines("\u{00A0} \u{00A0}", 1), Vec::<&str>::new());
}

#[test]
fn a_space_next_to_no_break_space_should_not_be_a_cut() {
    assert_eq!(default_lines("a \u{00A0}b", 2), ["a \u{00A0}b"]);
}

#[test]
fn a_cut_after_a_space_before_no_break_space_should_be_kept_when_legal() {
    assert_eq!(default_lines("ก \u{00A0} ข", 1), ["ก \u{00A0}", "ข"]);
}

#[test]
fn a_soft_wrapped_line_with_no_visible_character_should_be_dropped() {
    assert_eq!(default_lines("x\n\u{00A0} ก", 2), ["x", "ก"]);
}

#[test]
fn blank_looking_paragraphs_should_become_empty_lines() {
    assert_eq!(default_lines("ก\n \n\u{00A0}\nข", 10), ["ก", "", "", "ข"]);
}

#[test]
fn blank_looking_text_only_should_give_no_lines() {
    assert_eq!(
        default_lines(" \n\u{00A0}\n\u{200B}", 10),
        Vec::<&str>::new()
    );
}

fn assert_no_line_starts_inside_a_cluster(text: &str, max: usize, expected: &[&str]) {
    let got = default_lines(text, max);
    assert!(
        got.iter().all(|l| !l.starts_with(continues_grapheme)),
        "{text:?}: {got:?}"
    );
    assert_eq!(got, expected, "{text:?}");
}

#[test]
fn a_combining_mark_from_another_script_should_stay_with_its_letter() {
    assert_no_line_starts_inside_a_cluster("ก\u{0301}ข", 1, &["ก\u{0301}", "ข"]);
}

#[test]
fn a_zero_width_joiner_should_stay_with_the_letter_before_it() {
    assert_no_line_starts_inside_a_cluster("กข\u{200D}ค", 2, &["ก", "ข\u{200D}", "ค"]);
}

#[test]
fn a_variation_selector_should_stay_with_the_letter_before_it() {
    assert_no_line_starts_inside_a_cluster("ไทย\u{FE0F}ดี", 1, &["ไท", "ย\u{FE0F}", "ดี"]);
}

#[test]
fn a_mark_after_a_thai_letter_should_count_with_it_in_graphemes() {
    assert_eq!(
        lines("ก\u{0301}ข", 2, opts(Measure::Graphemes, Overflow::Split)),
        ["ก\u{0301}ข"]
    );
}

#[test]
fn max_length_zero_should_be_an_error() {
    assert_eq!(
        wrap("ก", 0, &WrapOptions::default()),
        Err(WrapError::InvalidMaxLength)
    );
}

#[test]
#[ignore = "prints observed output for 🔍 rows"]
fn print_observed_rows() {
    for (text, max, o) in [
        ("สวัสดี! (ภาษาไทย)", 8, opts(DEFAULT.0, DEFAULT.1)),
        ("ปี๒๕๖๗", 3, opts(DEFAULT.0, DEFAULT.1)),
        ("แชท คัดลอก", 3, opts(DEFAULT.0, DEFAULT.1)),
        ("ของดี ๆ มีเยอะ", 5, opts(DEFAULT.0, DEFAULT.1)),
        ("กรุงเทพฯ เป็นเมืองหลวง", 8, opts(DEFAULT.0, DEFAULT.1)),
        ("ผัก ผลไม้ ฯลฯ", 10, opts(DEFAULT.0, DEFAULT.1)),
    ] {
        println!("{text} {max} -> {}", lines(text, max, o).join(" | "));
    }
}

#[test]
fn observed_m2_exclamation_and_paren_should_match_recorded_output() {
    let got = lines("สวัสดี! (ภาษาไทย)", 8, opts(DEFAULT.0, DEFAULT.1));
    assert_thai_line_rules(&got);
    assert_eq!(got, vec!["สวัสดี!", "(ภาษา", "ไทย)"]);
}

#[test]
fn observed_m4_thai_digits_should_match_recorded_output() {
    let got = lines("ปี๒๕๖๗", 3, opts(DEFAULT.0, DEFAULT.1));
    assert_thai_line_rules(&got);
    assert_eq!(got, vec!["ปี๒", "๕๖๗"]);
}

#[test]
fn observed_m7_chat_should_match_recorded_output() {
    let got = lines("แชท คัดลอก", 3, opts(DEFAULT.0, DEFAULT.1));
    assert_thai_line_rules(&got);
    assert_eq!(got, vec!["แชท", "คัด", "ลอก"]);
}

#[test]
fn observed_t2_maiyamok_after_space_should_match_recorded_output() {
    let got = lines("ของดี ๆ มีเยอะ", 5, opts(DEFAULT.0, DEFAULT.1));
    assert_thai_line_rules(&got);
    assert!(got.iter().all(|l| !l.starts_with('ๆ')));
    assert!(got.contains(&"ดี ๆ"));
    assert_eq!(got, vec!["ของ", "ดี ๆ", "มี", "เยอะ"]);
}

#[test]
fn observed_t3_rest_should_match_recorded_output() {
    let got = lines("กรุงเทพฯ เป็นเมืองหลวง", 8, opts(DEFAULT.0, DEFAULT.1));
    assert_thai_line_rules(&got);
    assert_eq!(got[0], "กรุงเทพฯ");
    assert_eq!(got, vec!["กรุงเทพฯ", "เป็น", "เมือง", "หลวง"]);
}

#[test]
fn observed_t4_paiyannoi_etc_should_match_recorded_output() {
    let got = lines("ผัก ผลไม้ ฯลฯ", 10, opts(DEFAULT.0, DEFAULT.1));
    assert_thai_line_rules(&got);
    assert!(got.iter().all(|l| !l.starts_with('ฯ')));
    assert_eq!(got, vec!["ผัก ผล", "ไม้ ฯลฯ"]);
}
