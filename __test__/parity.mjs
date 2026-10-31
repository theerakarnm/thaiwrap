import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { wrapThai } from '../index.js'
import { wrapReference } from './reference.mjs'

export const CORPUS_DIR = new URL('../corpus/', import.meta.url)
export const MAX_LENGTHS = [10, 20, 40]
const THAI_RUN = /[\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59 ]+/g
const THAI_LETTER = /[\u0E01-\u0E2E]/

export const sources = () =>
  readdirSync(CORPUS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/lines.txt`, CORPUS_DIR)))
    .map((d) => d.name)
    .sort()

export const knownDiffsUrl = (source) => new URL(`${source}/parity-known-diffs.json`, CORPUS_DIR)

export function fragments(source) {
  const lines = readFileSync(new URL(`${source}/lines.txt`, CORPUS_DIR), 'utf8').split('\n')
  const out = []
  lines.forEach((line, i) => {
    let n = 0
    for (const [text] of line.matchAll(THAI_RUN)) {
      if (text.length >= 10 && THAI_LETTER.test(text)) out.push({ id: `${source}:${i + 1}#${n++}`, line: i + 1, text })
    }
  })
  return { lines: lines.length, fragments: out }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function computeParity() {
  return sources().map((source) => {
    const { lines, fragments: inputs } = fragments(source)
    const diffs = []
    for (const { id, text } of inputs) {
      for (const maxLength of MAX_LENGTHS) {
        const rust = wrapThai(text, maxLength)
        const reference = wrapReference(text, maxLength)
        if (!same(rust, reference)) diffs.push({ id, maxLength, rust, reference })
      }
    }
    const comparedLines = new Set(inputs.map((f) => f.line))
    const diffLines = new Set(diffs.map((d) => d.id.slice(d.id.indexOf(':') + 1).split('#')[0]))
    return { source, lines, comparedLines: comparedLines.size, diffLines: diffLines.size, diffs, inputs: inputs.length }
  })
}

const isMain = import.meta.main ?? process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  for (const r of computeParity()) {
    console.log(`${r.source}: ${r.inputs} inputs, ${r.diffs.length} differences, ${r.diffLines}/${r.comparedLines} lines differ`)
  }
}
