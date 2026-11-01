// Runs inside one node process per tool: loads the tool, wraps the given
// fixture repeatedly, samples RSS/heap, prints JSON. The parent adds
// /usr/bin/time -l peak RSS around this process.

import { readFileSync } from 'node:fs'
import { TOOLS } from './lib/tools.mjs'

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const size = arg('size') ?? 'large'
const ml = Number(arg('ml') ?? 40)
const iters = Number(arg('iters') ?? 300)
const toolKey = arg('tool')
const tool = TOOLS.find((t) => t.key === toolKey)
if (!tool) throw new Error(`unknown tool ${toolKey}`)

const file = size === 'large' ? 'wrapthai-test-50pages.txt' : `${size}.txt`
const text = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8')

const base = process.memoryUsage()
let maxRss = base.rss
let maxHeap = base.heapUsed
for (let i = 0; i < iters; i++) {
  const lines = tool.wrap(text, ml)
  if (i % 10 === 0) {
    const m = process.memoryUsage()
    if (m.rss > maxRss) maxRss = m.rss
    if (m.heapUsed > maxHeap) maxHeap = m.heapUsed
  }
  if (lines.length === -1) throw new Error('unreachable')
}
if (globalThis.gc) globalThis.gc()
const after = process.memoryUsage()
console.log(
  JSON.stringify({
    tool: toolKey,
    size,
    maxLength: ml,
    iters,
    baseRssKb: Math.round(base.rss / 1024),
    maxRssKb: Math.round(maxRss / 1024),
    maxHeapUsedKb: Math.round(maxHeap / 1024),
    afterGcHeapUsedKb: Math.round(after.heapUsed / 1024),
  }),
)
