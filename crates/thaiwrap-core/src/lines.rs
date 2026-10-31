//! Splitting text at hard line breaks.
use std::ops::Range;

/// The mandatory breaks of UAX #14 (BK, CR, LF, NL). CRLF counts as one break.
fn is_hard_break(c: char) -> bool {
    matches!(
        c,
        '\n' | '\u{000B}' | '\u{000C}' | '\r' | '\u{0085}' | '\u{2028}' | '\u{2029}'
    )
}

/// Paragraph ranges. A final break adds no empty line: `""` gives none, `"a\n"` gives one,
/// `"a\n\nb"` gives three (the middle one empty).
pub(crate) fn split_lines(text: &str) -> impl Iterator<Item = Range<usize>> + '_ {
    let mut chars = text.char_indices().peekable();
    let mut start = 0;
    std::iter::from_fn(move || {
        while let Some((i, c)) = chars.next() {
            if is_hard_break(c) {
                let line = start..i;
                start = i + c.len_utf8();
                if c == '\r' && chars.next_if(|&(_, next)| next == '\n').is_some() {
                    start += 1;
                }
                return Some(line);
            }
        }
        (start < text.len()).then(|| {
            let line = start..text.len();
            start = text.len();
            line
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parts(text: &str) -> Vec<&str> {
        split_lines(text).map(|r| &text[r]).collect()
    }

    #[test]
    fn split_lines_should_return_nothing_for_empty_text() {
        assert_eq!(parts(""), Vec::<&str>::new());
    }
    #[test]
    fn split_lines_should_not_add_a_line_for_a_final_terminator() {
        assert_eq!(parts("ก\n"), ["ก"]);
    }
    #[test]
    fn split_lines_should_keep_inner_empty_lines() {
        assert_eq!(parts("ก\n\n\nข"), ["ก", "", "", "ข"]);
    }
    #[test]
    fn split_lines_should_treat_crlf_as_one_break() {
        assert_eq!(parts("ก\r\n\r\nข\n"), ["ก", "", "ข"]);
    }
    #[test]
    fn split_lines_should_split_on_every_mandatory_break() {
        assert_eq!(
            parts("a\rb\u{0B}c\u{0C}d\u{85}e\u{2028}f\u{2029}g"),
            ["a", "b", "c", "d", "e", "f", "g"]
        );
    }
    #[test]
    fn split_lines_should_return_two_empty_lines_for_two_newlines() {
        assert_eq!(parts("\n\n"), ["", ""]);
    }
}
