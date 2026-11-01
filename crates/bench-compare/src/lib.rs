//! Benchmark harness that compares `thaiwrap-core` with other Thai segmenters.
//!
//! Segmentation-only tools are turned into wrappers by [`greedy_wrap`], which mirrors
//! `bench/lib/greedy.mjs` so the Rust and JS suites compare every tool on the same algorithm.

use std::error::Error;
use std::path::Path;

use icu_segmenter::options::WordBreakInvariantOptions;
use icu_segmenter::{WordSegmenter, WordSegmenterBorrowed};
use nlpo3::tokenizer::newmm::NewmmTokenizer;
use nlpo3::tokenizer::tokenizer_trait::Tokenizer as _;
use thaiwrap_core::WrapOptions;
use wordcut_engine::Wordcut;

/// Boxed error for tool construction and wrapping.
pub type BoxError = Box<dyn Error + Send + Sync>;

/// The compared tools, in report order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tool {
    /// `thaiwrap_core::wrap` with default options.
    ThaiwrapCore,
    /// ICU4X dictionary word segmenter + greedy wrapper.
    IcuGreedy,
    /// chamkho's engine (wordcut-engine) + greedy wrapper.
    ChamkhoGreedy,
    /// nlpo3 newmm + greedy wrapper.
    Nlpo3Greedy,
    /// thaibreak `Tokenizer` + greedy wrapper.
    ThaibreakGreedy,
    /// kham-core `Tokenizer` + greedy wrapper.
    KhamGreedy,
}

impl Tool {
    /// Every tool, in report order.
    pub const ALL: [Tool; 6] = [
        Tool::ThaiwrapCore,
        Tool::IcuGreedy,
        Tool::ChamkhoGreedy,
        Tool::Nlpo3Greedy,
        Tool::ThaibreakGreedy,
        Tool::KhamGreedy,
    ];

    /// Benchmark id prefix and output file prefix.
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Tool::ThaiwrapCore => "thaiwrap-core",
            Tool::IcuGreedy => "icu-greedy",
            Tool::ChamkhoGreedy => "chamkho-greedy",
            Tool::Nlpo3Greedy => "nlpo3-greedy",
            Tool::ThaibreakGreedy => "thaibreak-greedy",
            Tool::KhamGreedy => "kham-greedy",
        }
    }
}

/// Fixture sizes: name and path relative to the repository root.
pub const FIXTURES: [(&str, &str); 3] = [
    ("small", "bench/fixtures/small.txt"),
    ("medium", "bench/fixtures/medium.txt"),
    ("large", "bench/fixtures/wrapthai-test-50pages.txt"),
];

/// Max line lengths in the benchmark matrix.
pub const MAX_LENGTHS: [usize; 3] = [20, 40, 80];

/// Repository root, from this crate's manifest directory.
#[must_use]
pub fn repo_root() -> &'static Path {
    Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/../.."))
}

/// Reads a fixture by its size name.
///
/// # Errors
/// Fails if the size is unknown or the file cannot be read.
pub fn read_fixture(size: &str) -> Result<String, BoxError> {
    let (_, path) = FIXTURES
        .iter()
        .find(|(name, _)| *name == size)
        .ok_or_else(|| format!("unknown fixture size {size}"))?;
    Ok(std::fs::read_to_string(repo_root().join(path))?)
}

/// Pre-built segmentation state for every tool, so construction stays out of measured loops.
pub struct Tools {
    icu: WordSegmenterBorrowed<'static>,
    wordcut: Wordcut,
    newmm: NewmmTokenizer,
    thaibreak: thaibreak::Tokenizer,
    kham: kham_core::Tokenizer,
}

