# thaiwrap

Fast Thai line wrapping for Node.js and Bun, powered by Rust.

`thaiwrap` breaks Thai text into lines of a maximum length **at word boundaries**, so Thai words are not cut in half; a word longer than the line is cut only where Thai rules allow.
No line starts with an orphan vowel or tone mark.

> **Status:** pre-release. The API below is the planned v0.1 surface and may change before the first published version.

## Why

Thai is written without spaces between words. Slicing a string every N characters cuts words apart and can separate a consonant from its vowel and tone marks:

```js
// Naive: slice every 10 characters
["กระบวนการส", "ื่อสาร ส่ง", "มอบ และสร้", "างคุณค่า"]
//              ^ line 2 starts with an orphan vowel mark, and line 4 with an orphan vowel
```

`thaiwrap` segments the text into words first, then fills each line greedily:

```js
wrapThai("กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า", 10)
// ["กระบวนการ", "สื่อสาร", "ส่งมอบ และ", "สร้าง", "คุณค่า"]
```

## Install

```bash
npm install thaiwrap
# or
bun add thaiwrap
```

Prebuilt native binaries are installed automatically for supported platforms. No Rust toolchain is needed to use the package.

## Usage

```ts
import { wrapThai } from "thaiwrap";

const lines = wrapThai("กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า", 10);

for (const line of lines) {
  console.log(line);
}
// กระบวนการ
// สื่อสาร
// ส่งมอบ และ
// สร้าง
// คุณค่า
```

### API

```ts
wrapThai(text: string, maxLength: number, options?: WrapOptions): string[]
```

| Parameter   | Type          | Description                                   |
| ----------- | ------------- | --------------------------------------------- |
| `text`      | `string`      | The text to wrap. Thai, Latin and mixed text are supported. |
| `maxLength` | `number`      | Maximum length of each line. Must be a positive integer. |
| `options`   | `WrapOptions` | Optional settings (see below).                |

Returns an array of lines.
Break spaces (spaces and ZWSP) at line edges are trimmed.
No-break spaces (U+00A0, U+2007, U+202F) are content.

Invalid input throws instead of crashing the process.
Wrong types throw `TypeError`: `text` is not a string, `maxLength` is not a number, or `options` is not an object.
Wrong values throw `RangeError`: `maxLength` is not an integer from 1 to `Number.MAX_SAFE_INTEGER`, or `measure` or `overflow` is not one of the listed values.

### Options

