import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyseKeyword, countPhrase, topPhrases } from '../lib/keyword.js'
import { inspectSchema } from '../lib/schema.js'
import { quickLinks } from '../lib/quicklinks.js'
import { toCsv } from '../lib/report.js'
import { page } from './fixtures.js'

test('countPhrase matches whole phrases, hyphen or space joined, case-insensitive', () => {
  assert.equal(countPhrase('A Title Tag guide. title-tag tips. subtitle tag. title tags too.', 'title tag'), 3)
  assert.equal(countPhrase('robots.txt tester', 'robots.txt'), 1)
  assert.equal(countPhrase('', 'x'), 0)
})

test('analyseKeyword scores placement and reports each location', () => {
  const p = page({ bodyText: 'How to write a title tag. A title tag is the text in the tab. Write the title tag once more. ' + 'filler '.repeat(300), firstParagraph: 'A title tag is the text in the browser tab and the blue link in results.', pathname: '/title-tag-guide' })
  const r = analyseKeyword('Title Tag', p)
  assert.equal(r.keyword, 'title tag')
  assert.ok(r.checks.title.pass && r.checks.h1.pass && r.checks.description.pass && r.checks.firstParagraph.pass && r.checks.url.pass && r.checks.body.pass)
  assert.equal(r.checks.subheadings.pass, true)
  assert.equal(r.score, 100)
  assert.equal(r.bodyCount, 3)
  assert.deepEqual(r.warnings, [])
})

test('analyseKeyword flags stuffing and misses', () => {
  const p = page({ title: 'Something else entirely for the test', metaDescription: 'Nothing here.', headings: [{ level: 1, text: 'Other' }], bodyText: 'cheap shoes '.repeat(40) + 'word '.repeat(60), wordCount: 140, firstParagraph: 'No match.', pathname: '/x' })
  const r = analyseKeyword('cheap shoes', p)
  assert.equal(r.checks.title.pass, false)
  assert.equal(r.checks.url.pass, false)
  assert.ok(r.density > 2)
  assert.match(r.warnings[0], /stuffing/)
  assert.equal(r.score, 5)
  assert.equal(analyseKeyword('   ', p), null)
})

test('topPhrases returns repeated bigrams and trigrams without stopword edges', () => {
  const t = 'the title tag matters. a good title tag helps. title tag length is 60. meta description also. meta description length.'
  const phrases = topPhrases(t).map((x) => x.phrase)
  assert.equal(phrases[0], 'title tag')
  assert.ok(phrases.includes('meta description'))
  assert.ok(!phrases.some((p) => p.startsWith('the ') || p.endsWith(' the')))
})

test('inspectSchema reports missing required and recommended properties', () => {
  const r = inspectSchema([JSON.stringify({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: 'x', author: { '@type': 'Person' } },
    { '@type': 'Product', name: 'Widget', offers: { '@type': 'Offer', price: '9' } },
    { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A' } }] },
    { '@type': 'ThingNobodyKnows' }
  ] }), '{bad'])
  assert.equal(r.blocks, 2)
  assert.equal(r.invalid, 1)
  const art = r.items.find((i) => i.type === 'Article')
  assert.deepEqual(art.missingRequired, ['image', 'datePublished'])
  assert.deepEqual(art.missingRecommended, ['dateModified', 'publisher'])
  assert.deepEqual(r.items.find((i) => i.type === 'Person').missingRequired, ['name'])
  assert.deepEqual(r.items.find((i) => i.type === 'Offer').missingRequired, ['priceCurrency'])
  assert.deepEqual(r.items.find((i) => i.type === 'Question').missingRequired, [])
  assert.equal(r.items.find((i) => i.type === 'ThingNobodyKnows').known, false)
  assert.deepEqual(r.richResultTypes, ['Article', 'Product', 'FAQPage'])
})

test('quickLinks prefill the current URL and host', () => {
  const q = quickLinks('https://www.example.com/a b?x=1')
  assert.ok(q.google.find((l) => l.label === 'Rich Results Test').url.includes(encodeURIComponent('https://www.example.com/a b?x=1')))
  assert.ok(q.google.find((l) => l.label.startsWith('Google: site:')).url.includes('site%3Awww.example.com'))
  assert.equal(q.google.find((l) => l.label === 'robots.txt').url, 'https://www.example.com/robots.txt')
  assert.ok(q.crawlcove.every((l) => l.url.includes('utm_source=chrome')))
})

test('toCsv quotes and guards formulas', () => {
  const csv = toCsv([{ a: 'x,y', b: '=SUM(1)' }, { a: 'plain', b: null }], ['a', 'b'])
  assert.equal(csv, 'a,b\r\n"x,y",\'=SUM(1)\r\nplain,')
})
