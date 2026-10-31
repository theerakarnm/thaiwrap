// Writes a README.md into every generated npm/<platform>/ package (after `napi create-npm-dirs`),
// so each @thaiwrap/binding-* page on npmjs.com points users to the main package.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const npmDir = new URL('../npm/', import.meta.url).pathname
for (const entry of readdirSync(npmDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const dir = join(npmDir, entry.name)
  const { name, repository } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const url = (repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '')
  writeFileSync(
    join(dir, 'README.md'),
    `# ${name}\n\nPrebuilt native binary for [thaiwrap](https://www.npmjs.com/package/thaiwrap).\nDo not install this package directly.\n\n\`\`\`sh\nnpm install thaiwrap\n\`\`\`\n\nDocumentation: ${url}\n`,
  )
}
