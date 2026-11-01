// Bundle/install size per package: npm tarball size, gzipped tarball, unpacked
// install size, and the gzipped sum of every shipped file (browser-ish payload
// gzip for pure-JS packages). Writes bench/out/bundle-size.json.

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const here = path.dirname(fileURLToPath(import.meta.url))
const tmp = path.join(os.tmpdir(), `thaiwrap-bundle-${process.pid}`)
mkdirSync(tmp, { recursive: true })

const PACKAGES = [
  { name: 'thaiwrap', version: '0.1.1', note: 'JS entry + platform loader; native binary lives in @thaiwrap/*' },
  { name: '@thaiwrap/binding-darwin-arm64', version: '0.1.1', note: 'native addon actually loaded on macOS arm64' },
  { name: 'wordcut', version: '0.9.1' },
  { name: 'thai-wordcut-ts', version: '1.0.2' },
  { name: 'thai-break', version: '1.5.0' },
  { name: 'nlpo3', version: '0.2.1', note: 'EXCLUDED from benchmarks: no prebuilt binary, builds Rust from source on install' },
]

import { gzipSync } from 'node:zlib'

// gzip level 9, deterministic
const gzip = (buf) => gzipSync(buf, { level: 9 }).length

const results = []
for (const { name, version, note } of PACKAGES) {
  const spec = `${name}@${version}`
  const pack = spawnSync('npm', ['pack', spec, '--json', '--ignore-scripts'], {
    cwd: tmp,
    encoding: 'utf8',
    maxBuffer: 1 << 24,
  })
  if (pack.status !== 0) {
    results.push({ name, version, error: pack.stderr.slice(0, 200) })
    continue
  }
  const meta = JSON.parse(pack.stdout)[0]
  const tarballPath = path.join(tmp, meta.filename)
  const tarball = readFileSync(tarballPath)
  const gzipTarball = gzip(tarball)
  // Extract to sum per-file gzip (what a bundler/browser would roughly ship).
  spawnSync('tar', ['-xzf', meta.filename], { cwd: tmp, encoding: 'utf8' })
  const pkgDir = path.join(tmp, 'package')
  const list = spawnSync('find', [pkgDir, '-type', 'f'], { encoding: 'utf8' })
  let payloadGzipSum = 0
  const biggest = []
  for (const line of list.stdout.trim().split('\n')) {
    const buf = readFileSync(line)
    const g = gzip(buf)
    payloadGzipSum += g
    biggest.push({ file: path.relative(pkgDir, line), bytes: buf.length, gzipBytes: g })
  }
  biggest.sort((a, b) => b.gzipBytes - a.gzipBytes)
  results.push({
    name,
    version,
    tarballBytes: meta.size,
    gzipTarballBytes: gzipTarball,
    unpackedBytes: meta.unpackedSize,
    fileCount: biggest.length,
    payloadGzipSumBytes: payloadGzipSum,
    largest: biggest.slice(0, 5),
    note,
  })
  rmSync(pkgDir, { recursive: true, force: true })
  rmSync(tarballPath, { force: true })
}

const builtin = { name: 'Intl.Segmenter (builtin)', version: process.version, tarballBytes: 0, gzipTarballBytes: 0, unpackedBytes: 0, fileCount: 0, payloadGzipSumBytes: 0, note: 'ships with the runtime' }
const out = { runtime: `node ${process.version}`, results: [...results, builtin] }
mkdirSync(path.join(here, 'out'), { recursive: true })
writeFileSync(path.join(here, 'out', 'bundle-size.json'), JSON.stringify(out, null, 2))
for (const r of out.results) {
  console.log(`${r.name.padEnd(36)} tarball ${(r.tarballBytes / 1024).toFixed(0)}KB  gzip ${(r.gzipTarballBytes / 1024).toFixed(0)}KB  unpacked ${(r.unpackedBytes / 1024).toFixed(0)}KB  payload-gzip ${(r.payloadGzipSumBytes / 1024).toFixed(0)}KB`)
}
console.error('wrote bench/out/bundle-size.json')