| Option     | Default        | Description |
| ---------- | -------------- | ----------- |
| `measure`  | `"codeUnits"`  | How line length is counted: `"codeUnits"` or `"graphemes"`. See [Measuring length](#measuring-length). |
| `overflow` | `"split"`      | What to do with a word longer than `maxLength`: `"split"` or `"keep"`. See [Long words](#long-words). |

## Line breaking rules

### Spaces

Spaces are break opportunities.
They are trimmed at line edges and kept inside a line.
A zero width space (U+200B) breaks like a space.
A no-break space (NBSP) never breaks.

### Line breaks

`\n`, `\r\n`, `\r`, VT, FF, NEL, U+2028, and U+2029 always end a line.

### Blank lines

An input line with no visible characters becomes `""`.
A wrapped piece with no visible characters is dropped, so `""` never appears inside one paragraph.
Blank lines before the first and after the last visible line are dropped.
Blank lines between visible lines are kept, not collapsed.

```js
wrapThai("", 10)            // []
wrapThai("   ", 10)         // []
wrapThai("\n\n", 10)        // []
wrapThai("ก\n\nข", 10)      // ["ก", "", "ข"]
wrapThai("\n\nก\n\n", 10)   // ["ก"]
wrapThai("ก\n\n\nข", 10)    // ["ก", "", "", "ข"]
```

### Long words

`overflow: "split"` (default) cuts a word longer than `maxLength` at grapheme boundaries that keep Thai vowels and tone marks with their consonant.
`overflow: "keep"` puts the whole word on its own line.

A unit that cannot be cut is placed alone on its line, even when it is longer than `maxLength`.
For example, `ที่` is one grapheme of 3 code units, and `กา` cannot start a line with `า`.

For Thai text, use a `maxLength` of 5 or more.
Then a line is longer than `maxLength` only in rare cases, such as a word followed by repeated ๆ (`เท่าๆๆ` is one unit of 6 code units).

## Measuring length

By default, length is counted the same way as JavaScript's `String.prototype.length` (UTF-16 code units). Thai vowel and tone marks written above or below a consonant count as one unit each, even though they take no horizontal space on screen.

This matters for the result. The same input wrapped at 10 gives different lines depending on how length is counted:

```js
// Code units (default, same as .length)
["กระบวนการ", "สื่อสาร", "ส่งมอบ และ", "สร้าง", "คุณค่า"]

// Grapheme clusters (closer to what you see on screen)
["กระบวนการ", "สื่อสาร ส่ง", "มอบ และ", "สร้างคุณค่า"]
```

Use code units when you need to match a character limit (database columns, SMS, fixed-width fields).
Use `measure: "graphemes"` when you fit text into a space on screen (closer to what you see).

## How it works

1. Text is split into words with [ICU4X](https://github.com/unicode-org/icu4x)'s dictionary-based line segmenter (Unicode UAX #14 line break rules), compiled into the native addon.
2. Words are placed on the current line until the next word would exceed `maxLength`, then a new line starts.
3. Spaces at line edges are dropped.

Because the dictionary ships inside the package, output is the same on every runtime and does not depend on the ICU version bundled with your Node or Bun install.

## Performance

Measured on a prototype (Linux x64, Rust 1.97, Node 22.23, Bun 1.4.4), in microseconds per call. "Short" is the 36-character example above; "long" is the same text repeated 300 times (about 11,000 characters).

| Engine                         | Node short | Node long | Bun short | Bun long |
| ------------------------------ | ---------: | --------: | --------: | -------: |
| JS `Intl.Segmenter` baseline   | 8.9        | 1750      | 3.9       | 1008     |
| `thaiwrap` (Rust via Node-API) | 3.3        | 828       | 2.2       | 531      |

The v0.1 build measures about 2.2-2.6x faster than an `Intl.Segmenter` wrapper on Node 22, about 1.5-1.8x on Node 24, and about 2x on Bun 1.4.4 (see [benchmarks](docs/m0/benchmarks.md)).
The gain matters most for high-volume work such as generating receipts, labels or PDFs in bulk.
The table above is from an earlier prototype.

## Platform support

`thaiwrap` is a native Node-API addon built with [napi-rs](https://napi.rs). Prebuilt binaries are provided for:

| OS      | Architectures       |
| ------- | ------------------- |
| Linux   | x64 (glibc), arm64 (glibc), x64 (musl) |
| macOS   | x64, arm64          |
| Windows | x64                 |

Runtimes: Node.js 22+ and Bun.
On other platforms, loading the package throws an error that names your platform.

Not supported yet: browsers and edge runtimes such as Cloudflare Workers. A WebAssembly build may be added later.

## Known limitations

- Lone surrogates become U+FFFD.
- Invisible format characters (soft hyphen, LRM/RLM) are not looked through by the Thai rules.
- Output can differ from `Intl.Segmenter` because the dictionary ships inside the package.
- A split inside a long word can leave a single final consonant on a line (for example `สร้า` / `ง`).

## Development

Requirements: Rust (stable), Node.js 22+, Bun.

```bash
git clone https://github.com/theerakarnm/thaiwrap.git
cd thaiwrap
bun install

# Build the native addon
bun run build

# Run tests
cargo test
bun test
```

## Contributing

Issues and pull requests are welcome. If a word is split in the wrong place, please open an issue with the input text, the `maxLength` you used, the output you got and the output you expected.

## License

MIT
