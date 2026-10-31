import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { wrapThai } from '../../index.js'

const expected = ['กระบวนการ', 'สื่อสาร', 'ส่งมอบ และ', 'สร้าง', 'คุณค่า']
const text = 'กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า'
assert.deepEqual(wrapThai(text, 10), expected)
assert.deepEqual(createRequire(import.meta.url)('../../index.js').wrapThai(text, 10), expected)
console.log('smoke ok', process.platform, process.arch, process.versions.bun ?? process.versions.node)
