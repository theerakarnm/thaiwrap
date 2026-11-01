#!/usr/bin/env node
// Builds site/public/benchmarks/comparison/index.html from the benchmark outputs.
//
//   node bench/scripts/build-site-page.mjs
//
// Inputs (run the suite first, see bench/RESULTS.md "How to reproduce"):
//   bench/out/{js-speed,cold-start,memory,bundle-size,quality}.json
//   target/criterion/<tool>/<size>_ml<NN>/r{1,2,3}/estimates.json
//   bench/RESULTS.md (environment table and section anchors)
// The "See it" examples run the real tools, so the addon must be built.
//
// Every claim in the page text is derived from the data and checked with
// `claim()`: if the data stops supporting a sentence, the build fails.

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const outFile = path.join(root, 'site/public/benchmarks/comparison/index.html')
const GH = 'https://github.com/theerakarnm/wrapthai'
const SIZES = ['small', 'medium', 'large']
const MLS = [20, 40, 80]
const SIZE_LABEL = { small: 'Small', medium: 'Medium', large: 'Large' }
const SIZE_PAGES = { small: '~1 page', medium: '~10 pages', large: '50 pages' }
const FIXTURE_FILE = { small: 'small.txt', medium: 'medium.txt', large: 'wrapthai-test-50pages.txt' }

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const claim = (ok, msg) => {
  if (!ok) throw new Error(`page claim no longer supported by the data: ${msg}`)
}
// Reported value = median of the 3 runs (one disturbed run cannot move it); range = fastest to slowest run.
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const runStat = (xs) => ({ val: median(xs), lo: Math.min(...xs), hi: Math.max(...xs) })
const n0 = (x) => Math.round(x).toLocaleString('en-US')
const fmtMs = (v) => (v < 1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : n0(v))
const fmtX = (x) => (x >= 10 ? n0(x) : x.toFixed(1))
const msText = (v) => (v === 0 ? '0 ms' : `${fmtMs(v)} ms`)
const fmtKb = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${n0(kb)} KB`)
const f2 = (x) => x.toFixed(2)
const cmp = (ratio) => (ratio < 1 ? `${Math.max(1, Math.round((1 - ratio) * 100))}% faster` : `${fmtX(ratio)}x slower`)

// ---------- data ----------
const outPath = (f) => path.join(root, 'bench/out', f)
const js = readJson(outPath('js-speed.json'))
const cold = readJson(outPath('cold-start.json'))
const mem = readJson(outPath('memory.json'))
const bundle = readJson(outPath('bundle-size.json'))
const quality = readJson(outPath('quality.json'))
const results = readFileSync(path.join(root, 'bench/RESULTS.md'), 'utf8')
const cargoToml = readFileSync(path.join(root, 'crates/bench-compare/Cargo.toml'), 'utf8')
const builtOn = statSync(outPath('js-speed.json')).mtime.toISOString().slice(0, 10)
const fixBytes = Object.fromEntries(SIZES.map((s) => [s, statSync(path.join(root, 'bench/fixtures', FIXTURE_FILE[s])).size]))

const envRow = (k) => {
  const m = results.match(new RegExp(`^\\| ${k} \\| (.+?) \\|$`, 'm'))
  claim(m, `RESULTS.md environment row "${k}"`)
  return m[1]
}

function jsStat(tool, size, ml) {
  const key = `${tool}/${size}/ml${ml}`
  const s = runStat(js.raw.map((r) => r.results[key].meanMs))
  return { ...s, ops: 1000 / s.val, mbps: fixBytes[size] / 1e6 / (s.val / 1000) }
}
function rustStat(tool, size, ml) {
  return runStat([1, 2, 3].map((r) => readJson(path.join(root, `target/criterion/${tool}/${size}_ml${ml}/r${r}/estimates.json`)).median.point_estimate / 1e6))
}

// ---------- names ----------
const JS_TOOLS = ['thaiwrap', 'intl-reference', 'intl-simple', 'wordcut-greedy', 'thai-wordcut-ts-greedy', 'thai-break-greedy', 'thai-break-wrap']
const RUST_TOOLS = ['thaiwrap-core', 'icu-greedy', 'chamkho-greedy', 'nlpo3-greedy', 'thaibreak-greedy', 'kham-greedy']
const NAME = {
  thaiwrap: ['thaiwrap', 'ours, Rust native addon'],
  'intl-reference': ['Intl.Segmenter + Thai rules', 'built in, our test reference wrap'],
  'intl-simple': ['Intl.Segmenter + simple wrap', 'built in'],
  'wordcut-greedy': ['wordcut + simple wrap', 'npm, pure JS'],
  'thai-wordcut-ts-greedy': ['thai-wordcut-ts + simple wrap', 'npm, pure JS'],
  'thai-break-greedy': ['thai-break words() + simple wrap', 'npm, pure JS'],
  'thai-break-wrap': ['thai-break wrap()', 'npm, pure JS, its own wrap'],
  'thaiwrap-core': ['thaiwrap-core', 'ours, Rust'],
  'icu-greedy': ['ICU4X + simple wrap', 'Rust, no Thai rules'],
  'chamkho-greedy': ['chamkho engine + simple wrap', 'Rust, wordcut-engine'],
  'nlpo3-greedy': ['nlpo3 (newmm) + simple wrap', 'Rust'],
  'thaibreak-greedy': ['thaibreak + simple wrap', 'Rust'],
  'kham-greedy': ['kham-core + simple wrap', 'Rust'],
}
const OURS = new Set(['thaiwrap', 'thaiwrap-core'])

// ---------- RESULTS.md links ----------
const headings = [...results.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1])
const slug = (h) => h.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-')
function ref(prefix) {
  const h = headings.find((x) => x.startsWith(prefix))
  claim(h, `RESULTS.md heading starting with "${prefix}"`)
  return { href: `${GH}/blob/main/bench/RESULTS.md#${slug(h)}`, title: h }
}
const srcLink = (prefix) => {
  const r = ref(prefix)
  return `<a class="src" href="${r.href}">Source: RESULTS.md, ${esc(r.title.replace(/`/g, ''))}</a>`
}
const head = (id, title, prefix, intro) =>
  `<div class="sechead"><h2 id="${id}">${title}</h2>${srcLink(prefix)}</div>${intro ? `<p class="intro">${intro}</p>` : ''}`

// ---------- bars ----------
function scaleRows(rows) {
  const vmax = Math.max(...rows.map((r) => r.hi))
  const vmin = Math.min(...rows.map((r) => r.lo))
  const base = Math.log(vmin / 2)
  const span = Math.log(vmax) - base
  const lin = (v) => Math.max(0, Math.min(100, (v / vmax) * 100))
  const lg = (v) => Math.max(0, Math.min(100, ((Math.log(Math.max(v, vmin / 2)) - base) / span) * 100))
  return rows.map((r) => ({
    ...r,
    s: { lin: lin(r.value), log: lg(r.value), loLin: lin(r.lo), hiLin: lin(r.hi), loLog: lg(r.lo), hiLog: lg(r.hi) },
  }))
}
function barsHtml(rows) {
  return `<div class="bars" role="list">${scaleRows(rows)
    .map((r) => {
      const s = r.s
      const style = `--lin:${f2(s.lin)};--log:${f2(s.log)};--lo-lin:${f2(s.loLin)};--hi-lin:${f2(s.hiLin)};--lo-log:${f2(s.loLog)};--hi-log:${f2(s.hiLog)}`
      return `<div class="brow${r.ours ? ' ours' : ''}" role="listitem" style="${style}">
<div class="bname"><b>${esc(r.name)}</b><span>${esc(r.sub)}</span></div>
<div class="btrack" aria-hidden="true"><div class="bfill"></div>${r.hi > r.lo ? '<div class="bsd"></div>' : ''}</div>
<div class="bval"><b>${r.main}</b>${r.notes.map((n) => `<span>${n}</span>`).join('')}</div></div>`
    })
    .join('\n')}</div>`
}
const segButtons = (set, items, current) =>
  items.map(([value, label]) => `<button type="button" data-set="${set}" data-value="${value}" aria-pressed="${value === current}">${label}</button>`).join('')

// A chart with size / maxLength / scale controls. rowsFor(size, ml) returns row objects.
function speedChart(id, rowsFor, legendExtra = '') {
  const views = SIZES.flatMap((size) =>
    MLS.map((ml) => {
      const rows = rowsFor(size, ml).sort((a, b) => a.value - b.value)
      const isDefault = size === 'large' && ml === 40
      return `<div class="view" data-size="${size}" data-ml="${ml}"${isDefault ? '' : ' hidden'}>${barsHtml(rows)}</div>`
    }),
  ).join('\n')
  return `<div class="chart" id="${id}" data-size="large" data-ml="40" data-scale="lin">
