# thaiwrap

Wraps Thai text into lines of a maximum length at word boundaries, without breaking Thai rules: no line starts with a vowel or tone mark, and long words are split between Thai Character Clusters.
This is the Rust core of the [`thaiwrap` npm package](https://www.npmjs.com/package/thaiwrap).

```rust
use thaiwrap::{wrap, WrapError, WrapOptions};

fn main() -> Result<(), WrapError> {
    let text = "กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า";
    let lines: Vec<&str> = wrap(text, 10, &WrapOptions::default())?
        .into_iter()
        .filter_map(|r| text.get(r))
        .collect();
    assert_eq!(lines, ["กระบวนการ", "สื่อสาร", "ส่งมอบ และ", "สร้าง", "คุณค่า"]);
    Ok(())
}
```

`wrap` returns byte ranges into the input, so you can slice the lines without copying.
Length is counted in UTF-16 code units by default, like JavaScript's `String.length`; set `measure` to `Measure::Graphemes` to count what you see.

Lao, Khmer and Burmese are not supported: the crate ships Thai dictionary data only.

## License

MIT ([LICENSE](LICENSE)).
The embedded Unicode data from ICU4X is under the Unicode License v3 ([LICENSE-UNICODE](LICENSE-UNICODE)).
