#!/usr/bin/env node
// Regenerates the bench fixtures from the 50-page base fixture.
//
//   bun bench/scripts/make-fixtures.mjs [--src <path-to-50pages-file>]
//
// What it does:
// 1. Reads the base fixture (default: the committed bench/fixtures/wrapthai-test-50pages.txt;
//    pass --src to re-import from another copy, e.g. ~/Downloads/test_assets/wrapthai-test-50pages.txt).
// 2. Validates strict UTF-8, strips a BOM if present, normalizes CRLF/CR to LF,
//    and (re)writes bench/fixtures/wrapthai-test-50pages.txt.
// 3. Derives whole-line prefixes for the smaller sizes:
//      small.txt  ~1 page  = ceil(total_chars / 50)
//      medium.txt ~10 pages = ceil(total_chars / 5)
//    "large" is the base file itself, so no duplicate copy is stored.
//    Sizes are counted in UTF-16 code units (JS .length); cuts happen only at line
//    boundaries so paragraphs stay intact. Derived files are deterministic for a
//    given base file.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(here, '../fixtures')
const args = process.argv.slice(2)
let src = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--src' && args[i + 1]) src = args[i + 1]
  else {
    console.error(`usage: bun bench/scripts/make-fixtures.mjs [--src <path>]`)
    process.exit(2)
  }
}

const srcPath = src ? resolve(src) : resolve(fixturesDir, 'wrapthai-test-50pages.txt')
const bytes = readFileSync(srcPath)
const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) // throws on invalid UTF-8
const base = text.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n')

const totalChars = base.length
const prefixOfWholeLines = (target) => {
  const lines = base.split('\n')
  let used = 0
  let n = 0
  while (n < lines.length && (used < target || n === 0)) {
    used += lines[n].length + 1
    n++
  }
  return lines.slice(0, n).join('\n') + '\n'
}

const targets = [
  { file: 'small.txt', target: Math.ceil(totalChars / 50), label: '~1 page' },
  { file: 'medium.txt', target: Math.ceil(totalChars / 5), label: '~10 pages' },
]

const outputs = [{ file: 'wrapthai-test-50pages.txt', label: 'large', content: base }]
for (const { file, target, label } of targets) {
  outputs.push({ file, label, content: prefixOfWholeLines(target) })
}
for (const { file, label, content } of outputs) {
  writeFileSync(resolve(fixturesDir, file), content, 'utf8')
  console.log(
    `${file} (${label}): ${Buffer.byteLength(content, 'utf8')} bytes, ${content.length} ` +
      `UTF-16 chars, ${content.split('\n').length} lines`,
  )
}
