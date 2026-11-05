// Builds placeholder packages for every npm name and for the crates.io crate thaiwrap publishes, so
// trusted publishing can be configured (npm and crates.io both require the package to exist first).
// It never publishes anything: the maintainer runs the printed commands by hand.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { platformName } = require('../platform.js')
const repoUrl = new URL(root.repository.url.replace(/^git\+/, ''))
const repo = repoUrl.pathname.replace(/^\//, '').replace(/\.git$/, '')

const names = [root.name, ...root.napi.targets.map((t) => `${root.napi.packageName}-${platformName(t)}`)]

// The maintainer pastes the printed commands into a shell, so every interpolated value must be
// plain owner/name or npm-name characters. URL parsing alone keeps `$(...)`, `;` and `|`.
if (repoUrl.hostname !== 'github.com' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repo))
  throw new Error(`package.json repository.url must point at a GitHub owner/name, got ${JSON.stringify(root.repository.url)}`)
for (const name of names)
  if (!/^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/.test(name)) throw new Error(`invalid npm package name ${JSON.stringify(name)}`)

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

// The crate name is a literal, so the shell sees only validated values (see the checks above).
const crateName = 'thaiwrap'
const crateDir = join(dir, `crate-${crateName}`)
mkdirSync(join(crateDir, 'src'), { recursive: true })
writeFileSync(
  join(crateDir, 'Cargo.toml'),
  `[package]
name = "${crateName}"
version = "0.0.0"
edition = "2021"
description = "Placeholder for the ${crateName} crate, published from https://github.com/${repo}"
license = "MIT"
repository = "https://github.com/${repo}"
readme = "README.md"
`,
)
writeFileSync(join(crateDir, 'src/lib.rs'), `//! Placeholder. The real crate is published from https://github.com/${repo}.\n`)
writeFileSync(join(crateDir, 'README.md'), `# ${crateName}\n\nPlaceholder, do not use.\nThis name is reserved for https://github.com/${repo}.\n`)

console.log(`Wrote ${names.length} placeholder packages and 1 crate placeholder to ${dir}\n`)
console.log('0. The npm organization `thaiwrap` must exist and you must be a member of it, or the six @thaiwrap/... publishes fail with E404.')
console.log('   Create it at https://www.npmjs.com/org/create if needed.\n')
console.log('1. Publish them yourself (interactive login with 2FA; no token goes into the repository or GitHub secrets):')
console.log('   npm login')
for (const d of dirs) console.log(`   (cd "${d}" && npm publish --access public)`)
console.log('\n2. Within 2 days before the first release, add a trusted publisher to each (npm >= 11.15).')
console.log('   npm expires unvalidated trusted-publisher configurations after 48 hours; if you miss it, run these again:')
for (const n of names) console.log(`   npm trust github "${n}" --file release.yml --repo ${repo} --env npm --allow-publish`)
console.log('\n3. Only after the `npm trust` commands, run `npm logout` to remove the session token npm login stored in ~/.npmrc.')

const [owner, repoName] = repo.split('/')
console.log(`\n4. crates.io needs one manual first publish with an API token before trusted publishing can be set up (https://crates.io/docs/trusted-publishing).`)
console.log('   Create a token with the publish-new scope at https://crates.io/settings/tokens, then run `cargo login`.')
console.log(`   (cd "${crateDir}" && cargo publish)`)
console.log('\n5. Revoke the token on crates.io, then run `cargo logout`.')
console.log(`\n6. On crates.io open ${crateName} -> Settings -> Trusted Publishing -> GitHub and enter: owner ${owner}, repository ${repoName}, workflow release.yml, environment crates-io.`)
console.log('\n7. On GitHub create the environment `crates-io`, add yourself as required reviewer, and limit deployment branches to `main`.')
