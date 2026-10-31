//! Where a line may break, by the Thai text rules in AGENTS.md.

/// Thai vowels and tone marks written above or below a consonant (U+0E31, U+0E34-U+0E3A,
/// U+0E47-U+0E4E). A line must not start with one: "ื่อสาร" is the broken tail of "สื่อสาร".
pub(crate) fn is_combining_mark(c: char) -> bool {
    matches!(c, '\u{0E31}' | '\u{0E34}'..='\u{0E3A}' | '\u{0E47}'..='\u{0E4E}')
}

/// Leading vowels เ แ โ ใ ไ (U+0E40-U+0E44) are written before the consonant they are
/// pronounced after, so they belong to the next character: "เก" must not end a line after "เ".
pub(crate) fn is_leading_vowel(c: char) -> bool {
    matches!(c, '\u{0E40}'..='\u{0E44}')
}

/// ะ า ำ ๆ ฯ attach to what comes before them, so they must not start a line:
/// "กา" must not become "ก" + "า", and "ดี ๆ" must not put "ๆ" on the next line.
pub(crate) fn is_no_line_start(c: char) -> bool {
    matches!(
        c,
        '\u{0E30}' | '\u{0E32}' | '\u{0E33}' | '\u{0E46}' | '\u{0E2F}'
    )
}

/// Spaces that separate words and are trimmed at line edges. ZWSP (U+200B) is one even
/// though it is not `White_Space`; Thai web text uses it as an invisible word separator.
/// No-break spaces (U+00A0, U+2007, U+202F) are content, not break opportunities.
pub(crate) fn is_break_space(c: char) -> bool {
    c == '\u{200B}' || (c.is_whitespace() && !matches!(c, '\u{00A0}' | '\u{2007}' | '\u{202F}'))
}

/// A character that shows up on screen. A line without one is a blank line.
pub(crate) fn is_visible(c: char) -> bool {
    !(c.is_whitespace() || c == '\u{200B}')
}

/// No-break spaces and joiners glue their neighbours together: "100\u{00A0}บาท" must stay on
/// one line. The rule lives here, where both segmenter breaks and overflow cuts are checked.
fn is_no_break(c: char) -> bool {
    matches!(
        c,
        '\u{00A0}' | '\u{2007}' | '\u{202F}' | '\u{2060}' | '\u{FEFF}'
    )
}

/// True if a line may break at byte `pos` of the paragraph `para`.
///
/// The Thai checks look past break spaces, because spaces at a break are trimmed: in "ดี ๆ"
/// a break after the space would still start the next line with "ๆ".
pub(crate) fn allowed(para: &str, pos: usize) -> bool {
    let (Some(before), Some(after)) = (para.get(..pos), para.get(pos..)) else {
        return false;
    };
    // A break always sits after the spaces, never before them, so neither a segmenter break
    // nor an overflow cut can start a line with a space ("ส่งมอบ| และ" is rejected).
    if after.chars().next().is_some_and(is_break_space) {
        return false;
    }
    if before.chars().next_back().is_some_and(is_no_break)
        || after.chars().next().is_some_and(is_no_break)
    {
        return false;
    }
    let prev = before.chars().rev().find(|&c| !is_break_space(c));
    let next = after.chars().find(|&c| !is_break_space(c));
    match (prev, next) {
        (Some(prev), Some(next)) => {
            !(is_combining_mark(next) || is_no_line_start(next) || is_leading_vowel(prev))
        }
        // A paragraph edge is not a soft break.
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(para: &str, before: &str) -> bool {
        allowed(para, before.len())
    }

    #[test]
    fn allowed_should_reject_break_before_combining_mark() {
        assert!(!at("สื่อ", "ส"));
    }
    #[test]
    fn allowed_should_reject_break_after_leading_vowel() {
        assert!(!at("เก", "เ"));
        assert!(!at("เ ก", "เ "));
    }
    #[test]
    fn allowed_should_reject_break_before_sara_aa() {
        assert!(!at("กา", "ก"));
    }
    #[test]
    fn allowed_should_reject_break_before_mai_yamok_across_space() {
        assert!(!at("ดี ๆ", "ดี "));
        assert!(!at("ดี ๆ", "ดี"));
    }
    #[test]
    fn allowed_should_reject_break_before_paiyannoi() {
        assert!(!at("กรุงเทพฯ", "กรุงเทพ"));
    }
    #[test]
    fn allowed_should_reject_break_before_mark_after_space() {
        assert!(!at("ก ่ข", "ก "));
    }
    #[test]
    fn allowed_should_accept_break_between_words() {
        assert!(at("ส่งมอบ", "ส่ง"));
        assert!(at("ส่งมอบ และ", "ส่งมอบ "));
    }
    #[test]
    fn allowed_should_accept_paragraph_edges() {
        assert!(at("  ก", "  "));
        assert!(at("ก  ", "ก  "));
    }
    #[test]
    fn allowed_should_reject_position_inside_a_char() {
        assert!(!allowed("ก", 1));
    }
    #[test]
    fn allowed_should_reject_break_before_a_space() {
        assert!(!at("ส่งมอบ และ", "ส่งมอบ"));
        assert!(!at("a \u{00A0}b", "a"));
    }
    #[test]
    fn allowed_should_reject_break_next_to_no_break_characters() {
        for c in ['\u{00A0}', '\u{2007}', '\u{202F}', '\u{2060}', '\u{FEFF}'] {
            let para = format!("100{c}บาท");
            assert!(!at(&para, "100"), "{c:?}");
            assert!(!at(&para, &format!("100{c}")), "{c:?}");
        }
    }
    #[test]
    fn break_space_should_include_zwsp_and_exclude_nbsp() {
        assert!(is_break_space('\u{200B}'));
        assert!(is_break_space(' '));
        assert!(!is_break_space('\u{00A0}'));
    }
    #[test]
    fn visible_should_exclude_nbsp_and_zwsp() {
        assert!(!is_visible('\u{00A0}'));
        assert!(!is_visible('\u{200B}'));
        assert!(is_visible('ก'));
    }
}
