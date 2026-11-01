// Benchmark driver: runs bench-speed.mjs in fresh Node child processes for
// ROUNDS rounds, aggregates mean +/- sd across rounds, and writes
// bench/out/js-speed.json.

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROUNDS = Number(process.argv.find((a, i) => process.argv[i - 1] === '--rounds') ?? 3)
const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, 'out')
mkdirSync(outDir, { recursive: true })

const rounds = []
for (let r = 1; r <= ROUNDS; r++) {
  const res = spawnSync(process.execPath, ['--expose-gc', 'bench-speed.mjs', '--round', String(r)], {
    cwd: here,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
  if (res.status !== 0) {
    console.error(res.stderr)
    throw new Error(`round ${r} failed with exit ${res.status}`)
  }
  const parsed = JSON.parse(res.stdout)
  rounds.push(parsed)
  console.error(`round ${r}/${ROUNDS} done`)
}

// Aggregate across rounds per bench key.
const keys = Object.keys(rounds[0].results)
const agg = {}
for (const key of keys) {
  const rs = rounds.map((r) => r.results[key]).filter((x) => !x.error)
  if (rs.length === 0) {
    agg[key] = { error: rounds[0].results[key].error }
    continue
  }
  const stat = (pick) => {
    const vals = rs.map(pick)
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1)) : 0
    return { mean, sd, min: Math.min(...vals), max: Math.max(...vals) }
  }
  agg[key] = {
    tool: rs[0].tool,
    label: rs[0].label,
    size: rs[0].size,
    maxLength: rs[0].maxLength,
    rounds: rs.length,
    meanMs: stat((x) => x.meanMs),
    p50Ms: stat((x) => x.p50Ms),
    p99Ms: stat((x) => x.p99Ms),
    opsSec: stat((x) => x.opsSec),
  }
}

const out = {
  runtime: rounds[0].runtime,
  rounds: ROUNDS,
  fixtures: rounds[0].fixtures,
  aggregate: agg,
  raw: rounds,
}
writeFileSync(path.join(outDir, 'js-speed.json'), JSON.stringify(out))
console.error(`wrote ${path.join(outDir, 'js-speed.json')}`)

// Human summary table: ops/sec mean +/- sd for large + medium at ml40.
const row = (key) => {
  const a = agg[key]
  if (!a || a.error) return `${key}: ERROR ${a?.error}`
  return `${key.padEnd(34)} ${(a.opsSec.mean).toFixed(1).padStart(10)} +/- ${a.opsSec.sd.toFixed(1)} ops/s  mean ${a.meanMs.mean.toFixed(3)} ms  p99 ${a.p99Ms.mean.toFixed(3)} ms`
}
for (const size of ['small', 'medium', 'large']) {
  console.log(`\n=== ${size} ===`)
  for (const key of keys) if (agg[key]?.size === size && agg[key].maxLength === 40) console.log(row(key))
}