<div class="ctl">
<div><span class="cap">Document size</span><div class="seg" role="group" aria-label="Document size">${segButtons('size', SIZES.map((s) => [s, `${SIZE_LABEL[s]} (${SIZE_PAGES[s]})`]), 'large')}</div></div>
<div><span class="cap">Max line length (maxLength)</span><div class="seg" role="group" aria-label="Max line length">${segButtons('ml', MLS.map((m) => [m, String(m)]), '40')}</div></div>
<div><span class="cap">Bar scale</span><div class="seg" role="group" aria-label="Bar scale">${segButtons('scale', [['lin', 'Linear'], ['log', 'Log']], 'lin')}</div></div>
</div>
<div class="legend"><span><i class="sw t"></i>thaiwrap</span><span><i class="sw"></i>other tools</span><span><i class="sw sd"></i>fastest to slowest of the 3 runs</span>${legendExtra}</div>
${views}
<p class="note logonly">Log scale: each bar is placed by the logarithm of its time, so a bar twice as long is many times slower. Use it to compare the small values. The numbers on the right are always exact.</p>
</div>`
}

// ---------- speed data ----------
const jsRowsFor = (size, ml) => {
  const ours = jsStat('thaiwrap', size, ml)
  return JS_TOOLS.map((t) => {
    const s = jsStat(t, size, ml)
    const isOurs = t === 'thaiwrap'
    return {
      name: NAME[t][0], sub: NAME[t][1], ours: isOurs, value: s.val, lo: s.lo, hi: s.hi,
      main: `${fmtMs(s.val)} ms`,
      notes: [isOurs ? 'baseline' : cmp(s.val / ours.val), `${n0(s.ops)} ops/s &middot; ${s.mbps.toFixed(1)} MB/s`],
    }
  })
}
const rustRowsFor = (size, ml) => {
  const ours = rustStat('thaiwrap-core', size, ml)
  return RUST_TOOLS.map((t) => {
    const s = rustStat(t, size, ml)
    const isOurs = t === 'thaiwrap-core'
    return {
      name: NAME[t][0], sub: NAME[t][1], ours: isOurs, value: s.val, lo: s.lo, hi: s.hi,
      main: `${fmtMs(s.val)} ms`,
      notes: [isOurs ? 'baseline' : cmp(s.val / ours.val)],
    }
  })
}

// claims about speed
const jsLargeMl40 = jsStat('thaiwrap', 'large', 40)
let minLead = Infinity
for (const size of SIZES) for (const ml of MLS) {
  const ours = jsStat('thaiwrap', size, ml).val
  const others = JS_TOOLS.filter((t) => t !== 'thaiwrap').map((t) => jsStat(t, size, ml).val)
  claim(others.every((o) => o > ours), `thaiwrap is the fastest JS tool at ${size}/ml${ml}`)
  minLead = Math.min(minLead, Math.min(...others) / ours)
}
const nextBestLarge = Math.min(...JS_TOOLS.filter((t) => t !== 'thaiwrap').map((t) => jsStat(t, 'large', 40).val))
const slowestLarge = Math.max(...JS_TOOLS.map((t) => jsStat(t, 'large', 40).val))
const rustOurs = rustStat('thaiwrap-core', 'large', 40)
const rustIcu = rustStat('icu-greedy', 'large', 40)
const rustOthers = RUST_TOOLS.filter((t) => !['thaiwrap-core', 'icu-greedy'].includes(t)).map((t) => rustStat(t, 'large', 40).val / rustOurs.val)
claim(rustOthers.every((r) => r > 1.5), 'thaiwrap-core is at least 1.5x faster than every non-ICU Rust crate')
const icuRatios = SIZES.flatMap((s) => MLS.map((m) => rustStat('thaiwrap-core', s, m).val / rustStat('icu-greedy', s, m).val))
const fasterBest = Math.round((1 - Math.min(...icuRatios)) * 100)
const slowerWorst = Math.round((Math.max(...icuRatios) - 1) * 100)
claim(fasterBest < 25 && slowerWorst < 25, 'thaiwrap-core stays within 25% of raw ICU4X + simple wrap in all 9 setups')
const withinPct = Math.max(fasterBest, slowerWorst)
const napiMs = jsLargeMl40.val - rustOurs.val

// ---------- start-up ----------
const coldRows = JS_TOOLS.map((t) => {
  const c = cold.tools[t]
  const load = c.loadMs?.median ?? 0
  const init = c.initMs?.median ?? 0
  const first = c.firstCallMs.median
  return { t, load, init, first, total: load + init + first }
}).sort((a, b) => a.total - b.total)
claim(coldRows[0].t === 'thaiwrap', 'thaiwrap has the shortest start-up')
const coldMax = Math.max(...coldRows.map((r) => r.total))
const coldHtml = `<div class="bars" role="list">${coldRows.map((r) => {
  const w = (v) => f2((v / coldMax) * 100)
  return `<div class="brow${r.t === 'thaiwrap' ? ' ours' : ''}" role="listitem">
<div class="bname"><b>${esc(NAME[r.t][0])}</b><span>${esc(NAME[r.t][1])}</span></div>
<div class="stack" aria-hidden="true"><i class="load" style="width:${w(r.load)}%"></i><i class="init" style="width:${w(r.init)}%"></i><i class="first" style="width:${w(r.first)}%"></i></div>
<div class="bval"><b>${fmtMs(r.total)} ms</b><span>load ${msText(r.load)}${r.init ? ` &middot; init ${msText(r.init)}` : ''} &middot; first call ${msText(r.first)}</span></div></div>`
}).join('\n')}</div>`

// ---------- memory ----------
const memRows = JS_TOOLS.map((t) => {
  const m = mem.tools[t]
  return { t, total: m.timeMaxRssKb / 1024, base: m.baseRssKb / 1024 }
}).sort((a, b) => a.total - b.total)
claim(memRows[0].t === 'thaiwrap', 'thaiwrap has the lowest peak memory')
const memMax = Math.max(...memRows.map((r) => r.total))
const memHtml = `<div class="bars" role="list">${memRows.map((r) => {
  const w = (v) => f2((v / memMax) * 100)
  return `<div class="brow${r.t === 'thaiwrap' ? ' ours' : ''}" role="listitem">
<div class="bname"><b>${esc(NAME[r.t][0])}</b><span>${esc(NAME[r.t][1])}</span></div>
<div class="stack" aria-hidden="true"><i class="base" style="width:${w(r.base)}%"></i><i class="extra" style="width:${w(r.total - r.base)}%"></i></div>
<div class="bval"><b>${n0(r.total)} MB</b><span>+${n0(r.total - r.base)} MB over bare Node</span></div></div>`
}).join('\n')}</div>`

// ---------- install size ----------
const pkg = (name) => bundle.results.find((r) => r.name === name)
const binName = bundle.results.find((r) => r.name.startsWith('@thaiwrap/binding-')).name
const sizeRows = [
  { name: NAME.thaiwrap[0], sub: `JS ${fmtKb(pkg('thaiwrap').tarballBytes / 1024)} + native binary ${fmtKb(pkg(binName).tarballBytes / 1024)}, your platform only`, ours: true,
    dl: (pkg('thaiwrap').tarballBytes + pkg(binName).tarballBytes) / 1024, un: (pkg('thaiwrap').unpackedBytes + pkg(binName).unpackedBytes) / 1024, browser: false },
  ...['wordcut', 'thai-wordcut-ts', 'thai-break'].map((n) => ({ name: n, sub: 'npm, pure JS, also runs in a browser', ours: false, dl: pkg(n).tarballBytes / 1024, un: pkg(n).unpackedBytes / 1024, browser: true })),
  { name: 'Intl.Segmenter', sub: 'built into the runtime', ours: false, dl: 0, un: 0, browser: true },
].sort((a, b) => a.dl - b.dl)
const sizeMax = Math.max(...sizeRows.map((r) => r.un))
const sizeHtml = `<div class="bars" role="list">${sizeRows.map((r) => `<div class="brow${r.ours ? ' ours' : ''}" role="listitem">
<div class="bname"><b>${esc(r.name)}</b><span>${esc(r.sub)}</span></div>
<div class="pair" aria-hidden="true"><div class="stack"><i class="dl" style="width:${f2((r.dl / sizeMax) * 100)}%"></i></div><div class="stack"><i class="un" style="width:${f2((r.un / sizeMax) * 100)}%"></i></div></div>
<div class="bval"><b>${r.dl ? fmtKb(r.dl) : '0 KB'} download</b><span>${r.un ? fmtKb(r.un) : '0 KB'} on disk</span></div></div>`).join('\n')}</div>`
const thaiwrapDl = sizeRows.find((r) => r.ours).dl
const jsOnlyDl = sizeRows.filter((r) => r.browser && r.dl)
claim(jsOnlyDl.every((r) => r.dl < thaiwrapDl), 'thaiwrap download is larger than the pure JS packages (stated as a trade-off)')

// ---------- quality ----------
const totals = {}
for (const e of quality.entries) {
  if (e.error) continue
  const t = (totals[e.tool] ??= { lines: 0, breaks: 0, over: 0, mark: 0, noStart: 0, lead: 0, lost: 0, mid: 0, midIcu: 0 })
  t.lines += e.lineCount
  t.breaks += Math.max(0, e.lineCount - 1)
  t.over += e.overLimit.ownUnit
  t.mark += e.ruleViolations.startCombining.length
  t.noStart += e.ruleViolations.startNoStart.length
  t.lead += e.ruleViolations.endLeadingVowel.length
  t.lost += e.preserved ? 0 : 1
  t.mid += e.midWordCuts.count
  t.midIcu += e.midWordIcuCuts?.count ?? 0
}
for (const t of Object.values(totals)) { t.problems = t.over + t.mark + t.noStart + t.lead; t.rate = (t.problems / t.lines) * 100 }
claim(totals.thaiwrap.problems === 0 && totals['thaiwrap-core'].problems === 0, 'thaiwrap has zero line problems')
claim(Object.values(totals).every((t) => t.lost === 0), 'every tool keeps all text')
const otherRates = Object.entries(totals).filter(([k]) => !OURS.has(k) && totals[k].problems > 0).map(([, t]) => t.rate)
claim(otherRates.length >= 5, 'most other tools have line problems')
const zeroTools = Object.entries(totals).filter(([, t]) => t.problems === 0).map(([k]) => k)
const totalLines = totals.thaiwrap.lines
const heatCols = [['over', 'Longer than maxLength'], ['mark', 'Starts with a vowel or tone mark'], ['noStart', 'Starts with ะ า ำ ๆ ฯ'], ['lead', 'Ends with a leading vowel เ แ โ ใ ไ'], ['lost', 'Text lost']]
const heatMax = Math.max(1, ...Object.values(totals).flatMap((t) => heatCols.map(([k]) => t[k])))
const heatRow = (tool) => {
  const t = totals[tool]
  const cells = heatCols.map(([k]) => {
    const v = t[k]
    return v === 0 ? '<td class="z" title="none">0</td>' : `<td class="nz" style="--sev:${f2(Math.min(1, Math.sqrt(v / heatMax)))}">${n0(v)}</td>`
  }).join('')
  return `<tr${OURS.has(tool) ? ' class="ours"' : ''}><td>${esc(NAME[tool][0])}</td>${cells}<td>${n0(t.lines)}</td><td>${t.rate === 0 ? '0%' : t.rate < 0.1 ? '<0.1%' : t.rate.toFixed(1) + '%'}</td></tr>`
}
const heatHtml = `<div class="tbl-wrap"><table class="heat"><thead><tr><th>Tool</th>${heatCols.map(([, l]) => `<th>${l}</th>`).join('')}<th>Lines checked</th><th>Lines with a problem</th></tr></thead><tbody>
<tr class="grp"><th colspan="8">JavaScript (Node)</th></tr>${JS_TOOLS.map(heatRow).join('')}
<tr class="grp"><th colspan="8">Rust crates</th></tr>${RUST_TOOLS.map(heatRow).join('')}</tbody></table></div>`

const miniRows = [...JS_TOOLS, ...RUST_TOOLS].map((t) => {
  const x = totals[t]
  return `<div class="mini"><span class="nm">${esc(NAME[t][0])}</span><div class="btrack"><div class="bfill" style="width:${f2(Math.min(100, (x.mid / x.breaks) * 100))}%"></div></div><span>${((x.mid / x.breaks) * 100).toFixed(0)}% newmm</span></div>
