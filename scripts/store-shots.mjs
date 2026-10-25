#!/usr/bin/env node
// Chrome Web Store screenshots (1280x800). Captures REAL data from live
// crawlcove.com pages with the extension's own content script and probe, then
// renders the popup inside a staged frame with a headline per shot.
// Usage: PW_MODULE=... PW_CHROMIUM=... node scripts/store-shots.mjs [outDir]
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.argv[2] ?? join(ROOT, 'docs/store')
mkdirSync(OUT, { recursive: true })
const { chromium } = createRequire(import.meta.url)(process.env.PW_MODULE ?? 'playwright')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const server = createServer((req, res) => {
  try {
    const file = join(ROOT, req.url.split('?')[0])
    const type = /\.js$/.test(file) ? 'text/javascript' : /\.css$/.test(file) ? 'text/css' : /\.html$/.test(file) ? 'text/html' : /\.png$/.test(file) ? 'image/png' : 'application/octet-stream'
    const body = readFileSync(file)
    res.writeHead(200, { 'content-type': type }); res.end(body)
  } catch { res.writeHead(404); res.end('') }
}).listen(8097)

const snapshotSrc = readFileSync(join(ROOT, 'content/snapshot.js'), 'utf8')
const probeSrc = readFileSync(join(ROOT, 'popup/popup.js'), 'utf8').match(/async function probeSite[\s\S]*?\n}\n/)[0]

const SHOTS = [
  { file: '01-ai-visibility', url: 'https://crawlcove.com/', h: 'Can AI <em>quote</em> this page?', p: 'An extractability score and the five signals behind it, on the page you are looking at.', l: ['Same formula as the Crawl Cove desktop crawler', 'ChatGPT, Perplexity, Claude and AI Overviews read the same signals', 'One click, no account'] },
  { file: '02-ai-crawlers', url: 'https://crawlcove.com/', h: '<em>23 AI crawlers</em>, allowed or blocked', p: 'Read from the site\'s robots.txt with this page\'s path applied, grouped by what each crawler is for.', l: ['Search crawlers decide whether you get cited', 'User fetchers open a page when someone asks about it', 'Training crawlers are an opt-out, not a problem'], setup: async (f) => { await f.click('#bots-more'); await f.evaluate(() => document.querySelector('.bots').scrollIntoView()) } },
  { file: '03-findings', url: 'https://crawlcove.com/blog/seo-crawl-export-format', h: 'Findings under the <em>same names</em> as the full crawl', p: 'Every finding carries its evidence, a fix and the check id the desktop app uses, high to info.', l: ['8 AI visibility checks and 21 on-page checks', 'Snippet blocks in meta tags and X-Robots-Tag headers', 'Fix links into free tools and guides'], setup: async (f) => { await f.evaluate(() => document.querySelector('.tabs').scrollIntoView()) } },
  { file: '04-page', url: 'https://crawlcove.com/tools/robots-txt-tester', h: 'The whole page <em>in one glance</em>', p: 'Title and description with lengths, canonical, robots from all three carriers, language, links, images, hreflang, schema types and the heading outline.', l: ['Status code and X-Robots-Tag from the live response', 'Word count from the rendered page', 'Heading outline with levels'], setup: async (f) => { await f.click('[data-tab="page"]'); await f.evaluate(() => document.querySelector('.tabs').scrollIntoView()) } },
  { file: '05-export', url: 'https://crawlcove.com/tools/robots-txt-tester', h: 'Nothing leaves <em>your browser</em>', p: 'Copy a Markdown report for a ticket or a client note, or download JSON in the open Crawl Cove export format.', l: ['No analytics, no telemetry, no host permissions', 'Three same-origin requests: robots.txt, llms.txt, the page headers', 'Source code public on GitHub'], setup: async (f) => { await f.click('[data-tab="export"]'); await f.evaluate(() => document.querySelector('.tabs').scrollIntoView()) } }
]

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM })
try {
  const captured = new Map()
  const live = await browser.newPage({ userAgent: UA })
  for (const url of new Set(SHOTS.map((s) => s.url))) {
    await live.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    const snapshot = await live.evaluate(snapshotSrc)
    const site = await live.evaluate(`(${probeSrc})(${JSON.stringify(snapshot.url)})`)
    captured.set(url, { snapshot, site })
    console.log(`captured ${url}: ${snapshot.wordCount} words, robots ${site.robotsStatus}, llms ${site.llmsTxt?.status}, status ${site.statusCode}`)
  }
  await live.close()

  for (const shot of SHOTS) {
    const d = captured.get(shot.url)
    const stage = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
    await stage.addInitScript((d) => {
      const ok = () => Promise.resolve()
      window.chrome = {
        tabs: { query: async () => [{ id: 1, url: d.snapshot.url }] },
        storage: { session: { get: async () => ({}), set: ok } },
        scripting: { executeScript: async ({ files }) => [{ result: files ? d.snapshot : d.site }] },
        action: { setBadgeText: ok, setBadgeBackgroundColor: ok, setBadgeTextColor: ok }
      }
    }, d)
    await stage.goto('http://127.0.0.1:8097/scripts/store-stage.html')
    await stage.evaluate((s) => { document.getElementById('h').innerHTML = s.h; document.getElementById('p').textContent = s.p; document.getElementById('l').innerHTML = s.l.map((x) => `<li>${x}</li>`).join('') }, { h: shot.h, p: shot.p, l: shot.l })
    const frame = stage.frames().find((f) => f.url().includes('popup.html'))
    await frame.waitForSelector('#main:not([hidden])', { timeout: 15000 })
    if (shot.setup) await shot.setup(frame)
    await stage.waitForTimeout(300)
    await stage.screenshot({ path: join(OUT, `${shot.file}.png`) })
    console.log(`wrote ${shot.file}.png`)
    await stage.close()
  }
} finally {
  await browser.close()
  server.close()
}
