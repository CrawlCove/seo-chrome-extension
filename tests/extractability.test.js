import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreExtractability, EXTRACTABILITY_WEIGHTS } from '../lib/extractability.js'

const base = { headings: [{ level: 1, text: 'Topic' }], wordCount: 120, hasComparisonTable: false, hasFaqSchema: false, hasVisibleDateAuthor: false }

test('weights sum to 100', () => {
  assert.equal(Object.values(EXTRACTABILITY_WEIGHTS).reduce((a, b) => a + b, 0), 100)
})

test('short page with an H1 is answer-first only (25)', () => {
  const r = scoreExtractability(base)
  assert.equal(r.score, 25)
  assert.deepEqual(r.subScores, { answerFirst: true, answerBlocks: false, comparisonTable: false, faqSchema: false, visibleDateAuthor: false })
})

test('a wall of text over 250 words with no subheadings is not answer-first', () => {
  assert.equal(scoreExtractability({ ...base, wordCount: 800 }).score, 0)
})

test('two question headings give answer blocks; FAQ schema gives both', () => {
  const q = [{ level: 1, text: 'T' }, { level: 2, text: 'What is X?' }, { level: 3, text: 'How does it work' }]
  assert.equal(scoreExtractability({ ...base, headings: q }).score, 50)
  assert.equal(scoreExtractability({ ...base, hasFaqSchema: true }).score, 70)
})

test('everything on scores 100', () => {
  assert.equal(scoreExtractability({ ...base, hasFaqSchema: true, hasComparisonTable: true, hasVisibleDateAuthor: true }).score, 100)
})
