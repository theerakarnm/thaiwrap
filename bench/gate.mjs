// Timing harness for the v0.2 performance gates (docs/v0.2/). Not part of the npm package.
// Usage: THAIWRAP_DIR=<checkout with a built addon> node bench/gate.mjs short long   (Bun works too)
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const lib = createRequire(import.meta.url)(resolve(process.env.THAIWRAP_DIR ?? '.', 'index.js'))
const SHORT = 'กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า'
const LONG = SHORT.repeat(300)
const MIXED = 'ราคา 1,250.50 บาท ใช้ React กับ TypeScript 👍 สวัสดี! (ภาษาไทย) '.repeat(50)
// The first 1,000 non-empty lines of the Wisesight corpus: short social-media texts (median 40 code units).
const TEXTS = readFileSync(new URL('../corpus/wisesight/lines.txt', import.meta.url), 'utf8')
  .split('\n')
  .filter(Boolean)
  .slice(0, 1000)

const cases = {
  short: () => lib.wrapThai(SHORT, 10),
  long: () => lib.wrapThai(LONG, 10),
  mixed: () => lib.wrapThai(MIXED, 20),
  'loop-1000': () => { for (const t of TEXTS) lib.wrapThai(t, 20) },
  'batch-1000': () => lib.wrapThaiBatch(TEXTS, 20),
  'ranges-short': () => lib.wrapThaiRanges(SHORT, 10),
  'ranges-long': () => lib.wrapThaiRanges(LONG, 10),
  'ranges-loop-1000': () => { for (const t of TEXTS) lib.wrapThaiRanges(t, 20) },
}

// Median of 21 batches; a batch repeats the call until it takes at least 20 ms.
function nsPerCall(fn) {
  let n = 1
  for (;;) {
    const t = process.hrtime.bigint()
    for (let i = 0; i < n; i++) fn()
    if (process.hrtime.bigint() - t >= 20_000_000n) break
    n *= 2
  }
  const samples = []
  for (let s = 0; s < 21; s++) {
    const t = process.hrtime.bigint()
    for (let i = 0; i < n; i++) fn()
    samples.push(Number(process.hrtime.bigint() - t) / n)
  }
  return samples.sort((a, b) => a - b)[10]
}

const names = process.argv.slice(2)
const unknown = names.filter((name) => !cases[name])
if (unknown.length > 0) throw new Error(`unknown case ${unknown.join(', ')}`)

const runtime = typeof Bun === 'undefined' ? `node ${process.version}` : `bun ${Bun.version}`
for (const name of names) {
  console.log(JSON.stringify({ name, runtime, ns: nsPerCall(cases[name]) }))
}
