# thaiwrap

Fast Thai line wrapping for Node.js and Bun, powered by Rust.

`thaiwrap` breaks Thai text into lines of a maximum length **at word boundaries**, so no Thai word is ever cut in half and no line starts with an orphan vowel or tone mark.

> **Status:** pre-release. The API below is the planned v0.1 surface and may change before the first published version.

## Why

Thai is written without spaces between words. Slicing a string every N characters cuts words apart and can separate a consonant from its vowel and tone marks:

```js
// Naive: slice every 10 characters
["กระบวนการส", "ื่อสาร ส่", "งมอบ และสร", "้างคุณค่า"]
//              ^ line starts with an orphan vowel mark
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

Returns an array of lines. Whitespace at the start and end of each line is trimmed.

Invalid input throws instead of crashing the process: a non-string `text` throws `TypeError`, and a `maxLength` that is not a positive integer throws `RangeError`.

### Options

Options are being finalized for v0.1. Planned:

| Option    | Default        | Description |
| --------- | -------------- | ----------- |
| `measure` | `"codeUnits"`  | How line length is counted. See [Measuring length](#measuring-length). |

## Measuring length

By default, length is counted the same way as JavaScript's `String.prototype.length` (UTF-16 code units). Thai vowel and tone marks written above or below a consonant count as one unit each, even though they take no horizontal space on screen.

This matters for the result. The same input wrapped at 10 gives different lines depending on how length is counted:

```js
// Code units (default, same as .length)
["กระบวนการ", "สื่อสาร", "ส่งมอบ และ", "สร้าง", "คุณค่า"]

// Grapheme clusters (closer to what you see on screen)
["กระบวนการ", "สื่อสาร ส่ง", "มอบ และ", "สร้างคุณค่า"]
```

Use code units when you need to match a character limit (database columns, SMS, fixed-width fields). Use a visual measure when you are fitting text into a space on screen or paper.

## How it works

1. Text is split into words with [ICU4X](https://github.com/unicode-org/icu4x)'s dictionary-based word segmenter, compiled into the native addon.
2. Words are placed on the current line until the next word would exceed `maxLength`, then a new line starts.
3. Spaces at line edges are dropped.

Because the dictionary ships inside the package, output is the same on every runtime and does not depend on the ICU version bundled with your Node or Bun install.

## Performance

Measured on a prototype (Linux x64, Rust 1.97, Node 22.23, Bun 1.4.4), in microseconds per call. "Short" is the 36-character example above; "long" is the same text repeated 300 times (about 11,000 characters).

| Engine                         | Node short | Node long | Bun short | Bun long |
| ------------------------------ | ---------: | --------: | --------: | -------: |
| JS `Intl.Segmenter` baseline   | 8.9        | 1750      | 3.9       | 1008     |
| `thaiwrap` (Rust via Node-API) | 3.3        | 828       | 2.2       | 531      |

Roughly 2-3x faster on Node and about 1.8x on Bun. The gain matters most for high-volume work such as generating receipts, labels or PDFs in bulk. Numbers will be updated with the published version.

## Platform support

`thaiwrap` is a native Node-API addon built with [napi-rs](https://napi.rs). Prebuilt binaries are planned for:

| OS      | Architectures       |
| ------- | ------------------- |
| Linux   | x64, arm64 (glibc)  |
| macOS   | x64, arm64          |
| Windows | x64                 |

Runtimes: Node.js 18+ and Bun.

Not supported yet: browsers and edge runtimes such as Cloudflare Workers. A WebAssembly build may be added later.

## Development

Requirements: Rust (stable), Node.js 18+, Bun.

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
