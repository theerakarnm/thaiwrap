import { expect, test } from 'bun:test'
import { wrapThai } from '../index.js'
import { describeLoadFailure } from '../platform.js'
import { cases, invalidCases, platformCases } from './cases.mjs'

for (const c of cases) test(c.name, () => expect(wrapThai(...c.args)).toEqual(c.expected))
for (const c of invalidCases)
  test(c.name, () => {
    let error
    try { wrapThai(...c.args) } catch (e) { error = e }
    expect(error).toBeInstanceOf(globalThis[c.error.name])
    expect(error.message).toMatch(c.error.message)
  })
for (const c of platformCases)
  test(c.name, () => {
    const cause = new Error('cause')
    const error = describeLoadFailure(cause, c.current)
    expect(error.message).toMatch(c.expected)
    expect(error.cause).toBe(cause)
  })
test('process survives invalid calls', () => expect(wrapThai('ก', 1)).toEqual(['ก']))
