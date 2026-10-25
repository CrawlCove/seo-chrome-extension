// Browser smoke test. Serves tests/browser/ on :8098 with a robots.txt that
// blocks GPTBot and a 404 llms.txt, runs the real content script in Chromium,
// pipes the snapshot through runChecks, then renders the popup against a
// stubbed chrome.* and screenshots it. Run: node tests/browser/smoke.mjs
// Needs playwright resolvable (PW_MODULE) and a Chromium (PW_CHROMIUM).
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'
import { runChecks } from '../../lib/checks.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const { chromium } = createRequire(import.meta.url)(process.env.PW_MODULE ?? 'playwright')

const server = createServer((req, res) => {
  if (req.url === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('User-agent: *\nDisallow: /admin/\n\nUser-agent: GPTBot\nDisallow: /\n') }
  if (req.url === '/llms.txt') { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<h1>404</h1>') }
  if (req.url === '/fixture.html') { res.writeHead(200, { 'content-type': 'text/html', 'x-robots-tag': 'max-snippet:0' }); return res.end(readFileSync(join(ROOT, 'tests/browser/fixture.html'))) }
  // Everything else: the repo itself, so popup.html loads its ES modules over http
  // (Chromium refuses module imports from file://).
  try {
    const file = join(ROOT, req.url.split('?')[0])
    const type = /\.js$/.test(file) ? 'text/javascript' : /\.css$/.test(file) ? 'text/css' : /\.html$/.test(file) ? 'text/html' : 'application/octet-stream'
    const body = readFileSync(file)
    res.writeHead(200, { 'content-type': type }); res.end(body)
  } catch { res.writeHead(404); res.end('') }
}).listen(8098)

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM })
try {
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:8098/fixture.html')
  const snapshot = await page.evaluate(readFileSync(join(ROOT, 'content/snapshot.js'), 'utf8'))
  assert.equal(snapshot.title, 'Robots.txt tester: check which crawlers a URL allows')
  assert.equal(snapshot.h1Count, 1)
  assert.equal(snapshot.headings.length, 4)
  assert.equal(snapshot.jsonLd.length, 2)
  assert.equal(snapshot.images.count, 3)
  assert.equal(snapshot.images.missingAlt, 1)
  assert.equal(snapshot.images.emptyAlt, 1)
  assert.equal(snapshot.images.firstImageLazy, false)
  assert.equal(snapshot.links.internal, 3)
  assert.equal(snapshot.links.external, 1)
  assert.equal(snapshot.links.nofollowInternal, 1)
  assert.deepEqual(snapshot.links.vagueAnchors.map((a) => a.text), ['click here'])
  assert.ok(snapshot.wordCount > 80 && snapshot.wordCount < 140, `wordCount ${snapshot.wordCount}`)
  assert.equal(snapshot.tableCount, 1)
  assert.equal(snapshot.links.list.length, 4)
  assert.equal(snapshot.images.list.length, 3)
  assert.equal(snapshot.images.list[0].alt, null)
  assert.ok(snapshot.perf.ttfbMs >= 0 && snapshot.perf.domNodes > 10, 'perf captured')

  assert.match(snapshot.firstParagraph, /^Paste your robots.txt/)
  assert.ok(snapshot.bodyText.includes('Robots.txt tester'))

  // Highlights: the file defines the function, a second evaluate toggles it.
  await page.evaluate(readFileSync(join(ROOT, 'content/highlight.js'), 'utf8') + '\nwindow.ccToggleHighlight = ccToggleHighlight')
  const on = await page.evaluate(() => window.ccToggleHighlight('alt'))
  assert.deepEqual(on, { kind: 'alt', on: true, count: 2 })
  assert.equal(await page.evaluate(() => document.querySelectorAll('[data-cc-highlight="alt"]').length), 2)
  const off = await page.evaluate(() => window.ccToggleHighlight('alt'))
  assert.equal(off.on, false)
  assert.equal(await page.evaluate(() => document.querySelectorAll('[data-cc-highlight]').length), 0)
  assert.equal((await page.evaluate(() => window.ccToggleHighlight('headings'))).count, 4)

  // The same-origin probe, exactly as the popup injects it.
  const probeSrc = readFileSync(join(ROOT, 'popup/popup.js'), 'utf8').match(/async function probeSite[\s\S]*?\n}\n/)[0]
  const site = await page.evaluate(`(${probeSrc})(${JSON.stringify(snapshot.url)})`)
  assert.match(site.robotsTxt, /GPTBot/)
  assert.equal(site.llmsTxt.status, 404)
  assert.equal(site.statusCode, 200)
  assert.equal(site.xRobotsTag, 'max-snippet:0')
  console.log(`perf: lcp ${site.perf.lcpMs} cls ${site.perf.cls} ttfb ${snapshot.perf.ttfbMs}`)
  assert.ok(typeof site.perf.lcpMs === 'number' && site.perf.lcpMs > 0, 'LCP captured by the probe')
  snapshot.perf = { ...snapshot.perf, ...site.perf }

  const result = runChecks(snapshot, site)
  const ids = result.findings.map((x) => x.checkId)
  for (const want of ['ai-bot-access', 'ai-snippet-blocked', 'ai-llms-txt', 'ai-author-authority', 'ai-content-freshness', 'schema-validity', 'heading-order', 'image-alt', 'nofollow-internal-link', 'non-descriptive-anchor-text', 'thin-content']) assert.ok(ids.includes(want), want)
  assert.equal(result.ai.bots.find((b) => b.token === 'GPTBot').rootBlocked, true)
  assert.equal(result.ai.searchBotsAllowed, 7)
  assert.equal(result.ai.extractability.subScores.faqSchema, true)

  // Popup render with chrome.* stubbed to return the real snapshot + probe.
  const data = { snapshot, site }
  const popup = await browser.newPage({ viewport: { width: 420, height: 900 } })
  await popup.addInitScript((d) => {
    const ok = () => Promise.resolve()
    window.chrome = {
      tabs: { query: async () => [{ id: 7, url: d.snapshot.url }] },
      storage: { session: { get: async () => ({}), set: ok }, local: { get: async () => ({}), set: ok } },
      scripting: { executeScript: async ({ files }) => [{ result: files ? d.snapshot : d.site }] },
      action: { setBadgeText: ok, setBadgeBackgroundColor: ok, setBadgeTextColor: ok }
    }
  }, data)
  const errors = []
  popup.on('pageerror', (e) => errors.push(String(e)))
  popup.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await popup.goto('http://127.0.0.1:8098/popup/popup.html')
  await popup.waitForSelector('#main:not([hidden])', { timeout: 10000 }).catch(() => { throw new Error('popup did not render: ' + errors.join(' | ')) })
  assert.deepEqual(errors, [])
  assert.equal(await popup.textContent('#score'), String(result.ai.extractability.score))
  assert.equal((await popup.$$('#findings li')).length, result.findings.length)
  assert.equal(await popup.textContent('#bots-count'), '7/7 allowed')
  mkdirSync(join(ROOT, 'docs/screenshots'), { recursive: true })
  await popup.screenshot({ path: join(ROOT, 'docs/screenshots/popup-findings.png'), fullPage: true })
  await popup.click('[data-tab="page"]')
  assert.match(await popup.textContent('#serp .s-title'), /Robots.txt tester/)
  assert.equal((await popup.$$('#vitals div')).length, 6)
  await popup.screenshot({ path: join(ROOT, 'docs/screenshots/popup-page.png'), fullPage: true })
  await popup.click('[data-tab="keyword"]')
  await popup.fill('#kw', 'robots.txt tester')
  await popup.click('#kwform button')
  await popup.waitForSelector('.kwscore')
  const kwScore = Number(await popup.textContent('.kwscore .ring span'))
  assert.equal(kwScore, 50, `title + H1 + body: keyword score ${kwScore}`)
  assert.ok((await popup.$$('#phrases li[data-p]')).length >= 1)
  await popup.screenshot({ path: join(ROOT, 'docs/screenshots/popup-keyword.png'), fullPage: true })
  await popup.click('[data-tab="schema"]')
  assert.match(await popup.textContent('#schema'), /Article/)
  assert.match(await popup.textContent('#schema'), /Missing required/)
  await popup.screenshot({ path: join(ROOT, 'docs/screenshots/popup-schema.png'), fullPage: true })
  await popup.click('[data-tab="links"]')
  assert.equal((await popup.$$('#linklist li')).length, 4)
  await popup.click('#linkfilters button[data-f="nofollow"]')
  assert.equal((await popup.$$('#linklist li')).length, 1)
  assert.equal((await popup.$$('#imagelist li')).length, 3)
  await popup.screenshot({ path: join(ROOT, 'docs/screenshots/popup-links.png'), fullPage: true })
  await popup.click('[data-tab="tools"]')
  assert.equal((await popup.$$('#quick-google li')).length, 11)
  assert.equal((await popup.$$('#hl button')).length, 4)
  await popup.screenshot({ path: join(ROOT, 'docs/screenshots/popup-tools.png'), fullPage: true })
  assert.deepEqual(errors, [])
  console.log(`smoke ok: ${result.findings.length} findings, score ${result.ai.extractability.score}, ${snapshot.wordCount} words`)
} finally {
  await browser.close()
  server.close()
}