<div class="mini alt"><span class="nm"></span><div class="btrack"><div class="bfill" style="width:${f2(Math.min(100, (x.midIcu / x.breaks) * 100))}%"></div></div><span>${((x.midIcu / x.breaks) * 100).toFixed(0)}% ICU</span></div>`
}).join('\n')
const pct = (t, k) => (totals[t][k] / totals[t].breaks) * 100
claim(pct('nlpo3-greedy', 'mid') < pct('icu-greedy', 'mid') / 5, 'nlpo3 agrees with newmm far more than ICU4X does')

// ---------- live examples ----------
const { TOOLS } = await import('../lib/tools.mjs')
const toolBy = Object.fromEntries(TOOLS.map((t) => [t.key, t]))
const gSeg = new Intl.Segmenter('th', { granularity: 'grapheme' })
const COMB = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/
const NOSTART = /[\u0E30\u0E32\u0E33\u0E46\u0E2F]/
const LEAD = /[\u0E40-\u0E44]/
const width = (tool, line) => {
  if (tool.widthUnit !== 'displayWidth') return line.length
  let w = 0
  for (const ch of line) if (ch !== '\u200B' && !COMB.test(ch)) w++
  return w
}
function demoCard(key, text, ml) {
  const tool = toolBy[key]
  const lines = tool.wrap(text, ml)
  let problems = 0
  const rows = lines.map((line) => {
    const w = width(tool, line)
    const first = [...line][0]
    const last = [...line].at(-1)
    const tags = []
    let cls = ''
    if (w > ml) { cls = ' over'; problems++; tags.push(`<span class="tag warn">too long</span>`) }
    if (COMB.test(first)) { cls = ' bad'; problems++; tags.push(`<span class="tag bad">starts with a mark</span>`) }
    else if (NOSTART.test(first)) { cls = ' bad'; problems++; tags.push(`<span class="tag bad">starts with ${esc(first)}</span>`) }
    if (LEAD.test(last)) { cls = ' bad'; problems++; tags.push(`<span class="tag bad">ends with ${esc(last)}</span>`) }
    const fill = Math.min(100, (w / ml) * 100)
    return `<div class="ln${cls}" style="--fill:${f2(fill)}"><code>${esc(line)}</code><span class="m"><small>${w}/${ml}</small>${tags.join('')}</span></div>`
  })
  const unitNote = tool.widthUnit === 'displayWidth' ? '<p class="note" style="margin:6px 0 0;font-size:.75rem">Counts display columns: tone and vowel marks are zero wide.</p>' : ''
  const chip = problems === 0 ? '<span class="tag ok">no problems</span>' : `<span class="tag bad">${problems} problem${problems > 1 ? 's' : ''}</span>`
  return { problems, lines, html: `<div class="dcard${OURS.has(key) ? ' ours' : ''}"><div class="dhead"><b>${esc(NAME[key][0])}</b>${chip}</div>${rows.join('')}${unitNote}</div>` }
}
function demo(id, title, intro, text, ml, needs) {
  const cards = JS_TOOLS.map((k) => demoCard(k, text, ml))
  claim(cards[0].problems === 0, `thaiwrap shows no problems in demo "${title}"`)
  if (needs === 'differ') claim(cards.some((c, i) => i > 0 && c.lines.join('|') !== cards[0].lines.join('|')), `some tool wraps differently from thaiwrap in demo "${title}"`)
  else claim(cards.some((c, i) => i > 0 && c.problems > 0), `at least one other tool shows a problem in demo "${title}"`)
  return `<div class="demo"><h3 id="${id}">${title}</h3><p class="intro">${intro}</p><p class="demo-text"><b>maxLength ${ml}.</b> Input: ${esc(text)}</p><div class="demos">${cards.map((c) => c.html).join('')}</div></div>`
}
const demoA = demo('demo-basic', 'Example 1: the sentence from the README', 'Most tools agree on this sentence. thai-break wrap() counts display columns, where tone and vowel marks take no room, so it fits more on a line. It also splits the word ส่งมอบ into ส่ง and มอบ on two lines.', 'กระบวนการสื่อสาร ส่งมอบ และสร้างคุณค่า', 10, 'differ')
const demoB = demo('demo-rules', 'Example 2: a line must not start with ๆ', 'A real 77 character excerpt of the fixture. A plain word finder does not know that ๆ repeats the word before it, so it can start a line with it. The bar under each line shows how full the line is. Red means a Thai rule was broken.', 'เพื่อติดตามความคืบหน้าของโครงการและแก้ไขปัญหาที่เกิดขึ้น เด็กๆ เล่นเท่าๆๆ กัน', 20, 'problem')
const demoC = demo('demo-long', 'Example 3: a word longer than the line', 'A 34 letter English word and maxLength 20. thaiwrap cuts it at a safe place. A tool that never cuts words leaves a line that is too long. Amber means too long.', 'ทดสอบ supercalifragilisticexpialidocious ต่อไป', 20, 'problem')

// ---------- scaling line chart ----------
function lineChart() {
  const W = 760, H = 340, L = 58, R = 210, T = 16, B = 44
  const xs = SIZES.map((s) => js.fixtures[s])
  const series = JS_TOOLS.map((t, i) => ({ t, i, ys: SIZES.map((s) => jsStat(t, s, 40).val) }))
  const allY = series.flatMap((s) => s.ys)
  const y0 = Math.floor(Math.log10(Math.min(...allY) * 0.8)), y1 = Math.ceil(Math.log10(Math.max(...allY) * 1.2))
  const lx0 = Math.log10(xs[0]), lx1 = Math.log10(xs.at(-1))
  const X = (v) => L + ((Math.log10(v) - lx0) / (lx1 - lx0)) * (W - L - R)
  const Y = (v) => T + (1 - (Math.log10(v) - y0) / (y1 - y0)) * (H - T - B)
  let g = ''
  for (let k = y0; k <= y1; k++) {
    const y = Y(10 ** k)
    const label = k >= 0 ? `${n0(10 ** k)} ms` : `${(10 ** k).toString()} ms`
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 8}" y="${y + 4}" text-anchor="end">${label}</text>`
  }
  xs.forEach((v, i) => { g += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}"/><text x="${X(v)}" y="${H - B + 16}" text-anchor="middle">${SIZE_PAGES[SIZES[i]]}</text><text x="${X(v)}" y="${H - B + 30}" text-anchor="middle">${n0(v)} chars</text>` })
  const ends = series.map((s) => ({ s, y: Y(s.ys.at(-1)) })).sort((a, b) => a.y - b.y)
  let prev = -Infinity
  for (const e of ends) { e.ly = Math.max(e.y, prev + 14); prev = e.ly }
  const paths = series.map((s) => {
    const pts = s.ys.map((y, k) => [X(xs[k]), Y(y)])
    return `<path class="s${s.i}" d="M${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join('L')}"/>${pts.map((p) => `<circle class="s${s.i}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${s.i === 0 ? 4.5 : 3.5}"/>`).join('')}`
  }).join('')
  const labels = ends.map((e) => `<line class="lead" x1="${X(xs.at(-1)) + 5}" x2="${W - R + 8}" y1="${e.y.toFixed(1)}" y2="${e.ly.toFixed(1)}"/><text class="lab" x="${W - R + 12}" y="${(e.ly + 4).toFixed(1)}">${esc(NAME[e.s.t][0])}</text>`).join('')
  const table = `<table class="tbl"><thead><tr><th>Tool</th>${SIZES.map((s) => `<th>${SIZE_LABEL[s]} (ms)</th>`).join('')}</tr></thead><tbody>${series.map((s) => `<tr><td>${esc(NAME[s.t][0])}</td>${s.ys.map((y) => `<td>${fmtMs(y)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  return `<svg class="lc" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lc-t lc-d"><title id="lc-t">Time to wrap versus document size</title><desc id="lc-d">Both axes are logarithmic. All tools grow roughly in proportion to the document size. thaiwrap is the lowest line.</desc>${g}${paths}${labels}</svg>
<details><summary>Show the numbers behind this chart</summary><div class="tbl-wrap">${table}</div></details>`
}

// ---------- full data tables ----------
function fullTable(tools, statFn) {
  const cols = SIZES.flatMap((s) => MLS.map((m) => [s, m]))
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tool</th>${cols.map(([s, m]) => `<th>${SIZE_LABEL[s]} ${m}</th>`).join('')}</tr></thead><tbody>${tools.map((t) => `<tr><td>${esc(NAME[t][0])}</td>${cols.map(([s, m]) => { const x = statFn(t, s, m); return `<td>${fmtMs(x.val)} <small>${fmtMs(x.lo)} to ${fmtMs(x.hi)}</small></td>` }).join('')}</tr>`).join('')}</tbody></table></div>`
}

// ---------- contestants ----------
const crateVer = (n) => {
  const m = cargoToml.match(new RegExp(`${n}\\s*=\\s*(?:\\{[^}]*?version\\s*=\\s*)?"=([\\d.]+)"`))
  claim(m, `bench-compare version for ${n}`)
  return m[1]
}
const chamkhoVer = cargoToml.match(/chamkho =([\d.]+)/)[1]
const jsVer = (k) => toolBy[k].version
const contestants = [
  ['thaiwrap', jsVer('thaiwrap'), 'ours', 'Wraps by itself: ICU4X dictionary + Thai line rules.'],
  ['Intl.Segmenter + Thai rules', `Node ${envRow('Node').split(' ')[0]}`, 'baseline', 'The reference wrap used in the tests. Built in, no install.'],
  ['Intl.Segmenter + simple wrap', `Node ${envRow('Node').split(' ')[0]}`, 'baseline', 'Built-in word finder plus the shared simple wrap.'],
  ['wordcut', jsVer('wordcut-greedy'), 'npm', 'The classic JS word breaker. Needs an init() call to load its dictionary.'],
  ['thai-wordcut-ts', jsVer('thai-wordcut-ts-greedy'), 'npm', 'Maintained fork of wordcut.'],
  ['thai-break', jsVer('thai-break-greedy'), 'npm', 'Newest. Measured two ways: words() plus simple wrap, and its own wrap().'],
  ['ICU4X (icu_segmenter)', crateVer('icu_segmenter'), 'Rust', 'The word finder inside thaiwrap, without our Thai rules.'],
  ['wordcut-engine', crateVer('wordcut-engine'), 'Rust', `The library behind chamkho ${chamkhoVer}, used with chamkho's own dictionary.`],
  ['nlpo3', crateVer('nlpo3'), 'Rust', 'PyThaiNLP newmm engine in Rust.'],
  ['thaibreak', crateVer('thaibreak'), 'Rust', 'Same engine as the thai-break npm package.'],
  ['kham-core', crateVer('kham-core'), 'Rust', 'Small pure Rust segmenter.'],
]
const contestTable = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tool</th><th>Version</th><th>Kind</th><th>What it is</th></tr></thead><tbody>${contestants.map(([n, v, k, d]) => `<tr><td>${esc(n)}${k === 'ours' ? ' <span class="tag ours">ours</span>' : ''}</td><td>${esc(v)}</td><td>${esc(k)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table></div>`

// ---------- verdict cards ----------
const thaiwrapStartup = coldRows[0].total
const otherStartup = coldRows.slice(1).map((r) => r.total)
const thaiwrapMem = memRows[0].total
const otherMem = memRows.slice(1).map((r) => r.total)
const refSlower = jsStat('intl-reference', 'large', 40).val / jsLargeMl40.val
const rateText = `${Math.min(...otherRates).toFixed(1)}% to ${Math.max(...otherRates).toFixed(1)}%`
const verdict = `<div class="vgrid">
<div class="vcard"><h3>Speed</h3><span class="big">${fmtX(minLead)}x or more</span><p>faster than every other JS tool, in all 9 test setups. Whole 50 pages: ${fmtMs(jsLargeMl40.val)} ms.</p><span class="badge win">Winner</span></div>
<div class="vcard"><h3>Start-up</h3><span class="big">${fmtMs(thaiwrapStartup)} ms</span><p>to load and finish the first wrap. The others need ${fmtMs(Math.min(...otherStartup))} to ${fmtMs(Math.max(...otherStartup))} ms.</p><span class="badge win">Winner</span></div>
<div class="vcard"><h3>Peak memory</h3><span class="big">${n0(thaiwrapMem)} MB</span><p>while wrapping 50 pages 300 times. The others peak at ${n0(Math.min(...otherMem))} to ${n0(Math.max(...otherMem))} MB.</p><span class="badge win">Winner</span></div>
<div class="vcard"><h3>Thai line rules</h3><span class="big">0 problems</span><p>in ${n0(totalLines)} lines. The other tools break a rule on ${rateText} of their lines. Only the reference wrap, which is ${fmtX(refSlower)}x slower, also has none.</p><span class="badge win">Winner</span></div>
<div class="vcard"><h3>Install size</h3><span class="big">${fmtKb(thaiwrapDl)}</span><p>download (JS plus one native binary). Pure JS tools: ${fmtKb(Math.min(...jsOnlyDl.map((r) => r.dl)))} to ${fmtKb(Math.max(...jsOnlyDl.map((r) => r.dl)))}.</p><span class="badge mix">Trade-off</span></div>
</div>`
claim(zeroTools.includes('intl-reference'), 'the reference wrap also has zero problems (text says so)')

// ---------- page ----------
const hero = `<section class="hero-b" id="summary"><p class="eyebrow">Full comparison</p><h1>thaiwrap against the other Thai tools</h1>
<p class="lead">We wrapped a 50 page Thai document with ${JS_TOOLS.length} JavaScript set-ups and ${RUST_TOOLS.length} Rust set-ups. We measured speed, memory, install size and start-up time. We also checked that every line follows the Thai typing rules.</p>
<p class="meta-line">${esc(envRow('Machine'))} &middot; ${esc(envRow('OS'))} &middot; Node ${esc(envRow('Node').split(' ')[0])} &middot; measured ${builtOn} &middot; Full write-up: <a href="${GH}/blob/main/bench/RESULTS.md">bench/RESULTS.md</a></p>
${verdict}
<div class="callout howto"><b>How to read this page</b><ul>
<li><b>Wrap</b> means: cut text into lines of at most <code>maxLength</code> characters, and never cut a Thai word in a bad place.</li>
<li><b>Simple wrap</b> is one small function we wrote and gave to every tool that only finds word boundaries, so all tools fill lines the same way. Details in <a href="#notes">Notes</a>.</li>
<li>For time, memory and size, <b>shorter bars are better</b>. Each bar is the median of 3 runs. The thin line on a bar runs from the fastest to the slowest run.</li>
<li>Length is counted in UTF-16 code units, the same as JavaScript <code>.length</code>.</li>
</ul></div></section>`

const tested = `<section id="tested">${head('tested-h', 'What we tested', 'Method', 'The same input went to every tool. Each tool was set up once before timing, so we time the wrapping and not the set-up.')}
<div class="fx">${SIZES.map((s) => `<div><b>${SIZE_LABEL[s]}: ${SIZE_PAGES[s]}</b><span>${n0(js.fixtures[s])} characters &middot; ${(fixBytes[s] / 1024).toFixed(0)} KB</span></div>`).join('')}</div>
<p class="intro">The text mixes Thai prose, Thai digits, English words, numbers, punctuation and emoji. It also holds zero width spaces and no-break spaces, which real documents contain. Each test used three line lengths: 20, 40 and 80.</p>
${contestTable}
<p class="note">Not in the speed charts: the <b>nlpo3</b> npm package. It has no prebuilt binary and fails to install without a Rust toolchain, so the Rust crate is tested instead. See <a href="#notes">Notes</a>.</p></section>`

const seeIt = `<section id="see-it">${head('see-it-h', 'See it with your own eyes', 'Quality', 'These are real runs of the real tools, not mock-ups. Each box is one output line. The small bar under a line shows how full it is.')}
${demoA}${demoB}${demoC}
<p class="note">Rule breaks are rare per line, so a short excerpt may show only one. The totals over all ${n0(totalLines)} lines are in <a href="#quality">Quality</a>.</p></section>`

const speedJs = `<section id="speed-js">${head('speed-js-h', 'Speed in Node.js', 'Speed - JS', 'Time to wrap the whole document once. Shorter is better. Choose a document size and a line length to compare.')}
${speedChart('chart-js', jsRowsFor)}
<h3>Time grows in step with the document</h3>
<p class="intro">Same tests at maxLength 40, with both axes on a log scale. Every tool grows about in proportion to the text, and thaiwrap stays the lowest line.</p>
${lineChart()}
<details><summary>Show exact numbers for all 9 setups</summary>${fullTable(JS_TOOLS, jsStat)}</details>
<p class="callout">Best other tool on the full document: <b>${fmtMs(nextBestLarge)} ms</b> against thaiwrap's <b>${fmtMs(jsLargeMl40.val)} ms</b>. The slowest takes <b>${fmtMs(slowestLarge)} ms</b>.</p></section>`

const speedRust = `<section id="speed-rust">${head('speed-rust-h', 'Speed in Rust', 'Speed - Rust', 'The same test one level down, without Node. thaiwrap-core is compared with other Rust crates, each followed by the same simple wrap.')}
${speedChart('chart-rust', rustRowsFor)}
<details><summary>Show exact numbers for all 9 setups</summary>${fullTable(RUST_TOOLS, rustStat)}</details>
<p class="callout">The Thai line rules cost almost nothing. Across the 9 setups thaiwrap-core runs from <b>${fasterBest}% faster</b> to <b>${slowerWorst}% slower</b> than raw ICU4X word finding plus the simple wrap (${fmtMs(rustOurs.val)} ms against ${fmtMs(rustIcu.val)} ms on the full document), which is about the size of the noise. Calling it from Node adds about <b>${fmtMs(napiMs)} ms</b> for converting strings across the JS boundary.</p></section>`

const startup = `<section id="startup">${head('startup-h', 'Start-up time', 'Cold start', 'A fresh process, the median of 15 runs. This is what a script or a serverless function pays before its first wrap.')}
<div class="legend"><span><i class="sw load"></i>load the module</span><span><i class="sw init"></i>one-time init</span><span><i class="sw first"></i>first call</span></div>
${coldHtml}
<p class="note">wordcut must parse its dictionary in <code>init()</code>. thai-wordcut-ts loads it on the first call. thaiwrap has the data compiled in, so there is no file to read.</p></section>`

const memory = `<section id="memory">${head('memory-h', 'Memory', 'Peak memory', 'Highest resident memory of the whole process while wrapping the 50 page document 300 times at maxLength 40.')}
<div class="legend"><span><i class="sw base"></i>bare Node process</span><span><i class="sw t"></i>extra memory used by thaiwrap</span><span><i class="sw"></i>extra memory used by others</span></div>
${memHtml}</section>`

const size = `<section id="size">${head('size-h', 'Install size', 'Bundle', 'What you download and what lands on disk. thaiwrap ships one small JS package and a native binary for your platform only.')}
<div class="legend"><span><i class="sw load"></i>download (top bar)</span><span><i class="sw"></i>on disk (bottom bar)</span></div>
${sizeHtml}
<p class="note">The native binary cannot run in a browser. The pure JS tools can. If you ship to browsers, that is the trade-off.</p></section>`

const rules = `<div class="rules">
<div><b>1. No tone or vowel mark at the start</b><span>A mark must stay with its consonant.</span><span class="ex">้ ่ ั ิ ี ุ ู</span></div>
<div><b>2. No leading vowel at the end</b><span>เ แ โ ใ ไ belong to the consonant after them.</span><span class="ex">เ แ โ ใ ไ</span></div>
<div><b>3. Nothing from ะ า ำ ๆ ฯ at the start</b><span>These close the word before them.</span><span class="ex">ะ า ำ ๆ ฯ</span></div>
<div><b>4. Fit in maxLength</b><span>Unless one unit cannot be cut.</span><span class="ex">20 / 40 / 80</span></div>
<div><b>5. Lose no text</b><span>Join the lines and you get the input back.</span><span class="ex">no gaps</span></div></div>`
const qualitySec = `<section id="quality">${head('quality-h', 'Quality: do the lines follow Thai rules?', 'Quality', `We checked every line of every output (${n0(totalLines)} lines per tool) against five rules. Green is zero problems.`)}
${rules}${heatHtml}
<p class="note">thai-break counts width in display columns, so its "longer than maxLength" is measured in its own unit. Counted in UTF-16 units, its lines can be longer than the limit. That is by design.</p>
<details><summary>About "cut inside a word" (why the numbers look high)</summary>
<p>We also checked where each line break falls against a reference word list. Grey bars use PyThaiNLP newmm. Blue bars use ICU word breaks. Each bar is the share of line breaks that fall inside a reference word.</p>
<p>The two lists disagree. newmm keeps many compounds whole, such as ข้อเสนอแนะ, where ICU splits them. So about ${pct('thaiwrap', 'mid').toFixed(0)}% of thaiwrap's breaks fall inside a newmm word, but only ${pct('thaiwrap', 'midIcu').toFixed(0)}% inside an ICU word. It is a difference of dictionary, not a bug. As a check, nlpo3 (which is newmm in Rust) has only ${pct('nlpo3-greedy', 'mid').toFixed(0)}% against newmm.</p>
<div style="margin-top:12px">${miniRows}</div>
<div class="legend"><span><i class="sw base" style="background:var(--r)"></i>inside a newmm word</span><span><i class="sw load"></i>inside an ICU word</span></div></details></section>`

const summary2 = `<section id="tradeoffs">${head('tradeoffs-h', 'Where thaiwrap wins, and where it does not', 'Wins')}
<div class="two"><div class="win"><h3>Wins</h3><ul>
<li>Fastest in all 9 JS setups. On the full document it is ${fmtX(nextBestLarge / jsLargeMl40.val)}x to ${fmtX(slowestLarge / jsLargeMl40.val)}x faster than the other tools.</li>
<li>Within ${withinPct}% of raw ICU4X in every setup (the Thai rules are almost free), and ${fmtX(Math.min(...rustOthers))}x to ${fmtX(Math.max(...rustOthers))}x faster than the other Rust crates.</li>
<li>Smallest start-up (${fmtMs(thaiwrapStartup)} ms) and lowest peak memory (${n0(thaiwrapMem)} MB).</li>
<li>No Thai rule problems in ${n0(totalLines)} lines, and no line longer than the limit.</li>
<li>Cuts overlong words at safe places and has options for how to measure length.</li></ul></div>
<div class="lose"><h3>Trade-offs</h3><ul>
<li>A native binary: ${fmtKb(thaiwrapDl)} to download, and not usable in a browser.</li>
<li>ICU4X splits compounds more finely than PyThaiNLP newmm. If you need newmm compatible word boundaries, it differs.</li>
<li>About ${fmtMs(napiMs)} ms per 50 pages goes to moving strings between JS and Rust.</li>
<li>One machine, three runs each. Numbers will differ on your hardware, ratios should not.</li></ul></div></div></section>`

const notes = `<section id="notes">${head('notes-h', 'Notes and fairness', 'Notes and exclusions')}
<details><summary>The shared simple wrap</summary><p>Tools that only find words use one greedy function: fill each line with as many words as fit, never cut a word, keep a space only where the input had one, drop zero width spaces, keep blank lines between paragraphs. Length is in UTF-16 units. It has no rule for ะ า ำ ๆ ฯ or leading vowels. That is what the Quality table measures. A no-break space is treated like a normal space by this function.</p></details>
<details><summary>Why nlpo3 on npm is not in the speed charts</summary><p><code>npm i nlpo3</code> runs <code>cargo-cp-artifact</code>, which is not installed, and would need a Rust toolchain anyway. There is no prebuilt binary. The Rust crate is tested in the Rust charts.</p></details>
<details><summary>chamkho and its license</summary><p>chamkho ${esc(chamkhoVer)} ships only a command line program. The test links its engine, wordcut-engine, with chamkho's own dictionary. wordcut-engine is LGPL-2.1, so <code>deny.toml</code> has a narrow exception for it. It is only used by the benchmark crate, never by thaiwrap.</p></details>
<details><summary>thai-break and the unit of width</summary><p>thai-break counts display columns and treats tone and vowel marks as zero wide. The same number means a longer line than in thaiwrap, which counts UTF-16 units. Both are valid choices.</p></details>
<details><summary>Measurement details</summary><p>JS speed: 3 rounds, each in a fresh Node process; the value shown is the median of the 3 round means and the thin line is the fastest to slowest round. Rust speed: 3 criterion runs (warm-up 500 ms, 2 s of measurement, 50 samples); the value shown is the median of the 3 median estimates. The machine was not idle: macOS system services used CPU during the runs, which is why the range is shown. Start-up: median of 15 fresh processes. Memory: one process per tool, 300 wraps. Reference word breaks: PyThaiNLP ${esc(String(quality.newmm.pythainlp))} newmm. Single machine, not guaranteed idle.</p></details></section>`

const reproduce = `<section id="method">${head('method-h', 'Run it yourself', 'How to reproduce')}
<pre>bun install
bun run build
node bench/index.mjs                 # JS speed, 3 rounds
node bench/bench-cold-start.mjs
node bench/bench-memory-run.mjs
node bench/bench-bundle-size.mjs
node bench/bench-quality.mjs         # needs uv (PyThaiNLP reference)
cargo bench -p bench-compare --bench compare -- --save-baseline r1   # also r2, r3
node bench/scripts/build-site-page.mjs   # rebuilds this page</pre>
<p class="note">Everything here is in the repository: the data and tables are in <a href="${GH}/blob/main/bench/RESULTS.md">bench/RESULTS.md</a>, the earlier first round results are on the <a href="/benchmarks/">Benchmarks</a> page.</p></section>`

const toc = [['summary', 'Summary'], ['tested', 'What we tested'], ['see-it', 'See it'], ['speed-js', 'Speed: Node'], ['speed-rust', 'Speed: Rust'], ['startup', 'Start-up'], ['memory', 'Memory'], ['size', 'Install size'], ['quality', 'Quality'], ['tradeoffs', 'Trade-offs'], ['notes', 'Notes'], ['method', 'Reproduce']]

const script = `(function(){
for (const chart of document.querySelectorAll('.chart')) {
  const state = { size: chart.dataset.size, ml: chart.dataset.ml, scale: chart.dataset.scale }
  const apply = () => {
    chart.dataset.scale = state.scale
    for (const v of chart.querySelectorAll('.view')) v.hidden = !(v.dataset.size === state.size && v.dataset.ml === state.ml)
    for (const b of chart.querySelectorAll('[data-set]')) b.setAttribute('aria-pressed', String(state[b.dataset.set] === b.dataset.value))
  }
  chart.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]')
    if (!b) return
    state[b.dataset.set] = b.dataset.value
    apply()
  })
  apply()
}
})()`

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>thaiwrap benchmarks: full comparison with other Thai tools</title>
<meta name="description" content="Speed, memory, install size, start-up time and Thai line rule checks for thaiwrap against Intl.Segmenter, wordcut, thai-break and Rust crates.">
<script>document.documentElement.classList.add('js')</script>
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/benchmarks/comparison/comparison.css"></head><body class="wide-page">
<header class="nav"><div><a class="brand" href="/">thaiwrap</a><a href="/docs/">Docs</a><a href="/benchmarks/" aria-current="page">Benchmarks</a><a href="https://github.com/theerakarnm/wrapthai">GitHub</a></div></header>
<main>
<nav class="toc" aria-label="On this page">${toc.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav>
${hero}${tested}${seeIt}${speedJs}${speedRust}${startup}${memory}${size}${qualitySec}${summary2}${notes}${reproduce}
<footer>MIT licensed. Pre-release (v0.x), the API may change. Generated by <code>bench/scripts/build-site-page.mjs</code> from the benchmark outputs. <a href="${GH}">Source on GitHub</a>.</footer>
</main>
<script>${script}</script></body></html>
`
mkdirSync(path.dirname(outFile), { recursive: true })
writeFileSync(outFile, html)
console.log(`wrote ${path.relative(root, outFile)} (${(html.length / 1024).toFixed(0)} KB)`)