impl Tools {
    /// Builds every tool's dictionaries and segmenters.
    ///
    /// # Errors
    /// Fails if a dictionary or rule file cannot be loaded.
    pub fn new() -> Result<Self, BoxError> {
        let data = Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/data"));
        // Same defaults as the chamkho 1.5.0 CLI for Thai: its words_th.txt and Thai cluster rules
        // (wordcut-engine ships a byte-identical thai_cluster_rules.txt).
        let dict = wordcut_engine::load_dict(data.join("chamkho-words_th.txt"))?;
        let cluster_rules = wordcut_engine::thai_cluster_path().ok_or("no thai cluster rules")?;
        let cluster_re = wordcut_engine::load_cluster_rules(Path::new(&cluster_rules))?;
        let words_th = data.join("words_th.txt");
        let words_th = words_th.to_str().ok_or("non UTF-8 data path")?;
        // thaibreak::words() searches cwd-relative paths before its embedded dictionary, so
        // build the tokenizer from the embedded dictionary directly to make it cwd-independent.
        let thaibreak = thaibreak::Tokenizer::new(thaibreak::ThaiTrie::embedded()?, None);
        Ok(Self {
            icu: WordSegmenter::new_dictionary(WordBreakInvariantOptions::default()),
            wordcut: Wordcut::new_with_cluster_re(dict, cluster_re),
            newmm: NewmmTokenizer::new(words_th),
            thaibreak,
            kham: kham_core::Tokenizer::new(),
        })
    }

    /// Wraps `text` into lines of at most `max_length` UTF-16 code units with `tool`.
    ///
    /// # Errors
    /// Fails if the tool reports an error.
    pub fn wrap(&self, tool: Tool, text: &str, max_length: usize) -> Result<Vec<String>, BoxError> {
        match tool {
            // Owned strings, like the napi binding returns, so every tool allocates its lines.
            Tool::ThaiwrapCore => thaiwrap_core::wrap(text, max_length, &WrapOptions::default())?
                .into_iter()
                .map(|r| {
                    text.get(r)
                        .map(str::to_owned)
                        .ok_or_else(|| "line range is not on a char boundary".into())
                })
                .collect(),
            Tool::IcuGreedy => greedy_wrap(text, max_length, |p| Ok(self.icu_tokens(p))),
            Tool::ChamkhoGreedy => greedy_wrap(text, max_length, |p| {
                Ok(self.wordcut.segment_into_strings(p))
            }),
            Tool::Nlpo3Greedy => greedy_wrap(text, max_length, |p| {
                self.newmm.segment(p, false, false).map_err(Into::into)
            }),
            Tool::ThaibreakGreedy => {
                greedy_wrap(text, max_length, |p| Ok(self.thaibreak.tokenize(p, true)))
            }
            Tool::KhamGreedy => greedy_wrap(text, max_length, |p| {
                Ok(self.kham.segment(p).into_iter().map(|t| t.text).collect())
            }),
        }
    }

    fn icu_tokens<'p>(&self, para: &'p str) -> Vec<&'p str> {
        let mut start = 0;
        self.icu
            .segment_str(para)
            .filter(|&b| b > 0)
            .filter_map(|end| {
                let token = para.get(start..end);
                start = end;
                token
            })
            .collect()
    }
}

/// Length in UTF-16 code units, the same as JS `.length`.
#[must_use]
pub fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

