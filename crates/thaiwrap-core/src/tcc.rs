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

/// A set of characters as bits, so that testing a character against a rule step is one AND.
/// The first four bits are the classes of `tcc_p.py`, the others one bit per character that a
/// rule names on its own.
type Set = u32;

/// A Thai consonant ก-ฮ (U+0E01-U+0E2E). It includes ฤ and ฦ and excludes ฯ.
const CONSONANT: Set = 1 << 0;
/// A tone mark ่ ้ ๊ ๋ (U+0E48-U+0E4B).
const TONE: Set = 1 << 1;
/// A leading vowel เ แ โ ใ ไ (U+0E40-U+0E44).
const LEADING: Set = 1 << 2;
/// ะ to ู (U+0E30-U+0E39), the `[ะ-ู]` range of rule 15.
const VOWEL: Set = 1 << 3;

/// The bit of a character that a rule names on its own, 0 for any other character.
const fn own_bit(c: char) -> Set {
    match c {
        'เ' => 1 << 4,
        'แ' => 1 << 5,
        'โ' => 1 << 6,
        '็' => 1 << 7,
        'า' => 1 << 8,
        'ะ' => 1 << 9,
        'ี' => 1 << 10,
        'ย' => 1 << 11,
        'ื' => 1 << 12,
        'อ' => 1 << 13,
        'ิ' => 1 << 14,
        'ุ' => 1 << 15,
        'ู' => 1 << 16,
        '์' => 1 << 17,
        'ั' => 1 << 18,
        'ว' => 1 << 19,
        'ร' => 1 << 20,
        'ึ' => 1 << 21,
        'ก' => 1 << 22,
        'ห' => 1 << 23,
        'ำ' => 1 << 24,
        _ => 0,
    }
}

/// Every set `c` belongs to.
const fn bits(c: char) -> Set {
    let class = match c {
        '\u{0E01}'..='\u{0E2E}' => CONSONANT,
        '\u{0E48}'..='\u{0E4B}' => TONE,
        '\u{0E40}'..='\u{0E44}' => LEADING,
        '\u{0E30}'..='\u{0E39}' => VOWEL,
        _ => 0,
    };
    class | own_bit(c)
}

/// One step of a rule.
#[derive(Clone, Copy)]
enum Step {
    /// One character from the set.
    One(Set),
    /// Optional and greedy, like regex `x?`.
    Opt(Set),
    /// The optional silent final that `tcc_p.py` writes as `k`, `(cc?[ุูิ]?์)?`: a consonant
    /// cancelled by ์ (การันต์), as in `สินทร์` = `สิ` + `นทร์`.
    Silent,
    /// Zero width: the next character is a consonant or a leading vowel, or the text ends.
    Ahead,
}

use Step::{Ahead, Opt, Silent};

const C: Step = Step::One(CONSONANT);
const T: Step = Opt(TONE);
const fn set(chars: &[char]) -> Set {
    let mut set = 0;
    let mut i = 0;
    while i < chars.len() {
        set |= own_bit(chars[i]);
        i += 1;
    }
    set
}
const fn ch(chars: &[char]) -> Step {
    Step::One(set(chars))
}
const fn opt(chars: &[char]) -> Step {
    Opt(set(chars))
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
    &[C, Step::One(VOWEL), T, Silent],                      // c[ะ-ู]tk
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
    &[Step::One(LEADING), C, T],                            // [เ-ไ]ct
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

/// Number of characters `rule` matches at the start of `chars`, given as `bits` of each one.
fn match_rule(chars: &[Set], rule: &[Step]) -> Option<usize> {
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
        Step::One(set) => first.filter(|&c| c & set != 0).and_then(|_| then(1)),
        Opt(set) => first
            .filter(|&c| c & set != 0)
            .and_then(|_| then(1))
            .or_else(|| match_rule(chars, rest)),
        Silent => SILENT
            .iter()
            .find_map(|shape| match_rule(chars, shape).and_then(then))
            .or_else(|| match_rule(chars, rest)),
        Ahead => first
            .is_none_or(|c| c & (CONSONANT | LEADING) != 0)
            .then(|| match_rule(chars, rest))
            .flatten(),
    }
}

/// False if `rule` cannot match at the start of `chars`: it checks the required steps that
/// open the rule, without trying the optional ones. Most clusters start with a consonant, and
/// most rules fail at their second step (`ก` followed by `ร` fails every rule that needs a
/// vowel mark there), so this skips most of the 29 rules without recursion.
fn can_start(rule: &[Step], chars: &[Set]) -> bool {
    rule.iter()
        .map_while(|step| match step {
            Step::One(set) => Some(set),
            _ => None,
        })
        .zip(chars)
        .all(|(set, c)| c & set != 0)
}

/// True if the first character of `chars` is a consonant that no rule extends, so it is a
/// cluster on its own. This is the common case, for example `ก`, `ร`, `บ` in `กระบวน`, and it
/// is decided without trying the rules. A rule can extend a consonant only with a vowel, a
/// tone mark, ็ or ์ right after it, or, when a consonant follows, with a silent final that
/// ends in ์ at most 4 characters from the start (`สินทร์`); anything else is a lone consonant.
fn is_lone_consonant(chars: &[Set]) -> bool {
    const SIGN: Set = own_bit('์');
    let [first, tail @ ..] = chars else {
        return false;
    };
    if first & CONSONANT == 0 {
        return false;
    }
    match tail {
        [] => true,
        [next, after @ ..] => {
            next & (TONE | VOWEL | own_bit('็') | SIGN) == 0
                && (next & CONSONANT == 0 || after.iter().take(3).all(|&c| c & SIGN == 0))
        }
    }
}

/// TCC cluster ends of `text` as byte offsets, ascending; the last one is `text.len()`.
/// A character that no rule matches (for example a Latin letter, a digit, or ๆ) is a cluster
/// on its own.
pub(crate) fn cluster_ends(text: &str) -> impl Iterator<Item = usize> + '_ {
    // One entry per char, so `text.len()` is an upper bound that avoids growing the vector.
    let mut chars: Vec<Set> = Vec::with_capacity(text.len());
    chars.extend(text.chars().map(bits));
    let mut at = 0usize;
    let mut end = 0usize;
    let mut tail = text;
    std::iter::from_fn(move || {
        let rest = chars.get(at..).filter(|rest| !rest.is_empty())?;
        // Every rule starts with a required character, so a match is never empty.
        let n = if is_lone_consonant(rest) {
            1
        } else {
            RULES
                .iter()
                .filter(|rule| can_start(rule, rest))
                .find_map(|rule| match_rule(rest, rule))
                .unwrap_or(1)
                .max(1)
        };
        let len: usize = tail.chars().take(n).map(char::len_utf8).sum();
        tail = tail.get(len..)?;
        at = at.saturating_add(n);
        end = end.saturating_add(len);
        Some(end)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clusters(text: &str) -> Vec<&str> {
        let mut start = 0;
        cluster_ends(text)
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
        assert_eq!(cluster_ends("").count(), 0);
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
                    .map(|end| line[..end].chars().count().to_string())
                    .collect();
                assert_eq!(got.join(" "), want, "{source} line {}", n + 1);
            }
        }
    }
}
