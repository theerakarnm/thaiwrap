// Completes every generated npm/<platform>/ package (after `napi create-npm-dirs`):
// a README.md that points users to the main package, and the license files and license field of the root package.
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = new URL('../', import.meta.url).pathname
const npmDir = join(rootDir, 'npm')
const licenseFiles = ['LICENSE', 'LICENSE-APACHE', 'LICENSE-UNICODE']
const { license } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))

for (const entry of readdirSync(npmDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const dir = join(npmDir, entry.name)
  const pkgPath = join(dir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const url = (pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '')
  writeFileSync(
    join(dir, 'README.md'),
    `# ${pkg.name}\n\nPrebuilt native binary for [thaiwrap](https://www.npmjs.com/package/thaiwrap).\nDo not install this package directly.\n\n\`\`\`sh\nnpm install thaiwrap\n\`\`\`\n\nDocumentation: ${url}\n`,
  )
  for (const file of licenseFiles) copyFileSync(join(rootDir, file), join(dir, file))
  pkg.license = license
  pkg.files = [...new Set([...(pkg.files ?? []), ...licenseFiles])]
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}
