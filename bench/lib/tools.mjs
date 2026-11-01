// Tool adapters for the JS benchmark suite. Each adapter loads its library once
// (cold init stays out of the measured loops) and exposes wrap(text, maxLength)
// returning string[] of lines.
//
// widthUnit documents what each tool counts as one "length unit" so the quality
// checker can judge over-limit lines in the tool's own unit as well.

import { createRequire } from 'node:module'
import { wrapThai } from '../../index.js'
import { wrapReference } from '../../__test__/reference.mjs'
import { greedyWrap } from './greedy.mjs'

const require = createRequire(import.meta.url)
const pkgVersion = (name) => require(`${name}/package.json`).version

// --- Baseline 1: Intl.Segmenter + the shared simple greedy wrapper ---
const segmenter = new Intl.Segmenter('th', { granularity: 'word' })
const intlTokens = (para) => [...segmenter.segment(para)].map((s) => s.segment)

// --- wordcut (classic, CJS) ---
const wordcut = require('wordcut')
wordcut.init()
const wordcutTokens = (para) => wordcut.cut(para).split('|')

// --- thai-wordcut-ts (maintained fork, CJS) ---
const { cutIntoArray } = require('thai-wordcut-ts')

// --- thai-break (ESM) ---
const thaibreak = await import('thai-break')

export const TOOLS = [
  {
    key: 'thaiwrap',
    label: 'thaiwrap (ours)',
    version: pkgVersion('thaiwrap') || 'local',
    widthUnit: 'utf16',
    wrap: (text, max) => wrapThai(text, max),
  },
  {
    key: 'intl-reference',
    label: 'Intl.Segmenter + Thai-rule reference wrap',
    version: process.version,
    widthUnit: 'utf16',
    wrap: (text, max) => wrapReference(text, max),
  },
  {
    key: 'intl-simple',
    label: 'Intl.Segmenter + simple greedy',
    version: process.version,
    widthUnit: 'utf16',
    wrap: (text, max) => greedyWrap(intlTokens, text, max),
  },
  {
    key: 'wordcut-greedy',
    label: 'wordcut + simple greedy',
    version: pkgVersion('wordcut'),
    widthUnit: 'utf16',
    wrap: (text, max) => greedyWrap(wordcutTokens, text, max),
  },
  {
    key: 'thai-wordcut-ts-greedy',
    label: 'thai-wordcut-ts + simple greedy',
    version: pkgVersion('thai-wordcut-ts'),
    widthUnit: 'utf16',
    wrap: (text, max) => greedyWrap(cutIntoArray, text, max),
  },
  {
    key: 'thai-break-greedy',
    label: 'thai-break words() + simple greedy',
    version: pkgVersion('thai-break'),
    widthUnit: 'utf16',
    wrap: (text, max) => greedyWrap((p) => thaibreak.words(p, true), text, max),
  },
  {
    key: 'thai-break-wrap',
    label: 'thai-break wrap() (own API)',
    version: pkgVersion('thai-break'),
    widthUnit: 'displayWidth',
    wrap: (text, max) => thaibreak.wrap(text, max).split('\n'),
  },
]
