// Test oracle for Thai-letter, Thai-digit and space text only (see THAI_RUN in parity.mjs).
// It breaks at word boundaries because Intl.Segmenter has no line granularity, so it differs
// from thaiwrap's UAX #14 line breaks on punctuation, for example around "?" and ")".
const words = new Intl.Segmenter('th', { granularity: 'word' })
const graphemes = new Intl.Segmenter('th', { granularity: 'grapheme' })
const HARD_BREAK = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/
const isMark = (c) => /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(c)
const isLeading = (c) => /[\u0E40-\u0E44]/.test(c)
const isNoStart = (c) => /[\u0E30\u0E32\u0E33\u0E46\u0E2F]/.test(c)
const isBreakSpace = (c) => c === '\u200B' || (/\p{White_Space}/u.test(c) && !/[\u00A0\u2007\u202F]/.test(c))
const isVisible = (c) => !(c === '\u200B' || /\p{White_Space}/u.test(c))
const len = (s, measure) => (measure === 'graphemes' ? [...graphemes.segment(s)].length : s.length)

const isNoBreak = (c) => /[\u00A0\u2007\u202F\u2060\uFEFF]/.test(c ?? '')

function allowed(para, pos) {
  if (pos < para.length && isBreakSpace(para[pos])) return false
  if (isNoBreak(para[pos - 1]) || isNoBreak(para[pos])) return false
  let i = pos - 1
  while (i >= 0 && isBreakSpace(para[i])) i--
  let j = pos
  while (j < para.length && isBreakSpace(para[j])) j++
  if (i < 0 || j >= para.length) return true
  return !(isMark(para[j]) || isNoStart(para[j]) || isLeading(para[i]))
}

function trimBreakSpaces(s) {
  let a = 0, b = s.length
  while (a < b && isBreakSpace(s[a])) a++
  while (b > a && isBreakSpace(s[b - 1])) b--
  return [s.slice(a, b), s.slice(b)]
}

function splitOverflow(word, max, measure) {
  const cuts = [...graphemes.segment(word)].map((g) => g.index).filter((i) => i > 0 && allowed(word, i))
  cuts.push(word.length)
  const chunks = []
  let start = 0
  for (const cut of cuts) {
    const piece = word.slice(start, cut)
    const w = len(piece, measure)
    const last = chunks.at(-1)
    if (last && last.len + w <= max) { last.text += piece; last.len += w } else chunks.push({ text: piece, len: w })
    start = cut
  }
  return chunks
}

function wrapParagraph(para, max, measure, overflow, out) {
  const push = (s) => {
    const [content] = trimBreakSpaces(s)
    if ([...content].some(isVisible)) out.push(content)
  }
  // Like segment::units, keep only word breaks that are grapheme cluster boundaries.
  const clusterStarts = new Set([...graphemes.segment(para)].map((g) => g.index))
  const ends = []
  for (const { index } of words.segment(para)) if (index > 0 && clusterStarts.has(index) && allowed(para, index)) ends.push(index)
  ends.push(para.length)
  let start = 0, line = null, gap = ''
  for (const end of ends) {
    const [content, trailing] = trimBreakSpaces(para.slice(start, end))
    start = end
    if (!content) continue
    const w = len(content, measure)
    if (line && line.len + len(gap, measure) + w <= max) {
      line.text += gap + content
      line.len += len(gap, measure) + w
    } else {
      if (line) push(line.text)
      if (w > max && overflow === 'split') {
        const chunks = splitOverflow(content, max, measure)
        line = chunks.pop()
        for (const c of chunks) push(c.text)
      } else line = { text: content, len: w }
    }
    gap = trailing
  }
  if (line) push(line.text)
}

export function wrapReference(text, maxLength, options) {
  const { measure = 'codeUnits', overflow = 'split' } = options ?? {}
  const paras = text.split(HARD_BREAK)
  if (paras.at(-1) === '') paras.pop()
  const out = []
  for (const para of paras) {
    const before = out.length
    wrapParagraph(para, maxLength, measure, overflow, out)
    if (out.length === before) out.push('')
  }
  while (out[0] === '') out.shift()
  while (out.at(-1) === '') out.pop()
  return out
}