/// Greedy line filling over the tokens of each paragraph, mirroring `bench/lib/greedy.mjs`.
///
/// Paragraphs are split on `'\n'`; whitespace-only paragraphs become `""` blank lines, except
/// before the first and after the last visible line. Every non-whitespace token is an atom that
/// is never cut. Two tokens on one line are joined by one space only where the input had
/// whitespace between them; otherwise they are joined directly, because Thai has no spaces
/// between words. U+200B is a break hint, not content, and is removed from tokens.
///
/// ```
/// let lines = bench_compare::greedy_wrap("aa bb cc", 5, |p| {
///     Ok(p.split_inclusive(' ').flat_map(|t| [t.trim_end(), " "]).collect::<Vec<_>>())
/// })
/// .unwrap();
/// assert_eq!(lines, ["aa bb", "cc"]);
/// ```
///
/// # Errors
/// Fails if `tokenize` fails.
pub fn greedy_wrap<'t, T, F>(
    text: &'t str,
    max_length: usize,
    mut tokenize: F,
) -> Result<Vec<String>, BoxError>
where
    T: AsRef<str>,
    F: FnMut(&'t str) -> Result<Vec<T>, BoxError>,
{
    let mut lines = Vec::new();
    let mut started = false;
    let mut pending_blank = false;
    for para in text.split('\n') {
        if para.trim().is_empty() {
            pending_blank |= started;
            continue;
        }
        if pending_blank {
            lines.push(String::new());
            pending_blank = false;
        }
        let mut current: Option<(String, usize)> = None;
        let mut gap = false;
        for token in tokenize(para)? {
            let token = token.as_ref();
            if token.trim().is_empty() {
                gap = true;
                continue;
            }
            let token = token.replace('\u{200B}', "");
            if token.is_empty() {
                continue;
            }
            let len = utf16_len(&token);
            let sep = usize::from(gap && current.is_some());
            current = Some(match current {
                None => (token, len),
                Some((mut line, line_len)) if line_len + sep + len <= max_length => {
                    if sep == 1 {
                        line.push(' ');
                    }
                    line.push_str(&token);
                    (line, line_len + sep + len)
                }
                Some((line, _)) => {
                    lines.push(line);
                    (token, len)
                }
            });
            gap = false;
        }
        lines.extend(current.map(|(line, _)| line));
        started = true;
    }
    Ok(lines)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn space_tokens(p: &str) -> Result<Vec<&str>, BoxError> {
        Ok(p.split_inclusive(' ')
            .flat_map(|t| [t.trim_end_matches(' '), " "])
            .collect())
    }

    #[test]
    fn greedy_wrap_should_keep_interior_blank_lines_and_drop_edge_ones() {
        let lines = greedy_wrap("\n \nab\n\n  \ncd\n\n", 10, space_tokens).unwrap();
        assert_eq!(lines, ["ab", "", "cd"]);
    }

    #[test]
    fn greedy_wrap_should_count_astral_chars_as_two_utf16_units() {
        // U+1F600 is one char but two UTF-16 code units: "a 😀" is 4 units.
        assert_eq!(greedy_wrap("a 😀", 4, space_tokens).unwrap(), ["a 😀"]);
        assert_eq!(greedy_wrap("a 😀", 3, space_tokens).unwrap(), ["a", "😀"]);
    }

    #[test]
    fn greedy_wrap_should_never_cut_inside_a_token() {
        let lines = greedy_wrap("abcdefgh ij", 3, space_tokens).unwrap();
        assert_eq!(lines, ["abcdefgh", "ij"]);
    }

    #[test]
    fn greedy_wrap_should_collapse_adjacent_spaces() {
        assert_eq!(greedy_wrap("a    b", 10, space_tokens).unwrap(), ["a b"]);
    }

    #[test]
    fn greedy_wrap_should_join_adjacent_tokens_without_inserting_a_space() {
        let chars = |p: &str| -> Result<Vec<String>, BoxError> {
            Ok(p.chars().map(String::from).collect())
        };
        assert_eq!(greedy_wrap("abcdef", 4, chars).unwrap(), ["abcd", "ef"]);
        // One space survives only where the input had whitespace, and it counts toward the width.
        assert_eq!(greedy_wrap("ab cd", 5, chars).unwrap(), ["ab cd"]);
        assert_eq!(greedy_wrap("ab cd", 4, chars).unwrap(), ["ab c", "d"]);
    }

    #[test]
    fn greedy_wrap_should_drop_zero_width_spaces_from_tokens() {
        let tokens =
            |_: &str| -> Result<Vec<&str>, BoxError> { Ok(vec!["ab\u{200B}", "\u{200B}", "cd"]) };
        assert_eq!(greedy_wrap("x", 4, tokens).unwrap(), ["abcd"]);
    }

    #[test]
    fn every_tool_should_wrap_the_acceptance_input() {
        let tools = Tools::new().unwrap();
        for tool in Tool::ALL {
            let lines = tools
                .wrap(tool, "กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า", 10)
                .unwrap();
            assert!(!lines.is_empty(), "{}", tool.name());
        }
    }
}
