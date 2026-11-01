// Shared greedy line wrapper for segmentation-only tools, so every tool is
// compared on the same wrap algorithm. Semantics mirror crates/bench-compare.
//
// - Paragraphs are split on '\n'. Empty/whitespace-only paragraphs emit a blank
//   line "". Leading/trailing blank lines are dropped, interior ones kept.
// - A single space is kept between two words only where the input had
//   whitespace between them; adjacent tokens are joined directly (Thai has no
//   spaces between words). Whitespace at line edges is dropped.
// - U+200B is a break hint, not content: it is removed from tokens, as thaiwrap does.
// - Word tokens are atoms measured in UTF-16 code units (JS .length); a word
//   longer than maxLength stays alone on its own line (no mid-word cutting).

const isWhitespaceToken = (t) => t.length > 0 && /^\s+$/.test(t)

export function greedyWrap(tokenize, text, maxLength) {
  const paragraphs = text.split('\n')
  const lines = []
  let started = false
  let pendingBlank = false
  for (const para of paragraphs) {
    if (!para.trim()) {
      if (started) pendingBlank = true
      continue
    }
    if (pendingBlank) {
      lines.push('')
      pendingBlank = false
    }
    const tokens = tokenize(para)
    let cur = null
    let gap = false
    for (const raw of tokens) {
      if (isWhitespaceToken(raw)) {
        gap = true
        continue
      }
      const tok = raw.replace(/\u200B/g, '')
      if (tok === '') continue
      const sep = gap && cur !== null ? ' ' : ''
      if (cur === null) cur = tok
      else if (cur.length + sep.length + tok.length <= maxLength) cur += sep + tok
      else {
        lines.push(cur)
        cur = tok
      }
      gap = false
    }
    if (cur !== null) lines.push(cur)
    started = true
  }
  return lines
}
