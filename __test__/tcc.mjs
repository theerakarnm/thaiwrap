// Thai Character Cluster (TCC) ends: a verbatim JS port of the rule list in PyThaiNLP 5.4.0
// pythainlp/tokenize/tcc_p.py (tag v5.4.0, commit 7f26adf5ce09c3d77c39ca2ef86f7138e9071088, Apache-2.0).
// The rules come from Theeramunkong, Sornlertlamvanich, Tanhermhong and Chinnan, "Character cluster
// based Thai information retrieval", IRAL 2000, doi:10.1145/355214.355225.
// It is the test oracle for crates/thaiwrap-core/src/tcc.rs (through the fixtures that
// scripts/tcc-reference.mjs writes) and for the overflow split in reference.mjs.
// k = silent final (การันต์), c = consonant, t = optional tone mark, d = lower vowel; the first rule that matches wins.
const RULES = `
เc็ck
เcctาะk
เccีtยะk
เccีtย(?=[เ-ไก-ฮ]|$)k
เcc็ck
เcิc์ck
เcิtck
เcีtยะ?k
เcืtอะ?k
เc[ิีุู]tย(?=[เ-ไก-ฮ]|$)k
เctา?ะ?k
cัtวะk
c[ัื]tc[ุิะ]?k
c[ิุู]์
c[ะ-ู]tk
cรรc์
c็
ct[ะาำ]?k
ck
แc็c
แcc์
แctะ
แcc็c
แccc์
โctะ
[เ-ไ]ct
ก็
อึ
หึ
`
  .replaceAll('k', '(cc?[dิ]?[์])?')
  .replaceAll('c', '[ก-ฮ]')
  .replaceAll('t', '[่-๋]?')
  .replaceAll('d', 'ูุ')
  .split(/\s+/)
  .filter(Boolean)

const TCC = new RegExp(RULES.join('|'), 'uy')

/** Cluster ends of `text` as UTF-16 indices; a character that no rule matches is a cluster on its own. */
export function tccEnds(text) {
  const ends = []
  let i = 0
  while (i < text.length) {
    TCC.lastIndex = i
    const m = TCC.exec(text)
    i += m ? m[0].length : String.fromCodePoint(text.codePointAt(i)).length
    ends.push(i)
  }
  return ends
}
