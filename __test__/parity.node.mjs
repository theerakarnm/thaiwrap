import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { computeParity, knownDiffsUrl } from './parity.mjs'

const UPDATE = process.env.THAIWRAP_UPDATE_PARITY === '1'
const key = (d) => `${d.id}@${d.maxLength}`
const sameLines = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const readKnown = (source) => {
  try {
    return JSON.parse(readFileSync(knownDiffsUrl(source), 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return undefined
    throw e
  }
}

for (const result of computeParity()) {
  const { source, diffs } = result
  test(`parity: ${source} matches the recorded Intl.Segmenter differences`, () => {
    const share = `${result.diffLines}/${result.comparedLines} corpus lines (${((100 * result.diffLines) / result.comparedLines).toFixed(1)}%)`
    console.log(`${source}: ${result.inputs} inputs, ${diffs.length} differences, ${share} have at least one; node ${process.version}, icu ${process.versions.icu}`)
    const known = readKnown(source)
    if (UPDATE) {
      // A verdict applies to one pair of outputs, so keep it only when both are unchanged.
      const previous = new Map((known?.diffs ?? []).map((d) => [key(d), d]))
      const verdictFor = (d) => {
        const old = previous.get(key(d))
        return old && sameLines(old.rust, d.rust) && sameLines(old.reference, d.reference) ? old.verdict : 'unreviewed'
      }
      const next = { node: process.version, icu: process.versions.icu, diffs: diffs.map((d) => ({ ...d, verdict: verdictFor(d) })) }
      writeFileSync(knownDiffsUrl(source), JSON.stringify(next, null, 2) + '\n')
      return
    }
    assert.ok(known, `${source}/parity-known-diffs.json is missing; generate it with THAIWRAP_UPDATE_PARITY=1`)
    assert.equal(known.icu, process.versions.icu, "Node's ICU changed; re-baseline with THAIWRAP_UPDATE_PARITY=1 in a reviewed PR")
    const recorded = new Map(known.diffs.map((d) => [key(d), d]))
    const observed = new Map(diffs.map((d) => [key(d), d]))
    for (const [k, d] of observed) {
      const r = recorded.get(k)
      assert.ok(r, `new difference not in parity-known-diffs.json: ${k}`)
      assert.deepEqual({ rust: d.rust, reference: d.reference }, { rust: r.rust, reference: r.reference }, `difference changed: ${k}`)
    }
    for (const k of recorded.keys()) assert.ok(observed.has(k), `recorded difference no longer occurs: ${k}`)
  })
}
