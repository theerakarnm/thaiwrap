import assert from 'node:assert/strict'
try {
  await import('../../index.js')
  assert.fail('expected the load to fail on an unsupported platform')
} catch (error) {
  assert.match(error.message, /^thaiwrap has no prebuilt binary for linux-arm64-musl\. Supported: linux-x64-gnu, linux-arm64-gnu, linux-x64-musl, darwin-arm64, darwin-x64, win32-x64-msvc\.$/)
  console.log('unsupported ok')
}
