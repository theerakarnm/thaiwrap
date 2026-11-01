// Cold-start driver: for each tool, spawn N fresh node processes running
// cold-start-child.mjs, aggregate medians, write bench/out/cold-start.json.

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const N = Number(process.argv.find((a, i) => process.argv[i - 1] === '--n') ?? 15)
const here = path.dirname(fileURLToPath(import.meta.url))
mkdirSync(path.join(here, 'out'), { recursive: true })

const TOOLS = [
  'thaiwrap',
  'intl-reference',
  'intl-simple',
  'wordcut-greedy',
  'thai-wordcut-ts-greedy',
  'thai-break-greedy',
  'thai-break-wrap',
]

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

const out = { runtime: `node ${process.version}`, samples: N, tools: {} }
for (const tool of TOOLS) {
  const runs = []
  for (let i = 0; i < N; i++) {
    const res = spawnSync(process.execPath, ['lib/cold-start-child.mjs', tool], {
      cwd: here,
      encoding: 'utf8',
    })
    if (res.status !== 0) throw new Error(`${tool} child failed:\n${res.stderr}`)
    runs.push(JSON.parse(res.stdout))
  }
  const agg = {}
  for (const k of ['loadMs', 'initMs', 'firstCallMs', 'warmCallMs']) {
    const xs = runs.map((r) => r[k]).filter((x) => typeof x === 'number')
    if (xs.length) agg[k] = { median: median(xs), mean: xs.reduce((a, b) => a + b, 0) / xs.length }
  }
  out.tools[tool] = agg
  console.log(tool, JSON.stringify(agg))
}

writeFileSync(path.join(here, 'out', 'cold-start.json'), JSON.stringify(out, null, 2))
console.error('wrote bench/out/cold-start.json')
