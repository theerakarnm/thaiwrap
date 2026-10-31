//! Thai-aware line wrapping.
//!
//! Thai is written without spaces between words, so lines can only break where a word
//! segmenter says a word ends. This crate finds those positions with ICU4X, applies the
//! Thai text rules, and fills lines greedily.
#![forbid(unsafe_code)]
#![deny(missing_docs)]
#![warn(clippy::pedantic)]

use std::fmt;

/// How the length of a line is measured.
///
/// ```
/// use thaiwrap_core::{Measure, WrapOptions};
/// assert_eq!(WrapOptions::default().measure, Measure::CodeUnits);
/// let mut options = WrapOptions::default();
/// options.measure = Measure::Graphemes;
/// assert_eq!(options.measure, Measure::Graphemes);
/// ```
#[non_exhaustive]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum Measure {
    /// UTF-16 code units, the same as JavaScript `String.prototype.length`.
    #[default]
    CodeUnits,
    /// Extended grapheme clusters (Unicode UAX #29).
    Graphemes,
}

/// What to do with a single word that is longer than the maximum line length.
///
/// ```
/// use thaiwrap_core::{Overflow, WrapOptions};
/// assert_eq!(WrapOptions::default().overflow, Overflow::Split);
/// ```
#[non_exhaustive]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum Overflow {
    /// Cut the word at grapheme boundaries allowed by the Thai text rules.
    #[default]
    Split,
    /// Put the whole word on its own line, even if it is too long.
    Keep,
}

/// Options for [`wrap`].
///
/// ```
/// use thaiwrap_core::{Overflow, WrapOptions};
/// let mut options = WrapOptions::default();
/// options.overflow = Overflow::Keep;
/// assert_eq!(options.overflow, Overflow::Keep);
/// ```
#[non_exhaustive]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct WrapOptions {
    /// How line length is measured.
    pub measure: Measure,
    /// What to do with a word longer than the maximum line length.
    pub overflow: Overflow,
}

/// Why [`wrap`] could not run.
///
/// ```
/// assert_eq!(thaiwrap_core::WrapError::InvalidMaxLength.to_string(), "max_length must be at least 1");
/// ```
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WrapError {
    /// `max_length` was 0.
    InvalidMaxLength,
}

impl fmt::Display for WrapError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidMaxLength => f.write_str("max_length must be at least 1"),
        }
    }
}

impl std::error::Error for WrapError {}
