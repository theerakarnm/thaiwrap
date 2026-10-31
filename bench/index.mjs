import { bench, group, run } from 'mitata'
import { wrapThai } from '../index.js'
import { wrapReference } from '../__test__/reference.mjs'

const SHORT = 'กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า'
const LONG = SHORT.repeat(300)
for (const [name, text] of [['short', SHORT], ['long', LONG]]) {
  group(name, () => {
    bench('thaiwrap', () => wrapThai(text, 10))
    bench('Intl.Segmenter reference', () => wrapReference(text, 10))
  })
}
await run()
