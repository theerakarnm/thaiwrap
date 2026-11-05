// Runs bench/gate.mjs on Node 22 (local node), Node 24.22.2 and Bun 1.4.4, three times,
// alternating builds, and prints the median per case. See docs/v0.2/.
//   node bench/gate-ab.mjs ab <baseDir> <candDir> <case>...    candidate vs baseline build
//   node bench/gate-ab.mjs pairs <dir> <new>:<old>...          one case vs another, same build
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const RUNTIMES = [['node'], ['npx', '-y', 'node@24.22.2'], ['npx', '-y', 'bun@1.4.4']]
const GATE = resolve(import.meta.dirname, 'gate.mjs')
const run = ([cmd, ...pre], dir, names) =>
  execFileSync(cmd, [...pre, GATE, ...names], { env: { ...process.env, THAIWRAP_DIR: dir }, encoding: 'utf8' })
    .trim().split('\n').map((l) => JSON.parse(l))
const median = (xs) => [...xs].sort((a, b) => a - b)[1]
const pct = (now, was) => `${(((now - was) / was) * 100).toFixed(1)}%`

const [mode, ...args] = process.argv.slice(2)
for (const rt of RUNTIMES) {
  const times = new Map()
  let label = ''
  const add = (key, r) => {
    label = r.runtime
    times.set(key, [...(times.get(key) ?? []), r.ns])
  }
  if (mode === 'ab') {
    const [base, cand, ...names] = args
    for (let i = 0; i < 3; i++)
      for (const [tag, dir] of [['base', base], ['cand', cand]])
        for (const r of run(rt, resolve(dir), names)) add(`${tag} ${r.name}`, r)
    console.log(`\n${label}\n\n| case | baseline ns | candidate ns | change |\n| --- | --- | --- | --- |`)
    for (const n of names) {
      const was = median(times.get(`base ${n}`)), now = median(times.get(`cand ${n}`))
      console.log(`| ${n} | ${was.toFixed(0)} | ${now.toFixed(0)} | ${pct(now, was)} |`)
    }
  } else if (mode === 'pairs') {
    const [dir, ...pairs] = args
    for (const p of pairs) {
      const [a, b, ...rest] = p.split(':')
      if (!a || !b || rest.length > 0 || a === b) throw new Error(`pairs needs <new>:<old> with two different cases, got ${p}`)
    }
    const names = [...new Set(pairs.flatMap((p) => p.split(':')))]
    for (let i = 0; i < 3; i++) for (const r of run(rt, resolve(dir), names)) add(r.name, r)
    console.log(`\n${label}\n\n| new | old | new ns | old ns | change |\n| --- | --- | --- | --- | --- |`)
    for (const p of pairs) {
      const [a, b] = p.split(':')
      const now = median(times.get(a)), was = median(times.get(b))
      console.log(`| ${a} | ${b} | ${now.toFixed(0)} | ${was.toFixed(0)} | ${pct(now, was)} |`)
    }
  } else throw new Error('mode must be ab or pairs')
}
