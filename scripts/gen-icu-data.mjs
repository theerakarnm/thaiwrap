// Regenerates crates/thaiwrap-core/data/icu-thai.postcard, the Thai-only ICU4X data the core loads.
// Run it after every ICU4X upgrade; never edit the blob by hand. CI checks that the blob is current.
// It needs icu4x-datagen of exactly the icu_segmenter version in Cargo.lock:
//   cargo install icu4x-datagen --version <that version> --locked
// Run from the repo root: node scripts/gen-icu-data.mjs   (ICU4X_DATAGEN=<path> to use another binary)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const OUT = 'crates/thaiwrap-core/data/icu-thai.postcard'
// The data the core's constructors need (LineSegmenter::try_new_dictionary_with_buffer_provider and
// GraphemeClusterSegmenter::try_new_with_buffer_provider). --locales none would give empty dictionaries.
const MARKERS = ['SegmenterBreakLineV1', 'SegmenterDictionaryExtendedV2', 'SegmenterBreakGraphemeClusterV1']

const lock = readFileSync('Cargo.lock', 'utf8')
const want = lock.match(/name = "icu_segmenter"\nversion = "([^"]+)"/)?.[1]
if (!want) throw new Error('icu_segmenter is not in Cargo.lock')
const datagen = process.env.ICU4X_DATAGEN ?? 'icu4x-datagen'
const have = execFileSync(datagen, ['--version'], { encoding: 'utf8' }).trim()
if (have !== `icu4x-datagen ${want}`) {
  console.error(`need icu4x-datagen ${want} (icu_segmenter in Cargo.lock), found "${have}"`)
  console.error(`  cargo install icu4x-datagen --version ${want} --locked`)
  process.exit(1)
}
execFileSync(datagen, [
  '--format', 'blob', '--locales', 'und', '--markers', ...MARKERS,
  '--segmenter-models', 'thaidict', '--overwrite', '--out', OUT,
], { stdio: 'inherit' })
