// Quality checker: runs every JS tool (plus any Rust dumps in
// bench/out/rust-outputs/) over all fixtures x maxLength and reports:
//   overLimit    - lines longer than maxLength, counted in UTF-16 units,
//                  grapheme clusters, and the tool's own width unit
//   midWordCuts  - line breaks that fall inside a PyThaiNLP newmm token
//   ruleViolations - Thai typography rules (combining mark / ะ า ำ ๆ ฯ at line
//                  start; leading vowel เ แ โ ใ ไ at line end)
//   preserved    - joining all lines and removing whitespace equals the input
//                  with whitespace removed
// Writes bench/out/quality.json.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { TOOLS } from './lib/tools.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, 'out')
mkdirSync(outDir, { recursive: true })

const SIZES = { small: 'small.txt', medium: 'medium.txt', large: 'wrapthai-test-50pages.txt' }
const MAX_LENGTHS = [20, 40, 80]

// ---- Reference segmentation (PyThaiNLP newmm) ----
const refCache = new Map()
function newmmRef(size) {
  if (refCache.has(size)) return refCache.get(size)
  const fixture = path.join(here, 'fixtures', SIZES[size])
  const cache = path.join(outDir, `newmm-${size}.json`)
  if (!existsSync(cache)) {
    const res = spawnSync(
      'uv',
      ['run', '--with', 'pythainlp==5.4.0', 'python', 'scripts/newmm_ref.py', path.join('fixtures', SIZES[size])],
      { cwd: here, encoding: 'utf8', maxBuffer: 1 << 28 },
    )
    if (res.status !== 0) throw new Error(`newmm_ref failed for ${size}:\n${res.stderr?.slice(-600)}`)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(cache, res.stdout)
  }
  const parsed = JSON.parse(readFileSync(cache, 'utf8'))
  refCache.set(size, parsed)
  return parsed
}

// Strip whitespace AND U+200B: the fixtures embed ZWSP as explicit break hints
// (e.g. around loanwords) and wrapping tools treat it as a break opportunity,
// not content, so both sides of the comparison drop it.
const stripWs = (s) => s.replace(/[\s\u200B]+/g, '')

// Allowed break offsets in the stripped text, per reference segmenter.
// 'newmm' = PyThaiNLP newmm (task's correctness standard; note its dictionary
// keeps many compound words whole). 'icu' = V8 Intl.Segmenter Thai word
// segmentation, the closest JS-side proxy for ICU4X.
function boundarySet(size, kind = 'newmm') {
  const tokens = kind === 'newmm' ? newmmRef(size).tokens : icuTokensOf(size)
  const stripped = stripWs(tokens.join(''))
  const set = new Set([0, stripped.length])
  let cum = 0
  for (const tok of tokens) {
    const t = stripWs(tok)
    cum += t.length
    set.add(cum)
  }
  return { stripped, set }
}

const wordSeg = new Intl.Segmenter('th', { granularity: 'word' })
const icuTokensOf = (size) => {
  const text = readFileSync(path.join(here, 'fixtures', SIZES[size]), 'utf8')
  return [...wordSeg.segment(text)].map((s) => s.segment)
}

// ---- Thai rule checks (per thaiwrap AGENTS.md rules 1-3) ----
const graphemeSeg = new Intl.Segmenter('th', { granularity: 'grapheme' })
const COMBINING = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/
const NO_START = /[\u0E30\u0E32\u0E33\u0E46\u0E2F]/ // ะ า ำ ๆ ฯ
const LEADING_VOWEL = /[\u0E40-\u0E44]$/ // เ แ โ ใ ไ at line end
// thai-break's own unit: every code point except Thai above/below marks and ZWSP.
const displayWidth = (s) => {
  let w = 0
  for (const ch of s) {
    if (ch === '\u200B' || COMBINING.test(ch)) continue
    w += 1
  }
  return w
}

function checkLines(lines, maxLength, widthUnit, boundary, boundaryIcu) {
  const violations = { startCombining: [], startNoStart: [], endLeadingVowel: [] }
  let overUtf16 = 0
  let overGrapheme = 0
  let overOwnUnit = 0
  let zwspInOutput = 0
  const strippedParts = []
  const breakOffsets = []
  let cum = 0
  for (const line of lines) {
    if (line.includes('\u200B')) zwspInOutput++
    const first = [...line][0]
    if (first !== undefined) {
      if (COMBINING.test(first)) violations.startCombining.push(line.slice(0, 24))
      if (first && NO_START.test(first)) violations.startNoStart.push(line.slice(0, 24))
    }
    if (LEADING_VOWEL.test(line)) violations.endLeadingVowel.push(line.slice(-24))
    if (line.length > maxLength) overUtf16++
    const g = [...graphemeSeg.segment(line)].length
    if (g > maxLength) overGrapheme++
    if (widthUnit === 'displayWidth' ? displayWidth(line) > maxLength : line.length > maxLength) overOwnUnit++
    const stripped = stripWs(line.replace(/\u200B/g, ''))
    strippedParts.push(stripped)
    cum += stripped.length
    breakOffsets.push(cum)
  }
  const joined = strippedParts.join('')
  const preserved = joined === boundary.stripped
  let lost = 0
  if (!preserved) {
    // count char frequency delta for a size-of-loss signal
    const freq = (s) => {
      const m = new Map()
      for (const ch of s) m.set(ch, (m.get(ch) ?? 0) + 1)
      return m
    }
    const a = freq(joined)
    const b = freq(boundary.stripped)
    for (const [ch, n] of b) lost += Math.abs((a.get(ch) ?? 0) - n)
    for (const [ch, n] of a) if (!b.has(ch)) lost += n
  }
  // Mid-word cuts: every line break (offset between lines) must be a word
  // boundary in the reference segmentation. Counted against BOTH references.
  let midWord = 0
  let midWordIcu = 0
  const midWordExamples = []
  for (const off of breakOffsets.slice(0, -1)) {
    if (!boundary.set.has(off)) {
      midWord++
      if (midWordExamples.length < 3) {
        const ctx = boundary.stripped.slice(Math.max(0, off - 12), off + 12)
        midWordExamples.push({ offset: off, context: ctx })
      }
    }
    if (boundaryIcu && !boundaryIcu.set.has(off)) midWordIcu++
  }
  return {
    lineCount: lines.length,
    overLimit: { utf16: overUtf16, grapheme: overGrapheme, ownUnit: overOwnUnit, widthUnit },
    ruleViolations: violations,
    midWordCuts: { count: midWord, examples: midWordExamples },
    midWordIcuCuts: boundaryIcu ? { count: midWordIcu } : undefined,
    preserved,
    lostChars: lost,
    zwspInOutput,
  }
}

