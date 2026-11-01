// Peak-memory driver: one fresh node --expose-gc process per tool under
// /usr/bin/time -l, large fixture. Writes bench/out/memory.json.

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { TOOLS } from './lib/tools.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
mkdirSync(path.join(here, 'out'), { recursive: true })
const size = process.argv.find((a, i) => process.argv[i - 1] === '--size') ?? 'large'
const ml = process.argv.find((a, i) => process.argv[i - 1] === '--ml') ?? '40'
const iters = process.argv.find((a, i) => process.argv[i - 1] === '--iters') ?? '300'

const out = { runtime: `node ${process.version}`, size, maxLength: Number(ml), iters: Number(iters), tools: {} }
for (const tool of TOOLS) {
  const cmd = `/usr/bin/time -l ${process.execPath} --expose-gc bench-memory.mjs --tool ${tool.key} --size ${size} --ml ${ml} --iters ${iters}`
  const res = spawnSync('/bin/bash', ['-c', cmd], { cwd: here, encoding: 'utf8', maxBuffer: 1 << 24 })
  if (res.status !== 0) {
    console.error(`${tool.key} failed:`, res.stderr.slice(-400))
    out.tools[tool.key] = { error: 'failed' }
    continue
  }
  const internal = JSON.parse(res.stdout)
  const peak = /(\d+)\s+maximum resident set size/.exec(res.stderr)
  out.tools[tool.key] = { ...internal, timeMaxRssKb: peak ? Math.round(Number(peak[1]) / 1024) : null }
  console.log(tool.key, JSON.stringify(out.tools[tool.key]))
}

writeFileSync(path.join(here, 'out', 'memory.json'), JSON.stringify(out, null, 2))
console.error('wrote bench/out/memory.json')
