// index.js
'use strict'
// Load once to turn a missing or unsupported binary into an error that names the platform.
// The plain re-export below stays statically analysable, so Node ESM sees the named exports.
try {
  require('./binding.js')
} catch (err) {
  throw require('./platform.js').describeLoadFailure(err)
}
module.exports = require('./binding.js')
