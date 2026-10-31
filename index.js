'use strict'
// Load once to turn a missing or unsupported binary into an error that names the platform.
let binding
try {
  binding = require('./binding.js')
} catch (err) {
  throw require('./platform.js').describeLoadFailure(err)
}
// One static assignment per public export keeps Node ESM named imports working
// (cjs-module-lexer cannot see through a plain `module.exports = binding`) and hides loader internals.
module.exports.wrapThai = binding.wrapThai
