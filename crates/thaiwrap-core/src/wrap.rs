//! Greedy line filling.
use std::ops::Range;

use crate::measure::measure;
use crate::{lines, segment, thai, Overflow, WrapError, WrapOptions};

/// Wrap `text` into lines of at most `max_length`, breaking only where the segmenter
/// and the Thai text rules allow.
///
/// Returns byte ranges into `text`, in order. An empty range is a blank line.
/// A line is longer than `max_length` only when it holds one unit that cannot be split
/// (for example "ที่", one grapheme of 3 code units, with `max_length` 1), or one word with
/// [`Overflow::Keep`].
///
/// ```
/// use thaiwrap_core::{wrap, WrapOptions};
/// let text = "กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า";
/// let lines: Vec<&str> = wrap(text, 10, &WrapOptions::default())?
///     .into_iter()
///     .filter_map(|r| text.get(r))
///     .collect();
/// assert_eq!(lines, ["กระบวนการ", "สื่อสาร", "ส่งมอบ และ", "สร้าง", "คุณค่า"]);
/// # Ok::<(), thaiwrap_core::WrapError>(())
/// ```
///
/// # Errors
///
/// [`WrapError::InvalidMaxLength`] if `max_length` is 0.
pub fn wrap(
    text: &str,
    max_length: usize,
    options: &WrapOptions,
) -> Result<Vec<Range<usize>>, WrapError> {
    if max_length == 0 {
        return Err(WrapError::InvalidMaxLength);
    }
    let mut out = Vec::new();
    for para in lines::split_lines(text) {
        let before = out.len();
        if let Some(para_text) = text.get(para.clone()) {
            Paragraph {
                text: para_text,
                base: para.start,
                max_length,
                options,
                out: &mut out,
            }
            .wrap();
        }
        if out.len() == before {
            out.push(para.start..para.start);
        }
    }
    drop_blank_edges(&mut out);
    Ok(out)
}

/// Blank lines before the first and after the last visible line are dropped; the ones
/// between visible lines stay. So `"\n\nก\n\n"` gives `["ก"]` and `"   "` gives `[]`.
fn drop_blank_edges(out: &mut Vec<Range<usize>>) {
    let first = out.iter().position(|r| !r.is_empty()).unwrap_or(out.len());
    out.drain(..first);
    let end = out.iter().rposition(|r| !r.is_empty()).map_or(0, |i| i + 1);
    out.truncate(end);
}

struct Line {
    range: Range<usize>,
    len: usize,
}

struct Paragraph<'a> {
    text: &'a str,
    base: usize,
    max_length: usize,
    options: &'a WrapOptions,
    out: &'a mut Vec<Range<usize>>,
}

impl Paragraph<'_> {
    fn wrap(mut self) {
        let text = self.text;
        let mut line: Option<Line> = None;
        let mut gap = 0;
        for unit in segment::units(text) {
            if unit.content.is_empty() {
                continue;
            }
            let width = self.measure(unit.content.clone());
            line = Some(match line.take() {
                Some(mut current)
                    if current.len.saturating_add(gap).saturating_add(width) <= self.max_length =>
                {
                    current.range.end = unit.content.end;
                    current.len = current.len.saturating_add(gap).saturating_add(width);
                    current
                }
                Some(current) => {
                    self.push(current.range);
                    self.start_line(unit.content, width)
                }
                None => self.start_line(unit.content, width),
            });
            gap = self.measure(unit.trailing);
        }
        if let Some(current) = line {
            self.push(current.range);
        }
    }

    fn start_line(&mut self, content: Range<usize>, width: usize) -> Line {
        if width <= self.max_length || self.options.overflow == Overflow::Keep {
            return Line {
                range: content,
                len: width,
            };
        }
        let mut chunks = self.split_overflow(content.clone());
        let last = chunks.pop().unwrap_or(Line {
            range: content,
            len: width,
        });
        for chunk in chunks {
            self.push(chunk.range);
        }
        last
    }

    /// Cut one too-long unit at grapheme boundaries that pass the Thai rules, greedily.
    /// A piece with no legal cut inside stays whole, even if it is longer than `max_length`.
    fn split_overflow(&self, content: Range<usize>) -> Vec<Line> {
        let text = self.text;
        let Some(word) = text.get(content.clone()) else {
            return Vec::new();
        };
        let cuts = segment::grapheme_boundaries(word)
            .map(|b| content.start + b)
            .filter(|&b| b > content.start && b < content.end && thai::allowed(text, b))
            .chain(std::iter::once(content.end));
        let mut chunks: Vec<Line> = Vec::new();
        let mut piece_start = content.start;
        for cut in cuts {
            let width = self.measure(piece_start..cut);
            match chunks.last_mut() {
                Some(chunk) if chunk.len.saturating_add(width) <= self.max_length => {
                    chunk.range.end = cut;
                    chunk.len = chunk.len.saturating_add(width);
                }
                _ => chunks.push(Line {
                    range: piece_start..cut,
                    len: width,
                }),
            }
            piece_start = cut;
        }
        chunks
    }

    fn measure(&self, range: Range<usize>) -> usize {
        measure(
            self.text.get(range).unwrap_or_default(),
            self.options.measure,
        )
    }

    /// Trims break spaces from both ends (an overflow cut can leave one at an edge, for
    /// example after a space that is followed by a soft hyphen), and drops a soft-wrapped
    /// line with no visible character (for example only NBSP).
    /// Blank output lines come only from blank input lines, which `wrap` adds per paragraph.
    fn push(&mut self, range: Range<usize>) {
        let Some(line) = self.text.get(range.clone()) else {
            return;
        };
        let trimmed = line.trim_matches(thai::is_break_space);
        if trimmed.chars().any(thai::is_visible) {
            let start =
                range.start + (line.len() - line.trim_start_matches(thai::is_break_space).len());
            self.out
                .push(self.base + start..self.base + start + trimmed.len());
        }
    }
}
