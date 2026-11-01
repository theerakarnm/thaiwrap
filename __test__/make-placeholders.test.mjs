// Runs scripts/make-placeholders.mjs against a copied package.json, because the
// maintainer pastes its printed commands into a shell.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const root = new URL('..', import.meta.url)

function runWithRepositoryUrl(url) {
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

test('make-placeholders refuses a repository.url carrying shell syntax', () => {
  const { status, stdout } = runWithRepositoryUrl('git+https://github.com/theerakarnm/thaiwrap.git$(touch$IFS/pwned)')
  assert.notEqual(status, 0)
  assert.doesNotMatch(stdout, /npm trust/)
})

test('make-placeholders refuses a repository that is not on GitHub', () => {
  const { status, stdout } = runWithRepositoryUrl('git+https://gitlab.com/theerakarnm/thaiwrap.git')
  assert.notEqual(status, 0)
  assert.doesNotMatch(stdout, /npm trust/)
})
