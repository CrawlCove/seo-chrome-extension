import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runChecks, CHECK_TITLES, isSnippetBlocked } from '../lib/checks.js'
import { toExportJson, toMarkdown } from '../lib/report.js'
import { fixUrl } from '../lib/links.js'
import { page, site } from './fixtures.js'

const ids = (r) => r.findings.map((x) => x.checkId)

test('a well-formed article has no findings', () => {
  const r = runChecks(page(), site())
  assert.deepEqual(ids(r), [])
  assert.equal(r.ai.extractability.score, 65)
  assert.equal(r.ai.llmsTxt, 'present')
  assert.equal(r.ai.searchBotsAllowed, 7)
})

test('every finding carries a title, a severity and a fix link', () => {
  const r = runChecks(page({ title: '', metaDescription: null, canonical: null, htmlLang: null, viewport: null, h1Count: 0, headings: [], wordCount: 30, jsonLd: [], mixedContent: ['http://x/y.png'], images: { count: 2, missingAlt: 2, emptyAlt: 0, firstImageLazy: true } }), site({ robotsTxt: 'User-agent: *\nDisallow: /\n', llmsTxt: { status: 404, contentType: 'text/html' } }))
  assert.ok(r.findings.length >= 10)
  for (const x of r.findings) {
    assert.ok(CHECK_TITLES[x.checkId], x.checkId)
    assert.equal(x.title, CHECK_TITLES[x.checkId])
    assert.ok(['high', 'medium', 'low', 'info'].includes(x.severity))
    assert.match(fixUrl(x.checkId), /^https:\/\/crawlcove\.com\/.*utm_source=chrome/)
  }
  // Sorted by severity, high first.
  assert.equal(r.findings[0].severity, 'high')
  assert.equal(r.findings.at(-1).severity, 'info')
})

test('ai-bot-access is graded by purpose and merges a wildcard block', () => {
  const r = runChecks(page(), site({ robotsTxt: 'User-agent: *\nDisallow: /\n' }))
  const bot = r.findings.filter((x) => x.checkId === 'ai-bot-access')
  assert.deepEqual(bot.map((x) => x.severity), ['medium', 'low', 'info'])
  assert.match(bot[0].evidence, /wildcard/)
  assert.equal(r.ai.searchBotsAllowed, 0)
})

test('a path-only block for AI search crawlers is a medium finding', () => {
  const r = runChecks(page({ pathname: '/guide' }), site({ robotsTxt: 'User-agent: *\nDisallow: /guide\n' }))
  const bot = r.findings.filter((x) => x.checkId === 'ai-bot-access')
  assert.equal(bot.length, 1)
  assert.match(bot[0].evidence, /disallows this path/)
})

test('training-only blocks do not count against AI search reach', () => {
  const r = runChecks(page(), site({ robotsTxt: 'User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n' }))
  assert.equal(r.ai.searchBotsAllowed, 7)
  assert.deepEqual(ids(r), ['ai-bot-access'])
  assert.equal(r.findings[0].severity, 'info')
})

test('snippet blocks in any of the three carriers', () => {
  assert.ok(isSnippetBlocked('index, nosnippet'))
  assert.ok(isSnippetBlocked('max-snippet:0'))
  assert.ok(!isSnippetBlocked('max-snippet:160'))
  assert.ok(ids(runChecks(page({ googlebotMeta: 'nosnippet' }), site())).includes('ai-snippet-blocked'))
  assert.ok(ids(runChecks(page(), site({ xRobotsTag: 'max-snippet: 0' }))).includes('ai-snippet-blocked'))
  // A noindex page is not indexable, so no snippet finding.
  assert.ok(!ids(runChecks(page({ robotsMeta: 'noindex, nosnippet' }), site())).includes('ai-snippet-blocked'))
})

test('llms.txt served as an HTML 200 counts as missing', () => {
  const r = runChecks(page(), site({ llmsTxt: { status: 200, contentType: 'text/html' } }))
  assert.equal(r.ai.llmsTxt, 'missing')
  assert.ok(ids(r).includes('ai-llms-txt'))
})

test('author and freshness checks only fire on article-family schema', () => {
  const noArticle = runChecks(page({ jsonLd: [JSON.stringify({ '@type': 'WebPage' })] }), site())
  assert.ok(!ids(noArticle).some((i) => i === 'ai-author-authority' || i === 'ai-content-freshness'))
  const bare = runChecks(page({ jsonLd: [JSON.stringify({ '@type': 'BlogPosting', author: 'Someone', datePublished: '2026-01-01' })] }), site())
  const auth = bare.findings.find((x) => x.checkId === 'ai-author-authority')
  assert.match(auth.evidence, /identity link/)
  assert.match(bare.findings.find((x) => x.checkId === 'ai-content-freshness').evidence, /no dateModified/)
  const graph = runChecks(page({ jsonLd: [JSON.stringify({ '@graph': [{ '@type': ['Article', 'Thing'] }] })] }), site())
  assert.match(graph.findings.find((x) => x.checkId === 'ai-author-authority').evidence, /no author/)
  assert.match(graph.findings.find((x) => x.checkId === 'ai-content-freshness').evidence, /and no datePublished/)
})

