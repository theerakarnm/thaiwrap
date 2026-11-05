// Writes corpus/<source>/derived/tcc-ends.txt, the TCC fixtures that crates/thaiwrap-core/src/tcc.rs
// is tested against: per input line, the cluster ends in code points, space separated.
// Run from the repo root: node scripts/tcc-reference.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { tccEnds } from '../__test__/tcc.mjs'

for (const source of ['wisesight', 'wikipedia-th']) {
  const lines = readFileSync(`corpus/${source}/lines.txt`, 'utf8').split('\n')
  if (lines.at(-1) === '') lines.pop()
  const rows = lines.map((line) => tccEnds(line).map((end) => [...line.slice(0, end)].length).join(' '))
  writeFileSync(`corpus/${source}/derived/tcc-ends.txt`, rows.join('\n') + '\n')
}
