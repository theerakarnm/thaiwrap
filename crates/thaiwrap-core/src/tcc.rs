//! Thai Character Cluster (TCC) boundaries: the smallest groups of Thai characters that should
//! never be split. For example `เกี่ยว` is `เกี่ย` + `ว`, so an overflow cut may fall only
//! after `เกี่ย`, never inside it.
//!
//! The rules come from Theeramunkong, Sornlertlamvanich, Tanhermhong and Chinnan, "Character
//! cluster based Thai information retrieval", IRAL 2000, ACM, pp. 75-80,
//! doi:10.1145/355214.355225. The rule list and its order are ported from `PyThaiNLP` 5.4.0
//! `pythainlp/tokenize/tcc_p.py` (tag v5.4.0, commit 7f26adf5ce09c3d77c39ca2ef86f7138e9071088,
//! Apache-2.0), where the first rule that matches wins. `__test__/tcc.mjs` is a regex port of
//! the same file; the tests below compare against the fixtures it writes.

use crate::thai;

/// A character class in a TCC rule.
#[derive(Clone, Copy)]
enum Class {
    /// A Thai consonant ก-ฮ (U+0E01-U+0E2E). It includes ฤ and ฦ and excludes ฯ.
    Consonant,
    /// A tone mark ่ ้ ๊ ๋ (U+0E48-U+0E4B).
    Tone,
    /// A leading vowel เ แ โ ใ ไ (U+0E40-U+0E44).
    Leading,
    /// ะ to ู (U+0E30-U+0E39), the `[ะ-ู]` range of rule 15.
    Vowel,
    /// One of the listed characters.
    Any(&'static [char]),
}

impl Class {
    fn has(self, c: char) -> bool {
        match self {
            Self::Consonant => matches!(c, '\u{0E01}'..='\u{0E2E}'),
            Self::Tone => matches!(c, '\u{0E48}'..='\u{0E4B}'),
            Self::Leading => thai::is_leading_vowel(c),
            Self::Vowel => matches!(c, '\u{0E30}'..='\u{0E39}'),
            Self::Any(set) => set.contains(&c),
        }
    }
}

/// One step of a rule.
#[derive(Clone, Copy)]
enum Step {
    One(Class),
    /// Optional and greedy, like regex `x?`.
    Opt(Class),
    /// The optional silent final that `tcc_p.py` writes as `k`, `(cc?[ุูิ]?์)?`: a consonant
    /// cancelled by ์ (การันต์), as in `สินทร์` = `สิ` + `นทร์`.
    Silent,
    /// Zero width: the next character is a consonant or a leading vowel, or the text ends.
    Ahead,
}

use Step::{Ahead, Opt, Silent};

const C: Step = Step::One(Class::Consonant);
const T: Step = Opt(Class::Tone);
const fn ch(set: &'static [char]) -> Step {
    Step::One(Class::Any(set))
}
const fn opt(set: &'static [char]) -> Step {
    Opt(Class::Any(set))
}

/// `tcc_p.py` `_RE_TCC`, in order; the comment is the original pattern.
const RULES: [&[Step]; 29] = [
    &[ch(&['เ']), C, ch(&['็']), C, Silent],                 // เc็ck
    &[ch(&['เ']), C, C, T, ch(&['า']), ch(&['ะ']), Silent], // เcctาะk
    &[
        ch(&['เ']),
        C,
        C,
        ch(&['ี']),
        T,
        ch(&['ย']),
        ch(&['ะ']),
        Silent,
    ], // เccีtยะk
    &[ch(&['เ']), C, C, ch(&['ี']), T, ch(&['ย']), Ahead, Silent], // เccีtย(?=[เ-ไก-ฮ]|$)k
    &[ch(&['เ']), C, C, ch(&['็']), C, Silent],              // เcc็ck
    &[ch(&['เ']), C, ch(&['ิ']), C, ch(&['์']), C, Silent],   // เcิc์ck
    &[ch(&['เ']), C, ch(&['ิ']), T, C, Silent],              // เcิtck
    &[ch(&['เ']), C, ch(&['ี']), T, ch(&['ย']), opt(&['ะ']), Silent], // เcีtยะ?k
    &[ch(&['เ']), C, ch(&['ื']), T, ch(&['อ']), opt(&['ะ']), Silent], // เcืtอะ?k
    &[
        ch(&['เ']),
        C,
        ch(&['ิ', 'ี', 'ุ', 'ู']),
        T,
        ch(&['ย']),
        Ahead,
        Silent,
    ], // เc[ิีุู]tย(?=[เ-ไก-ฮ]|$)k
    &[ch(&['เ']), C, T, opt(&['า']), opt(&['ะ']), Silent],  // เctา?ะ?k
    &[C, ch(&['ั']), T, ch(&['ว']), ch(&['ะ']), Silent],     // cัtวะk
    &[C, ch(&['ั', 'ื']), T, C, opt(&['ุ', 'ิ', 'ะ']), Silent], // c[ัื]tc[ุิะ]?k
    &[C, ch(&['ิ', 'ุ', 'ู']), ch(&['์'])],                     // c[ิุู]์
    &[C, Step::One(Class::Vowel), T, Silent],               // c[ะ-ู]tk
    &[C, ch(&['ร']), ch(&['ร']), C, ch(&['์'])],             // cรรc์
    &[C, ch(&['็'])],                                        // c็
    &[C, T, opt(&['ะ', 'า', 'ำ']), Silent],                 // ct[ะาำ]?k
    &[C, Silent],                                           // ck
    &[ch(&['แ']), C, ch(&['็']), C],                         // แc็c
    &[ch(&['แ']), C, C, ch(&['์'])],                         // แcc์
    &[ch(&['แ']), C, T, ch(&['ะ'])],                        // แctะ
    &[ch(&['แ']), C, C, ch(&['็']), C],                      // แcc็c
    &[ch(&['แ']), C, C, C, ch(&['์'])],                      // แccc์
    &[ch(&['โ']), C, T, ch(&['ะ'])],                        // โctะ
    &[Step::One(Class::Leading), C, T],                     // [เ-ไ]ct
    &[ch(&['ก']), ch(&['็'])],                               // ก็
    &[ch(&['อ']), ch(&['ึ'])],                               // อึ
    &[ch(&['ห']), ch(&['ึ'])],                               // หึ
];

const LOWER_OR_I: &[char] = &['ุ', 'ู', 'ิ'];
/// The shapes of `Silent`, in the order a backtracking regex tries them.
const SILENT: [&[Step]; 4] = [
    &[C, C, ch(LOWER_OR_I), ch(&['์'])],
    &[C, C, ch(&['์'])],
    &[C, ch(LOWER_OR_I), ch(&['์'])],
    &[C, ch(&['์'])],
];

/// Number of characters `rule` matches at the start of `chars`.
fn match_rule(chars: &[char], rule: &[Step]) -> Option<usize> {
    let Some((step, rest)) = rule.split_first() else {
        return Some(0);
    };
    let first = chars.first().copied();
    let then = |n: usize| {
        chars
            .get(n..)
            .and_then(|tail| match_rule(tail, rest))
            .map(|m| m + n)
    };
    match *step {
        Step::One(class) => first.filter(|&c| class.has(c)).and_then(|_| then(1)),
        Opt(class) => first
            .filter(|&c| class.has(c))
            .and_then(|_| then(1))
            .or_else(|| match_rule(chars, rest)),
        Silent => SILENT
            .iter()
            .find_map(|shape| match_rule(chars, shape).and_then(then))
            .or_else(|| match_rule(chars, rest)),
        Ahead => first
            .is_none_or(|c| Class::Consonant.has(c) || Class::Leading.has(c))
            .then(|| match_rule(chars, rest))
            .flatten(),
    }
}

/// TCC cluster ends of `text` as byte offsets, ascending; the last one is `text.len()`.
/// A character that no rule matches (for example a Latin letter, a digit, or ๆ) is a cluster
/// on its own.
pub(crate) fn cluster_ends(text: &str) -> Vec<usize> {
    let chars: Vec<char> = text.chars().collect();
    let mut ends = Vec::new();
    let mut rest = chars.as_slice();
    let mut end = 0usize;
    while !rest.is_empty() {
        // Every rule starts with a required character, so a match is never empty.
        let n = RULES
            .iter()
            .find_map(|rule| match_rule(rest, rule))
            .unwrap_or(1)
            .max(1);
        let Some((cluster, tail)) = rest.split_at_checked(n) else {
            break;
        };
        end = cluster
            .iter()
            .fold(end, |e, c| e.saturating_add(c.len_utf8()));
        ends.push(end);
        rest = tail;
    }
    ends
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clusters(text: &str) -> Vec<&str> {
        let mut start = 0;
        cluster_ends(text)
            .into_iter()
            .map(|end| {
                let cluster = &text[start..end];
                start = end;
                cluster
            })
            .collect()
    }

    #[test]
    fn cluster_ends_should_match_tcc_p_on_known_words() {
        let rows: &[(&str, &[&str])] = &[
            ("สร้าง", &["ส", "ร้า", "ง"]),
            ("กระบวนการ", &["ก", "ระ", "บ", "ว", "น", "กา", "ร"]),
            ("คุณค่า", &["คุ", "ณ", "ค่า"]),
            ("สื่อสาร", &["สื่อ", "สา", "ร"]),
            ("เกี่ยว", &["เกี่ย", "ว"]),
            ("แม่น้ำ", &["แม่", "น้ำ"]),
            ("ไม่", &["ไม่"]),
            ("เปลี่ยน", &["เปลี่ย", "น"]),
            ("ประเทศไทย", &["ป", "ระ", "เท", "ศ", "ไท", "ย"]),
            ("นักบุญ", &["นัก", "บุ", "ญ"]),
            ("ราชบัณฑิตยสภา", &["รา", "ช", "บัณ", "ฑิ", "ต", "ย", "ส", "ภา"]),
            ("สงฺกฺรานฺติ", &["ส", "ง", "ฺ", "ก", "ฺ", "รา", "น", "ฺ", "ติ"]),
            ("๒๕๖๗", &["๒", "๕", "๖", "๗"]),
            ("กำลัง", &["กำ", "ลัง"]),
            ("เก็บ", &["เก็บ"]),
            ("สินทร์", &["สิ", "นทร์"]),
            ("ศักดิ์", &["ศักดิ์"]),
            ("จันทร์", &["จันทร์"]),
            ("พิสูจน์", &["พิ", "สูจน์"]),
            ("เกาะ", &["เกาะ"]),
            ("โต๊ะ", &["โต๊ะ"]),
            ("เลือก", &["เลือ", "ก"]),
            ("ฤๅษี", &["ฤ", "ๅ", "ษี"]),
            ("กรุงเทพฯ", &["ก", "รุ", "ง", "เท", "พ", "ฯ"]),
            ("ดีๆ", &["ดี", "ๆ"]),
            ("ฟังก์ชัน", &["ฟังก์", "ชัน"]),
            ("คอมพิวเตอร์", &["ค", "อ", "ม", "พิ", "ว", "เตอร์"]),
            ("สวัสดีครับ", &["ส", "วัส", "ดี", "ค", "รับ"]),
            ("มหาวิทยาลัย", &["ม", "หา", "วิ", "ท", "ยา", "ลัย"]),
            ("ไทย123abc", &["ไท", "ย", "1", "2", "3", "a", "b", "c"]),
            ("ะกา", &["ะ", "กา"]),
            ("เ", &["เ"]),
            ("เปลี่ย", &["เปลี่ย"]),
            ("เปลี๊ยะ", &["เปลี๊ยะ"]),
            ("เกรียะ", &["เกรียะ"]),
        ];
        for (text, want) in rows {
            assert_eq!(clusters(text), *want, "{text}");
        }
    }

    #[test]
    fn cluster_ends_should_be_empty_for_empty_text() {
        assert_eq!(cluster_ends(""), Vec::<usize>::new());
    }

    #[test]
    fn cluster_ends_should_match_the_js_reference_on_both_corpora() {
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        for source in ["wisesight", "wikipedia-th"] {
            let lines =
                std::fs::read_to_string(format!("{root}/corpus/{source}/lines.txt")).unwrap();
            let reference =
                std::fs::read_to_string(format!("{root}/corpus/{source}/derived/tcc-ends.txt"))
                    .unwrap();
            assert_eq!(lines.lines().count(), reference.lines().count(), "{source}");
            for (n, (line, want)) in lines.lines().zip(reference.lines()).enumerate() {
                let got: Vec<String> = cluster_ends(line)
                    .into_iter()
                    .map(|end| line[..end].chars().count().to_string())
                    .collect();
                assert_eq!(got.join(" "), want, "{source} line {}", n + 1);
            }
        }
    }
}
