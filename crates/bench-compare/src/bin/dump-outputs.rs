//! Writes every tool's lines for every fixture and max length to
//! `bench/out/rust-outputs/<tool>-<size>-ml<NN>.json` for the quality comparison.
use std::fmt::Write as _;
use std::fs;

use bench_compare::{read_fixture, repo_root, BoxError, Tool, Tools, FIXTURES, MAX_LENGTHS};

fn json_string(out: &mut String, s: &str) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if u32::from(c) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", u32::from(c));
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

fn to_json(tool: &str, size: &str, max: usize, lines: &[String]) -> String {
    let mut out = String::from("{\"tool\":");
    json_string(&mut out, tool);
    out.push_str(",\"size\":");
    json_string(&mut out, size);
    let _ = write!(out, ",\"maxLength\":{max},\"lines\":[");
    for (i, line) in lines.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        json_string(&mut out, line);
    }
    out.push_str("]}\n");
    out
}

fn main() -> Result<(), BoxError> {
    let tools = Tools::new()?;
    let dir = repo_root().join("bench/out/rust-outputs");
    fs::create_dir_all(&dir)?;
    for (size, _) in FIXTURES {
        let text = read_fixture(size)?;
        for tool in Tool::ALL {
            for max in MAX_LENGTHS {
                let lines = tools.wrap(tool, &text, max)?;
                let path = dir.join(format!("{}-{size}-ml{max}.json", tool.name()));
                fs::write(&path, to_json(tool.name(), size, max, &lines))?;
                println!("{} ({} lines)", path.display(), lines.len());
            }
        }
    }
    Ok(())
}
