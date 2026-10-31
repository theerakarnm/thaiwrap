// platform.js
'use strict'
const { napi } = require('./package.json')

const ARCH = { x86_64: 'x64', aarch64: 'arm64' }
const OS = { linux: 'linux', darwin: 'darwin', windows: 'win32' }

// The names napi-rs uses for npm/<dir>: "x86_64-unknown-linux-gnu" -> "linux-x64-gnu",
// "aarch64-apple-darwin" -> "darwin-arm64", "x86_64-pc-windows-msvc" -> "win32-x64-msvc".
function platformName(triple) {
  const [arch, , os, abi] = triple.split('-')
  return [OS[os], ARCH[arch], abi].filter(Boolean).join('-')
}

function currentPlatform() {
  const { platform, arch } = process
  if (platform === 'linux') {
    // Same detection as the generated loader: skip the slow network part of the report.
    if (process.report) process.report.excludeNetwork = true
    const glibc = process.report?.getReport?.()?.header?.glibcVersionRuntime
    return `linux-${arch}-${glibc ? 'gnu' : 'musl'}`
  }
  if (platform === 'win32') return `win32-${arch}-msvc`
  return `${platform}-${arch}`
}

function supportedPlatforms() {
  return napi.targets.map(platformName)
}

function describeLoadFailure(cause, current = currentPlatform(), supported = supportedPlatforms()) {
  const message = supported.includes(current)
    ? `thaiwrap could not load its native binary for ${current} (package ${napi.packageName}-${current}). ` +
      'Reinstall dependencies on this machine; do not copy node_modules between operating systems.'
    : `thaiwrap has no prebuilt binary for ${current}. Supported: ${supported.join(', ')}.`
  return new Error(message, { cause })
}

module.exports = { platformName, currentPlatform, supportedPlatforms, describeLoadFailure }
