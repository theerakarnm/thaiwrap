// Runs scripts/make-placeholders.mjs against a copied package.json, because the
// maintainer pastes its printed commands into a shell.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const root = new URL('..', import.meta.url)

function runWithRepositoryUrl(url, inspect = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'thaiwrap-placeholders-test-'))
  try {
    mkdirSync(join(dir, 'scripts'))
    cpSync(new URL('scripts/make-placeholders.mjs', root), join(dir, 'scripts/make-placeholders.mjs'))
    cpSync(new URL('platform.js', root), join(dir, 'platform.js'))
    const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
    pkg.repository.url = url
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
    const result = spawnSync(process.execPath, [join(dir, 'scripts/make-placeholders.mjs')], {
      cwd: dir,
      env: { ...process.env, TMPDIR: dir },
      encoding: 'utf8',
    })
    inspect(result)
    return result
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('make-placeholders prints npm trust commands for the real repository', () => {
  const { status, stdout } = runWithRepositoryUrl('git+https://github.com/theerakarnm/thaiwrap.git')
  assert.equal(status, 0)
  assert.match(stdout, /npm trust github "thaiwrap" --file release\.yml --repo theerakarnm\/thaiwrap --env npm/)
})

test('make-placeholders writes a crate placeholder and prints quoted crates.io commands', () => {
  let cargoToml
  let readme
  let hasLib
  const { status, stdout } = runWithRepositoryUrl('git+https://github.com/theerakarnm/thaiwrap.git', ({ stdout }) => {
    const crateDir = stdout.match(/\(cd "([^"]+\/crate-thaiwrap)" && cargo publish\)/)?.[1]
    assert.ok(crateDir, 'the cargo publish command names the crate placeholder directory')
    cargoToml = readFileSync(join(crateDir, 'Cargo.toml'), 'utf8')
    readme = readFileSync(join(crateDir, 'README.md'), 'utf8')
    hasLib = existsSync(join(crateDir, 'src/lib.rs'))
  })
  assert.equal(status, 0)
  assert.match(cargoToml, /^name = "thaiwrap"$/m)
  assert.match(cargoToml, /^version = "0\.0\.0"$/m)
  assert.match(cargoToml, /^repository = "https:\/\/github\.com\/theerakarnm\/thaiwrap"$/m)
  assert.match(readme, /Placeholder, do not use\./)
  assert.ok(hasLib)
  assert.match(stdout, /owner theerakarnm, repository thaiwrap, workflow release\.yml, environment crates-io/)
})

test('make-placeholders refuses a repository.url carrying shell syntax', () => {
  const { status, stdout } = runWithRepositoryUrl('git+https://github.com/theerakarnm/thaiwrap.git$(touch$IFS/pwned)')
  assert.notEqual(status, 0)
  assert.doesNotMatch(stdout, /npm trust|cargo publish/)
})

test('make-placeholders refuses a repository that is not on GitHub', () => {
  const { status, stdout } = runWithRepositoryUrl('git+https://gitlab.com/theerakarnm/thaiwrap.git')
  assert.notEqual(status, 0)
  assert.doesNotMatch(stdout, /npm trust|cargo publish/)
})
