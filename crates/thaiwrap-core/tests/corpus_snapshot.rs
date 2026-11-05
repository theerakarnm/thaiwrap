//! Snapshot of wrapping output over the corpora.
//!
//! A change in ICU4X data or in the wrapping algorithm shows up as a diff of the snapshot files.
//! Regenerate with `THAIWRAP_UPDATE_SNAPSHOT=1 cargo test -p thaiwrap --test corpus_snapshot --release`.

use std::fmt::Write as _;
use std::fs;

use thaiwrap::{wrap, Measure, Overflow, WrapOptions};

fn configs() -> Vec<(&'static str, usize, WrapOptions)> {
    let mut graphemes = WrapOptions::default();
    graphemes.measure = Measure::Graphemes;
    let mut keep = WrapOptions::default();
    keep.overflow = Overflow::Keep;
    vec![
        ("codeUnits-10", 10, WrapOptions::default()),
        ("codeUnits-40", 40, WrapOptions::default()),
        ("graphemes-10", 10, graphemes),
        ("keep-10", 10, keep),
    ]
}

fn render(input: &str) -> String {
    let mut out = String::new();
    for (index, line) in input.split('\n').filter(|l| !l.is_empty()).enumerate() {
        for (name, max_length, options) in configs() {
            writeln!(out, "#{} {name}", index + 1).unwrap();
            for range in wrap(line, max_length, &options).unwrap() {
                writeln!(out, "|{}", &line[range]).unwrap();
            }
            out.push('\n');
        }
    }
    out
}

fn check(source: &str) {
    let dir = format!("{}/../../corpus/{source}", env!("CARGO_MANIFEST_DIR"));
    let input = fs::read_to_string(format!("{dir}/lines.txt")).unwrap();
    let actual = render(&input);
    let snapshot_path = format!("{dir}/snapshot.txt");

    if std::env::var("THAIWRAP_UPDATE_SNAPSHOT").as_deref() == Ok("1") {
        fs::write(&snapshot_path, &actual).unwrap();
        return;
    }

    let expected = fs::read_to_string(&snapshot_path).unwrap_or_else(|e| {
        panic!("cannot read {snapshot_path}: {e}; generate it with THAIWRAP_UPDATE_SNAPSHOT=1")
    });
    if actual == expected {
        return;
    }
    let mut expected_blocks = expected.split("\n\n");
    for actual_block in actual.split("\n\n") {
        let expected_block = expected_blocks.next().unwrap_or("<missing block>");
        // Printed with `{}`: Debug would escape every Thai mark and join the lines with `\n`.
        assert!(
            actual_block == expected_block,
            "first differing block in {source} snapshot\n--- expected\n{expected_block}\n+++ actual\n{actual_block}"
        );
    }
    panic!("{source} snapshot has extra blocks after the actual output");
}

#[test]
fn corpus_snapshot_should_match_for_wisesight() {
    check("wisesight");
}

#[test]
fn corpus_snapshot_should_match_for_wikipedia_th() {
    check("wikipedia-th");
}
