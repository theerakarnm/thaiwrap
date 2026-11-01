const ACCEPTANCE = 'กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า'
const ACCEPTANCE_LINES = ['กระบวนการ', 'สื่อสาร', 'ส่งมอบ และ', 'สร้าง', 'คุณค่า']

export const cases = [
  { name: 'acceptance', args: [ACCEPTANCE, 10], expected: ACCEPTANCE_LINES },
  { name: 'graphemes', args: [ACCEPTANCE, 10, { measure: 'graphemes' }], expected: ['กระบวนการ', 'สื่อสาร ส่ง', 'มอบ และ', 'สร้างคุณค่า'] },
  { name: 'overflow split cuts long words', args: [ACCEPTANCE, 4], expected: ['กระบ', 'วนกา', 'ร', 'สื่อ', 'สาร', 'ส่ง', 'มอบ', 'และ', 'สร้า', 'ง', 'คุณ', 'ค่า'] },
  { name: 'overflow split keeps Thai clusters whole', args: ['หมดเขต29ธันวาพี่เเอมไม่จำกัดเวลาด้วย', 10], expected: ['หมดเขต29', 'ธันวาพี่', 'เเอมไม่', 'จำกัดเวลา', 'ด้วย'] },
  { name: 'overflow keep leaves long words whole', args: [ACCEPTANCE, 4, { overflow: 'keep' }], expected: ['กระบวนการ', 'สื่อสาร', 'ส่ง', 'มอบ', 'และ', 'สร้าง', 'คุณค่า'] },
  { name: 'unsplittable grapheme may exceed maxLength', args: ['ที่', 1], expected: ['ที่'] },
  { name: 'ZWJ emoji sequence stays whole', args: ['👨‍👩‍👧', 2], expected: ['👨‍👩‍👧'] },
  { name: 'emoji are measured in code units', args: ['👍👍👍', 4], expected: ['👍👍', '👍'] },
  { name: 'emoji are measured in graphemes on request', args: ['👨‍👩‍👧 ok', 4, { measure: 'graphemes' }], expected: ['👨‍👩‍👧 ok'] },
  { name: 'interior spaces are broken and trimmed', args: ['ส่งมอบ   และ', 6], expected: ['ส่งมอบ', 'และ'] },
  { name: 'hard break', args: ['บรรทัดแรก\nบรรทัดสอง', 50], expected: ['บรรทัดแรก', 'บรรทัดสอง'] },
  { name: 'blank: empty', args: ['', 10], expected: [] },
  { name: 'blank: spaces', args: ['   ', 10], expected: [] },
  { name: 'blank: newlines only', args: ['\n\n', 10], expected: [] },
  { name: 'blank: one between', args: ['ก\n\nข', 10], expected: ['ก', '', 'ข'] },
  { name: 'blank: edges dropped', args: ['\n\nก\n\n', 10], expected: ['ก'] },
  { name: 'blank: two between kept', args: ['ก\n\n\nข', 10], expected: ['ก', '', '', 'ข'] },
  { name: 'lone surrogate becomes U+FFFD in v0.1', args: ['a\uD800b', 10], expected: ['a\uFFFDb'] },
  { name: 'null options mean defaults', args: [ACCEPTANCE, 10, null], expected: ACCEPTANCE_LINES },
  { name: 'empty options mean defaults', args: [ACCEPTANCE, 10, {}], expected: ACCEPTANCE_LINES },
  { name: 'unknown option keys are ignored', args: [ACCEPTANCE, 10, { foo: 1 }], expected: ACCEPTANCE_LINES },
]

const range = (message) => ({ name: 'RangeError', message })
const type = (message) => ({ name: 'TypeError', message })
export const invalidCases = [
  ...[0, -1, NaN, 1.5, Infinity, -Infinity, 2 ** 53].map((n) => ({
    name: `maxLength ${n}`, args: ['ก', n], error: range(/^maxLength must be a positive integer, got /),
  })),
  ...[[1e21, '1e+21'], [5e-324, '5e-324'], [-0, '0']].map(([n, shown]) => ({
    name: `maxLength message shows ${shown}`, args: ['ก', n], error: range(new RegExp(`^maxLength must be a positive integer, got ${shown.replace('+', '\\+')}$`)),
  })),
  ...['10', undefined, null].map((v) => ({
    name: `maxLength ${typeof v}`, args: ['ก', v], error: type(/^maxLength must be a number, got /),
  })),
  { name: 'maxLength bigint', args: ['ก', 10n], error: type(/^maxLength must be a number, got bigint$/) },
  ...[123, null, undefined].map((v) => ({ name: `text ${v}`, args: [v, 10], error: type(/^text must be a string, got /) })),
  { name: 'text is checked first', args: [1, 0], error: type(/^text must be a string, got number$/) },
  { name: 'options string', args: ['ก', 10, 'x'], error: type(/^options must be an object, got string$/) },
  { name: 'options.measure number', args: ['ก', 10, { measure: 1 }], error: type(/^options\.measure must be a string, got number$/) },
  { name: 'options.measure null', args: ['ก', 10, { measure: null }], error: type(/^options\.measure must be a string, got null$/) },
  { name: 'options.measure unknown', args: ['ก', 10, { measure: 'bytes' }], error: range(/^options\.measure must be "codeUnits" or "graphemes", got "bytes"$/) },
  { name: 'options.overflow unknown', args: ['ก', 10, { overflow: 'cut' }], error: range(/^options\.overflow must be "split" or "keep", got "cut"$/) },
]

export const platformCases = [
  { name: 'unsupported platform is named', current: 'linux-arm64-musl', expected: /^thaiwrap has no prebuilt binary for linux-arm64-musl\. Supported: linux-x64-gnu, linux-arm64-gnu, linux-x64-musl, darwin-arm64, darwin-x64, win32-x64-msvc\.$/ },
  { name: 'missing binary names the package', current: 'linux-x64-gnu', expected: /^thaiwrap could not load its native binary for linux-x64-gnu \(package @thaiwrap\/binding-linux-x64-gnu\)\./ },
]
