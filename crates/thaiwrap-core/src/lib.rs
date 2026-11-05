//! Thai-aware line wrapping.
//!
//! Thai is written without spaces between words, so lines can only break where a line break
//! opportunity exists. This crate finds those positions with the ICU4X UAX #14 line segmenter
//! (dictionary-based for Thai), applies the Thai text rules, and fills lines greedily.
#![forbid(unsafe_code)]
#![deny(missing_docs)]
#![warn(clippy::pedantic)]

#[cfg(test)]
mod compare_segmenters;
mod lines;
mod measure;
mod segment;
mod tcc;
mod thai;
mod wrap;

use std::fmt;

pub use wrap::wrap;

/// How the length of a line is measured.
///
/// ```
/// use thaiwrap::{Measure, WrapOptions};
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
/// use thaiwrap::{Overflow, WrapOptions};
/// assert_eq!(WrapOptions::default().overflow, Overflow::Split);
/// ```
#[non_exhaustive]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum Overflow {
    /// Cut the word where the Thai text rules allow: at Thai Character Cluster ends inside
    /// Thai, at grapheme boundaries elsewhere, and at grapheme boundaries inside a cluster
    /// that is longer than the maximum line length.
    #[default]
    Split,
    /// Put the whole word on its own line, even if it is too long.
    Keep,
}

/// Options for [`wrap`].
///
/// ```
/// use thaiwrap::{Overflow, WrapOptions};
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
/// assert_eq!(thaiwrap::WrapError::InvalidMaxLength.to_string(), "max_length must be at least 1");
/// ```
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WrapError {
    /// `max_length` was 0.
    InvalidMaxLength,
    /// The built-in Unicode data could not be loaded. It is compiled into the library, so
    /// this means the build is broken; please report it.
    DataUnavailable,
}

impl fmt::Display for WrapError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidMaxLength => f.write_str("max_length must be at least 1"),
            Self::DataUnavailable => {
                f.write_str("thaiwrap could not load its built-in Unicode data")
            }
        }
    }
}

impl std::error::Error for WrapError {}