// ---- Run JS tools ----
const entries = []
for (const tool of TOOLS) {
  for (const [size, file] of Object.entries(SIZES)) {
    const text = readFileSync(path.join(here, 'fixtures', file), 'utf8')
    const boundary = boundarySet(size)
    const boundaryIcu = boundarySet(size, 'icu')
    for (const max of MAX_LENGTHS) {
      let lines
      try {
        lines = tool.wrap(text, max)
      } catch (err) {
        entries.push({ tool: tool.key, label: tool.label, size, maxLength: max, error: String(err) })
        continue
      }
      entries.push({ tool: tool.key, label: tool.label, size, maxLength: max, ...checkLines(lines, max, tool.widthUnit, boundary, boundaryIcu) })
    }
  }
}

// ---- Rust tool dumps, if the bench-compare crate produced them ----
const rustDir = path.join(outDir, 'rust-outputs')
if (existsSync(rustDir)) {
  for (const f of readdirSync(rustDir)) {
    if (!f.endsWith('.json')) continue
    const d = JSON.parse(readFileSync(path.join(rustDir, f), 'utf8'))
    const boundary = boundarySet(d.size)
    const boundaryIcu = boundarySet(d.size, 'icu')
    entries.push({ tool: d.tool, label: `${d.tool} (rust core)`, size: d.size, maxLength: d.maxLength, ...checkLines(d.lines, d.maxLength, 'utf16', boundary, boundaryIcu) })
  }
}

const newmmVersion = newmmRef('small').pythainlp
const out = {
  runtime: `node ${process.version}`,
  newmm: { engine: 'newmm', pythainlp: newmmVersion },
  widthUnits: { utf16: 'UTF-16 code units (JS .length)', grapheme: 'grapheme clusters via Intl.Segmenter', displayWidth: 'thai-break unit: code points minus Thai combining marks and ZWSP' },
  entries,
}
writeFileSync(path.join(outDir, 'quality.json'), JSON.stringify(out, null, 2))

// Summary: totals per tool across all sizes/maxLens.
const totals = {}
for (const e of entries) {
  if (e.error) {
    totals[e.tool] = totals[e.tool] ?? { errors: 0 }
    totals[e.tool].errors++
    continue
  }
  const t = (totals[e.tool] ??= {})
  t.lines = (t.lines ?? 0) + e.lineCount
  t.overUtf16 = (t.overUtf16 ?? 0) + e.overLimit.utf16
  t.overGrapheme = (t.overGrapheme ?? 0) + e.overLimit.grapheme
  t.overOwnUnit = (t.overOwnUnit ?? 0) + e.overLimit.ownUnit
  t.midWord = (t.midWord ?? 0) + e.midWordCuts.count
  t.midWordIcu = (t.midWordIcu ?? 0) + (e.midWordIcuCuts?.count ?? 0)
  t.startCombining = (t.startCombining ?? 0) + e.ruleViolations.startCombining.length
  t.startNoStart = (t.startNoStart ?? 0) + e.ruleViolations.startNoStart.length
  t.endLeadingVowel = (t.endLeadingVowel ?? 0) + e.ruleViolations.endLeadingVowel.length
  t.notPreserved = (t.notPreserved ?? 0) + (e.preserved ? 0 : 1)
  t.lostChars = (t.lostChars ?? 0) + e.lostChars
}
for (const [tool, t] of Object.entries(totals)) {
  console.log(
    `${tool.padEnd(26)} lines=${String(t.lines).padStart(6)} over(u16)=${String(t.overUtf16).padStart(4)} over(gr)=${String(t.overGrapheme).padStart(4)} midWord(newmm)=${String(t.midWord).padStart(5)} midWord(icu)=${String(t.midWordIcu).padStart(5)} startMark=${t.startCombining} startNo=${t.startNoStart} endLead=${t.endLeadingVowel} notPreserved=${t.notPreserved} lost=${t.lostChars}`,
  )
}
console.error('wrote bench/out/quality.json')
