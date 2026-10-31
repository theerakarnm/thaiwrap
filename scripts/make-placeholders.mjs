// Builds placeholder packages for every npm name thaiwrap publishes, so npm trusted
// publishing can be configured (npm requires the package to exist first).
// It never publishes anything: the maintainer runs the printed commands by hand.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { platformName } = require('../platform.js')
const repo = new URL(root.repository.url.replace(/^git\+/, '')).pathname.replace(/^\//, '').replace(/\.git$/, '')

const names = [root.name, ...root.napi.targets.map((t) => `${root.napi.packageName}-${platformName(t)}`)]
const dir = mkdtempSync(join(tmpdir(), 'thaiwrap-placeholders-'))
const dirs = names.map((name) => {
  const pkgDir = join(dir, name.replace('/', '__'))
  mkdirSync(pkgDir)
  const pkg = {
    name,
    version: '0.0.0',
    description: 'Placeholder, do not use. Reserved for thaiwrap.',
    license: root.license,
    repository: root.repository,
    publishConfig: { access: 'public' },
  }
  writeFileSync(join(pkgDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
  writeFileSync(join(pkgDir, 'README.md'), `# ${name}\n\nPlaceholder, do not use.\nThis name is reserved for https://github.com/${repo}.\n`)
  return pkgDir
})

console.log(`Wrote ${names.length} placeholder packages to ${dir}\n`)
console.log('0. The npm organization `thaiwrap` must exist and you must be a member of it, or the six @thaiwrap/... publishes fail with E404.')
console.log('   Create it at https://www.npmjs.com/org/create if needed.\n')
console.log('1. Publish them yourself (interactive login with 2FA; no token goes into the repository or GitHub secrets):')
console.log('   npm login')
for (const d of dirs) console.log(`   (cd "${d}" && npm publish --access public)`)
console.log('\n2. Within 2 days before the first release, add a trusted publisher to each (npm >= 11.15).')
console.log('   npm expires unvalidated trusted-publisher configurations after 48 hours; if you miss it, run these again:')
for (const n of names) console.log(`   npm trust github ${n} --file release.yml --repo ${repo} --env npm --allow-publish`)
console.log('\n3. Only after the `npm trust` commands, run `npm logout` to remove the session token npm login stored in ~/.npmrc.')
