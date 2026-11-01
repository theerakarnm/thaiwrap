// One benchmark round. Prints a JSON result to stdout (bench/index.mjs drives
// multiple rounds in fresh child processes and aggregates them).
//
// Harness: manual timing loop. Rationale: mitata (the repo's existing bench
// runner) has no programmatic result API, and the report needs mean/p50/p99
// plus cross-round variance as data. Timing loop design follows mitata's
// approach: warmup for JIT tiering, then batched iterations with per-batch
// timing so slow cases stay measurable without million-iteration loops.

import { readFileSync } from 'node:fs'
import { TOOLS } from './lib/tools.mjs'

const round = Number(process.argv.find((a, i) => process.argv[i - 1] === '--round') ?? 1)
const here = new URL('.', import.meta.url)
const read = (f) => readFileSync(new URL(`./fixtures/${f}`, here), 'utf8')
const SIZES = {
  small: 'small.txt',
  medium: 'medium.txt',
  large: 'wrapthai-test-50pages.txt',
}
const MAX_LENGTHS = [20, 40, 80]

function measure(fn, targetMs = 300) {
  // Warmup: let the JIT settle.
  for (let i = 0; i < 5; i++) fn()
  const samples = []
  let batch = 1
  let elapsed = 0
  // Calibrate batch size so one sample is >= ~1ms (performance.now resolution).
  for (;;) {
    const t0 = performance.now()
    for (let i = 0; i < batch; i++) fn()
    const dt = performance.now() - t0
    samples.push(dt / batch)
    elapsed += dt
    if (dt >= 1 || batch >= 1 << 16) break
    batch *= 2
  }
  // Collect until targetMs (at least 3 samples so slow cases still get spread).
  while (elapsed < targetMs || samples.length < 3) {
    const t0 = performance.now()
    for (let i = 0; i < batch; i++) fn()
    const dt = performance.now() - t0
    samples.push(dt / batch)
    elapsed += dt
  }
  samples.sort((a, b) => a - b)
  const n = samples.length
  const mean = samples.reduce((a, b) => a + b, 0) / n
  const quantile = (q) => samples[Math.min(n - 1, Math.floor(q * n))]
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return {
    iterations: batch * n,
    meanMs: mean,
    p50Ms: quantile(0.5),
    p99Ms: quantile(0.99),
    opsSec: 1000 / mean,
    relSd: Math.sqrt(variance) / mean,
  }
}

const results = {}
const textCache = {}
for (const size of Object.keys(SIZES)) textCache[size] = read(SIZES[size])

for (const tool of TOOLS) {
  for (const [size, file] of Object.entries(SIZES)) {
    const text = textCache[size]
    for (const max of MAX_LENGTHS) {
      const key = `${tool.key}/${size}/ml${max}`
      let r
      try {
        r = measure(() => tool.wrap(text, max))
      } catch (err) {
        r = { error: String(err && err.message ? err.message : err) }
      }
      results[key] = { tool: tool.key, label: tool.label, size, maxLength: max, ...r }
    }
  }
}

const out = {
  runtime: `node ${process.version}`,
  round,
  fixtures: {
    small: textCache.small.length,
    medium: textCache.medium.length,
    large: textCache.large.length,
  },
  results,
}
console.log(JSON.stringify(out))
