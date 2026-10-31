// The file name keeps `bun test` from picking it up.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { wrapThai } from '../index.js'
import platform from '../platform.js'
import { cases, invalidCases, platformCases } from './cases.mjs'

for (const c of cases) test(c.name, () => assert.deepEqual(wrapThai(...c.args), c.expected))
for (const c of invalidCases)
  test(c.name, () => assert.throws(() => wrapThai(...c.args), (e) => e instanceof globalThis[c.error.name] && c.error.message.test(e.message)))
for (const c of platformCases)
  test(c.name, () => {
    const cause = new Error('cause')
    const error = platform.describeLoadFailure(cause, c.current)
    assert.match(error.message, c.expected)
    assert.equal(error.cause, cause)
  })
test('process survives invalid calls', () => assert.deepEqual(wrapThai('ก', 1), ['ก']))
test('export surface is exactly wrapThai', () => assert.deepEqual(Object.keys(createRequire(import.meta.url)('../index.js')), ['wrapThai']))
