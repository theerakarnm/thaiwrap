// Runs in a fresh process: measures module load, one-time init, first call and
// warm call for one tool, prints JSON. Spawned by bench-cold-start.mjs.

const results = { tool: process.argv[2] }

const measure = async (label, fn) => {
  const s = performance.now()
  const value = await fn()
  results[label] = performance.now() - s
  return value
}

const require_ = (await import('node:module')).createRequire(import.meta.url)
const here = new URL('.', import.meta.url)
const fixture = (await import('node:fs')).readFileSync(new URL('../fixtures/small.txt', here), 'utf8')
const PARA = fixture.split('\n').find((l) => l.trim()) ?? fixture

switch (results.tool) {
  case 'thaiwrap': {
    const mod = await measure('loadMs', () => import('../../index.js'))
    await measure('firstCallMs', () => mod.wrapThai(fixture, 40))
    await measure('warmCallMs', () => mod.wrapThai(fixture, 40))
    break
  }
  case 'intl-reference':
  case 'intl-simple': {
    results.loadMs = 0 // builtin
    const seg = await measure('firstCallMs', () => {
      const s = new Intl.Segmenter('th', { granularity: 'word' })
      ;[...s.segment(PARA)]
      return s
    })
    await measure('warmCallMs', () => [...seg.segment(PARA)].length)
    break
  }
  case 'wordcut-greedy': {
    const wc = await measure('loadMs', () => Promise.resolve(require_('wordcut')))
    await measure('initMs', () => wc.init())
    await measure('firstCallMs', () => wc.cut(PARA))
    await measure('warmCallMs', () => wc.cut(PARA))
    break
  }
  case 'thai-wordcut-ts-greedy': {
    const mod = await measure('loadMs', () => Promise.resolve(require_('thai-wordcut-ts')))
    const cut = mod.cutIntoArray ?? mod.cut
    await measure('firstCallMs', () => cut(PARA))
    await measure('warmCallMs', () => cut(PARA))
    break
  }
  case 'thai-break-greedy':
  case 'thai-break-wrap': {
    const mod = await measure('loadMs', () => import('thai-break'))
    const fn = results.tool === 'thai-break-wrap' ? mod.wrap : mod.words
    const arg = results.tool === 'thai-break-wrap' ? [fixture, 40] : [PARA, true]
    await measure('firstCallMs', () => fn(...arg))
    await measure('warmCallMs', () => fn(...arg))
    break
  }
  default:
    throw new Error(`unknown tool ${results.tool}`)
}

console.log(JSON.stringify(results))