test('entity markup is a homepage check', () => {
  const home = runChecks(page({ pathname: '/', url: 'https://example.com/', canonical: 'https://example.com/' }), site())
  assert.ok(ids(home).includes('ai-entity-markup'))
  const withOrg = runChecks(page({ pathname: '/', url: 'https://example.com/', canonical: 'https://example.com/', jsonLd: [JSON.stringify({ '@type': 'Organization', name: 'X' })] }), site())
  assert.ok(!ids(withOrg).includes('ai-entity-markup'))
  assert.ok(!ids(runChecks(page(), site())).includes('ai-entity-markup'))
})

test('answer structure needs 400 words and no FAQ or question headings', () => {
  const flat = page({ headings: [{ level: 1, text: 'T' }, { level: 2, text: 'Intro' }, { level: 2, text: 'Details' }] })
  assert.ok(ids(runChecks(flat, site())).includes('ai-answer-structure'))
  assert.ok(!ids(runChecks({ ...flat, wordCount: 399 }, site())).includes('ai-answer-structure'))
  assert.ok(!ids(runChecks({ ...flat, jsonLd: [JSON.stringify({ '@type': 'FAQPage' })] }, site())).includes('ai-answer-structure'))
})

test('extractability is flagged below 50 on indexable pages only', () => {
  const low = page({ headings: [{ level: 1, text: 'T' }], wordCount: 800, jsonLd: [] })
  assert.ok(ids(runChecks(low, site())).includes('ai-extractability'))
  assert.ok(!ids(runChecks({ ...low, robotsMeta: 'noindex' }, site())).includes('ai-extractability'))
})

test('classic checks: title and description lengths, canonical, headings, hreflang', () => {
  const r = runChecks(page({
    title: 'Short',
    metaDescription: 'Too short.',
    canonical: 'http://example.com/guide',
    headings: [{ level: 1, text: 'A' }, { level: 1, text: 'B' }, { level: 4, text: 'C' }],
    h1Count: 2,
    hreflang: [{ lang: 'en', href: 'https://example.com/guide' }, { lang: 'zz-INVALID-TAG-X', href: 'https://example.com/zz' }],
    links: { internal: 5, external: 0, nofollowInternal: 2, uniqueInternal: 5, vagueAnchors: [{ text: 'click here', href: 'https://example.com/x' }] }
  }), site())
  const got = ids(r)
  for (const want of ['title-length', 'meta-description', 'insecure-canonical', 'heading-h1', 'heading-order', 'hreflang', 'nofollow-internal-link', 'non-descriptive-anchor-text']) assert.ok(got.includes(want), want)
  assert.match(r.findings.find((x) => x.checkId === 'hreflang').evidence, /no x-default/)
})

test('canonical to another URL is info, not a problem', () => {
  const r = runChecks(page({ canonical: 'https://example.com/other' }), site())
  const c = r.findings.find((x) => x.checkId === 'canonical')
  assert.equal(c.severity, 'info')
})

test('thin content grades very thin as medium', () => {
  assert.equal(runChecks(page({ wordCount: 40, headings: [{ level: 1, text: 'T' }] }), site()).findings.find((x) => x.checkId === 'thin-content').severity, 'medium')
  assert.equal(runChecks(page({ wordCount: 150 }), site()).findings.find((x) => x.checkId === 'thin-content').severity, 'low')
})

test('invalid JSON-LD is reported and does not break the other schema checks', () => {
  const r = runChecks(page({ jsonLd: ['{not json', JSON.stringify({ '@type': 'Organization' })] }), site())
  assert.ok(ids(r).includes('schema-validity'))
  assert.deepEqual(r.schemaTypes, ['Organization'])
})

test('export JSON page record has the export-spec field set', () => {
  const p = page(), s = site()
  const out = toExportJson(p, s, runChecks(p, s))
  const expected = ['url', 'finalUrl', 'statusCode', 'contentType', 'depth', 'indexable', 'title', 'titleLength', 'metaDescription', 'metaLength', 'canonical', 'htmlLang', 'robotsMeta', 'xRobotsTag', 'h1Count', 'wordCount', 'linksInternal', 'linksExternal', 'imageCount', 'imagesMissingAlt', 'responseTimeMs', 'byteSize', 'rendered', 'redirectHops', 'fetchError', 'schemaBlocks', 'hreflangCount', 'contentFingerprint', 'findingsCount']
  assert.deepEqual(Object.keys(out.pages[0]), expected)
  assert.equal(out.pages[0].titleLength, p.title.length)
  assert.equal(out.aiVisibility.crawlers.length, 23)
})

test('markdown report names the score, the crawlers and the fix links', () => {
  const p = page(), s = site({ robotsTxt: 'User-agent: *\nDisallow: /\n' })
  const md = toMarkdown(p, s, runChecks(p, s))
  assert.match(md, /Extractability score: \*\*65\/100\*\*/)
  assert.match(md, /AI search crawlers allowed: 0 of 7/)
  assert.match(md, /ai-bot-access/)
  assert.match(md, /crawlcove\.com\/tools\/ai-crawler-access-checker\?utm_source=chrome/)
  assert.ok(!md.includes('—'), 'house style: no em dashes')
})

test('no em dashes anywhere in user-facing copy', async () => {
  const { readFileSync } = await import('node:fs')
  for (const f of ['lib/checks.js', 'lib/aiBots.js', 'lib/extractability.js', 'lib/report.js', 'popup/popup.html', 'popup/popup.js', 'manifest.json']) {
    assert.ok(!readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').includes('—'), f)
  }
})
