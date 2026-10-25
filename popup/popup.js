import { runChecks, PURPOSE_LABEL } from '../lib/checks.js'
import { SUB_SCORE_LABEL } from '../lib/extractability.js'
import { toMarkdown, toExportJson } from '../lib/report.js'
import { fixUrl, siteUrl } from '../lib/links.js'
import { analyseKeyword, topPhrases, KEYWORD_WEIGHTS } from '../lib/keyword.js'
import { inspectSchema } from '../lib/schema.js'
import { quickLinks } from '../lib/quicklinks.js'
import { toCsv } from '../lib/report.js'

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Runs INSIDE the page (serialised by chrome.scripting), so it must be
 * self-contained. Same-origin fetches only: robots.txt, llms.txt and the
 * page's own response headers. Nothing goes anywhere else.
 */
async function probeSite(pageUrl) {
  const origin = new URL(pageUrl).origin
  const get = async (url, init = {}) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    try {
      const r = await fetch(url, { credentials: 'omit', redirect: 'follow', signal: ctrl.signal, ...init })
      const ct = r.headers.get('content-type')
      const body = init.method === 'HEAD' ? null : await r.text()
      return { status: r.status, contentType: ct, xRobotsTag: r.headers.get('x-robots-tag'), body }
    } catch {
      return null
    } finally {
      clearTimeout(t)
    }
  }
  const [robots, llms] = await Promise.all([get(origin + '/robots.txt'), get(origin + '/llms.txt', { method: 'HEAD' })])
  let self = await get(pageUrl, { method: 'HEAD', cache: 'no-store' })
  if (self === null || self.status === 405 || self.status === 501) self = await get(pageUrl, { cache: 'force-cache' })
  // Buffered performance entries are delivered on a task, so wait a tick.
  const observe = (type) => new Promise((resolve) => {
    let done = false
    const finish = (list) => { if (!done) { done = true; resolve(list) } }
    try {
      const po = new PerformanceObserver((l) => { finish(l.getEntries()); po.disconnect() })
      po.observe({ type, buffered: true })
      setTimeout(() => { finish(po.takeRecords()); po.disconnect() }, 150)
    } catch { finish([]) }
  })
  const [lcp, shifts] = await Promise.all([observe('largest-contentful-paint'), observe('layout-shift')])
  const perf = {
    lcpMs: lcp.length ? Math.round(lcp[lcp.length - 1].startTime) : null,
    cls: Math.round(shifts.filter((e) => !e.hadRecentInput).reduce((a, e) => a + e.value, 0) * 1000) / 1000
  }
  return {
    perf,
    robotsTxt: robots && robots.status === 200 && !/html/i.test(robots.contentType || '') ? robots.body : null,
    robotsStatus: robots ? robots.status : null,
    llmsTxt: llms ? { status: llms.status, contentType: llms.contentType } : null,
    xRobotsTag: self ? self.xRobotsTag : null,
    statusCode: self ? self.status : null,
    contentType: self ? self.contentType : null
  }
}

async function analyse(tab) {
  const [snap] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/snapshot.js'] })
  const page = snap?.result
  if (!page) throw new Error('Could not read the page.')
  let site = { robotsTxt: null, robotsStatus: null, llmsTxt: null, xRobotsTag: null, statusCode: null, contentType: null }
  try {
    const [probe] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: probeSite, args: [page.url] })
    if (probe?.result) site = probe.result
    if (site.perf) page.perf = { ...(page.perf ?? {}), ...site.perf }
  } catch { /* site probe is best-effort; page checks still run */ }
  const result = runChecks(page, site)
  return { page, site, result }
}

function ringColour(score) {
  return score >= 75 ? 'var(--signal)' : score >= 50 ? 'var(--tide)' : score >= 25 ? 'var(--warn)' : 'var(--alert)'
}

function botLi(b) {
  const cls = b.rootBlocked ? 'blocked' : b.pathBlocked ? 'path' : ''
  const why = b.rootBlocked ? (b.viaWildcard ? 'blocked via *' : 'blocked') : b.pathBlocked ? 'this path' : 'allowed'
  return `<li title="${esc(b.operator)}: ${esc(b.surface)}"><span class="dot ${cls}"></span>${esc(b.token)}<small>${why}</small></li>`
}

function render({ page, site, result }, tab) {
  const ai = result.ai
  $('host').textContent = page.host
  const score = ai.extractability.score
  const ring = $('ring')
  ring.style.setProperty('--pct', String(score))
  ring.style.setProperty('--ring-color', ringColour(score))
  $('score').textContent = String(score)
  const quote = score >= 50 ? 'This page is structured so AI answer engines can quote it.' : 'AI answer engines will struggle to lift a clean answer from this page.'
  const reach = ai.robotsTxt === 'unreachable'
    ? 'robots.txt was unreachable, so every crawler is treated as allowed.'
    : `${ai.searchBotsAllowed} of ${ai.searchBotsTotal} AI search crawlers can read it.`
  $('ai-summary').textContent = `${quote} ${reach}`
  $('signals').innerHTML = Object.entries(ai.extractability.subScores)
    .map(([k, v]) => `<li class="${v ? '' : 'off'}">${esc(SUB_SCORE_LABEL[k])}</li>`).join('')

  const search = ai.bots.filter((b) => b.purpose === 'search')
  $('bots').innerHTML = search.map(botLi).join('')
  $('bots-count').textContent = `${ai.searchBotsAllowed}/${ai.searchBotsTotal} allowed`
  const rest = ai.bots.filter((b) => b.purpose !== 'search')
  $('bots-rest').innerHTML = ['user', 'training'].map((p) =>
    `<li style="grid-column:1/-1;color:var(--fog);margin-top:6px">${esc(PURPOSE_LABEL[p])}</li>` + rest.filter((b) => b.purpose === p).map(botLi).join('')
  ).join('')
  $('bots-more').onclick = () => { const r = $('bots-rest'); r.hidden = !r.hidden; $('bots-more').textContent = r.hidden ? 'Show user fetchers and training crawlers' : 'Hide user fetchers and training crawlers' }

  const flags = []
  flags.push(ai.snippetBlocked ? '<span class="chip bad">Snippet blocked from AI Overviews</span>' : '<span class="chip good">Snippets allowed</span>')
  flags.push(ai.llmsTxt === 'present' ? '<span class="chip good">llms.txt present</span>' : ai.llmsTxt === 'missing' ? '<span class="chip">No llms.txt</span>' : '<span class="chip">llms.txt unknown</span>')
  flags.push(result.indexable ? '<span class="chip good">Indexable</span>' : '<span class="chip bad">Not indexable</span>')
  if (result.schemaTypes.length) flags.push(`<span class="chip">Schema: ${esc(result.schemaTypes.slice(0, 4).join(', '))}${result.schemaTypes.length > 4 ? '…' : ''}</span>`)
  $('flags').innerHTML = flags.join('')

  const fs = result.findings
  $('n-findings').textContent = fs.length ? `(${fs.length})` : ''
  $('findings').innerHTML = fs.length === 0
    ? '<li class="empty">Nothing flagged on this page. Crawl the site to check the rest.</li>'
    : fs.map((x) => `<li>
        <div class="f-head"><span class="sev ${x.severity}">${x.severity}</span><span class="f-title">${esc(x.title)}</span><span class="f-id">${esc(x.checkId)}</span></div>
        <p class="f-ev">${esc(x.evidence)}</p>
        <p class="f-rec">${esc(x.recommendation)} <a href="${fixUrl(x.checkId)}" target="_blank" rel="noopener">How to fix</a></p>
      </li>`).join('')

  const n = (v, bad) => `<span class="n ${bad ? 'bad' : ''}">(${v})</span>`
  const facts = [
    ['Title', page.title ? `${esc(page.title)} ${n(page.title.length + ' chars', page.title.length < 30 || page.title.length > 60)}` : '<span class="n bad">none</span>'],
    ['Description', page.metaDescription ? `${esc(page.metaDescription)} ${n(page.metaDescription.length + ' chars', page.metaDescription.length < 70 || page.metaDescription.length > 160)}` : '<span class="n bad">none</span>'],
    ['Canonical', page.canonical ? esc(page.canonical) : '<span class="n">none</span>'],
    ['Robots', esc([page.robotsMeta && `meta: ${page.robotsMeta}`, page.googlebotMeta && `googlebot: ${page.googlebotMeta}`, site.xRobotsTag && `header: ${site.xRobotsTag}`].filter(Boolean).join(' · ') || 'none')],
    ['Status', site.statusCode ?? 'unknown'],
    ['Language', esc(page.htmlLang || 'none')],
    ['Words', String(page.wordCount)],
    ['Headings', `${page.h1Count} H1 · ${page.headings.length} total`],
    ['Links', `${page.links.internal} internal (${page.links.uniqueInternal} unique) · ${page.links.external} external · ${page.links.nofollowInternal} nofollow`],
    ['Images', `${page.images.count} · ${page.images.missingAlt} without alt · ${page.images.emptyAlt} empty alt`],
    ['Hreflang', page.hreflang.length ? page.hreflang.map((h) => esc(h.lang)).join(', ') : 'none'],
    ['Open Graph', [page.social.ogTitle && 'title', page.social.ogDescription && 'description', page.social.ogImage && 'image'].filter(Boolean).join(', ') || '<span class="n bad">none</span>'],
    ['Structured data', result.schemaTypes.length ? esc(result.schemaTypes.join(', ')) : 'none'],
    ['Viewport', page.viewport ? esc(page.viewport) : '<span class="n bad">none</span>']
  ]
  $('facts').innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
  $('outline').innerHTML = page.headings.slice(0, 80).map((h) => `<li style="padding-left:${(h.level - 1) * 12}px"><b>H${h.level}</b>${esc(h.text)}</li>`).join('') || '<li>No headings.</li>'

  $('cta-link').href = siteUrl('/')
  $('copy-md').onclick = () => copy(toMarkdown(page, site, result), 'Markdown copied.')
  $('copy-json').onclick = () => copy(JSON.stringify(toExportJson(page, site, result), null, 2), 'JSON copied.')
  $('dl-json').onclick = () => download(JSON.stringify(toExportJson(page, site, result), null, 2), `crawlcove-${page.host}-${page.pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}.json`, 'application/json')

  renderSerp(page, site)
  renderVitals(page.perf ?? {})
  renderKeywordTab(page, tab)
  renderSchemaTab(page)
  renderLinksTab(page)
  renderToolsTab(page, tab)
  $('copy-headings').onclick = () => copy(page.headings.map((h) => `${'  '.repeat(h.level - 1)}H${h.level} ${h.text}`).join('\n'), 'Headings copied.')
  $('dl-links').onclick = () => download(linksCsv(page), `crawlcove-links-${page.host}.csv`, 'text/csv')
  $('dl-images').onclick = () => download(imagesCsv(page), `crawlcove-images-${page.host}.csv`, 'text/csv')
  $('copy-links').onclick = () => copy(linksCsv(page), 'Links CSV copied.')
  $('copy-images').onclick = () => copy(imagesCsv(page), 'Images CSV copied.')

  chrome.action.setBadgeText({ tabId: tab.id, text: String(score) }).catch(() => {})
  chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: score >= 50 ? '#22D3EE' : score >= 25 ? '#FFB020' : '#FF5C7A' }).catch(() => {})
  chrome.action.setBadgeTextColor?.({ tabId: tab.id, color: '#05060A' }).catch?.(() => {})

  $('state').hidden = true
  $('main').hidden = false
}

function download(text, name, type) {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const LINK_COLUMNS = ['href', 'text', 'internal', 'rel', 'target']
const IMAGE_COLUMNS = ['src', 'alt', 'width', 'height', 'displayWidth', 'loading', 'sized']
const linksCsv = (page) => toCsv(page.links?.list ?? [], LINK_COLUMNS)
const imagesCsv = (page) => toCsv(page.images?.list ?? [], IMAGE_COLUMNS)

function renderSerp(page, site) {
  const title = page.title || page.url
  const desc = page.metaDescription || page.firstParagraph || ''
  const host = page.host.replace(/^www\./, '')
  const crumbs = page.pathname.split('/').filter(Boolean).slice(0, 3).join(' › ')
  const notes = []
  if (title.length > 60) notes.push(`Title ${title.length} chars: Google will likely cut it after about 60.`)
  if (desc.length > 160) notes.push(`Description ${desc.length} chars: the second line will be cut.`)
  if (!page.metaDescription) notes.push('No meta description: Google will pick text from the page.')
  $('serp').innerHTML = `
    <div class="s-site">${page.favicon ? `<img src="${esc(page.favicon)}" alt="">` : '<span class="s-fav"></span>'}<div>${esc(host)}<small>${esc(page.url.split('?')[0].replace(/\/$/, ''))}${crumbs ? '' : ''}</small></div></div>
    <div class="s-title">${esc(title)}</div>
    <div class="s-desc">${esc(desc)}</div>
    ${notes.length ? `<div class="s-note">${esc(notes.join(' '))}</div>` : ''}`
}

const VITALS = [
  { key: 'lcpMs', label: 'LCP', fmt: (v) => `${(v / 1000).toFixed(2)}s`, good: 2500, ni: 4000, hint: 'Largest Contentful Paint' },
  { key: 'cls', label: 'CLS', fmt: (v) => String(v), good: 0.1, ni: 0.25, hint: 'Cumulative Layout Shift' },
  { key: 'ttfbMs', label: 'TTFB', fmt: (v) => `${v}ms`, good: 800, ni: 1800, hint: 'Time to first byte' },
  { key: 'domContentLoadedMs', label: 'DCL', fmt: (v) => `${(v / 1000).toFixed(2)}s`, good: 2000, ni: 4000, hint: 'DOMContentLoaded' },
  { key: 'resourceBytes', label: 'Weight', fmt: (v) => v > 1048576 ? `${(v / 1048576).toFixed(1)}MB` : `${Math.round(v / 1024)}KB`, good: 1500000, ni: 3000000, hint: (p) => `${p.resources ?? '?'} requests` },
  { key: 'domNodes', label: 'DOM', fmt: (v) => String(v), good: 1500, ni: 3000, hint: 'elements' }
]
function renderVitals(perf) {
  $('vitals').innerHTML = VITALS.map((m) => {
    const v = perf[m.key]
    const cls = v === null || v === undefined ? '' : v <= m.good ? 'good' : v <= m.ni ? 'ni' : 'poor'
    const hint = typeof m.hint === 'function' ? m.hint(perf) : m.hint
    return `<div class="${cls}" title="${esc(hint)}"><b>${v === null || v === undefined ? '–' : esc(m.fmt(v))}</b><small>${m.label}</small></div>`
  }).join('')
}

async function renderKeywordTab(page, tab) {
  const key = `kw:${page.host}`
  const stored = (await chrome.storage.local.get(key))[key]
  const input = $('kw')
  if (stored && !input.value) input.value = stored
  const run = () => {
    const r = analyseKeyword(input.value, page)
    if (!r) { $('kwresult').innerHTML = ''; return }
    chrome.storage.local.set({ [key]: input.value.trim() }).catch(() => {})
    const colour = r.score >= 80 ? 'var(--signal)' : r.score >= 50 ? 'var(--tide)' : r.score >= 25 ? 'var(--warn)' : 'var(--alert)'
    const LABEL = { title: 'Title', h1: 'H1', description: 'Meta description', firstParagraph: 'Opening paragraph', subheadings: 'H2 / H3', url: 'URL', body: 'Body' }
    $('kwresult').innerHTML = `
      <div class="kwscore"><div class="ring" style="--pct:${r.score};--ring-color:${colour}"><span>${r.score}</span></div>
        <div><b>“${esc(input.value.trim())}”</b><p class="sub">${r.bodyCount} body mention${r.bodyCount === 1 ? '' : 's'}, ${r.density}% density${r.altHits ? `, in ${r.altHits} image alt${r.altHits === 1 ? '' : 's'}` : ''}.</p></div></div>
      <ul class="kwchecks">${Object.entries(r.checks).map(([k, c]) => `<li class="${c.pass ? '' : 'off'}"><b>${LABEL[k]} <small style="color:var(--fog)">${KEYWORD_WEIGHTS[k]}</small></b><span>${esc(c.detail)}</span></li>`).join('')}</ul>
      ${r.warnings.map((w) => `<p class="kwwarn">${esc(w)}</p>`).join('')}`
  }
  $('kwform').onsubmit = (e) => { e.preventDefault(); run() }
  if (input.value) run()
  const phrases = topPhrases(page.bodyText ?? '')
  $('phrases').innerHTML = phrases.length ? phrases.map((p) => `<li data-p="${esc(p.phrase)}">${esc(p.phrase)}<small>×${p.count}</small></li>`).join('') : '<li>Not enough repeated phrases to say.</li>'
  $('phrases').onclick = (e) => { const li = e.target.closest('li[data-p]'); if (li) { input.value = li.dataset.p; run() } }
}

function renderSchemaTab(page) {
  const r = inspectSchema(page.jsonLd ?? [])
  $('n-schema').textContent = r.items.length ? `(${r.items.length})` : ''
  if (r.blocks === 0) { $('schema').innerHTML = '<p class="sub">No JSON-LD on this page. Microdata and RDFa are not read.</p>'; return }
  const head = `<p class="sub">${r.blocks} JSON-LD block${r.blocks === 1 ? '' : 's'}${r.invalid ? `, <span style="color:var(--alert)">${r.invalid} failed to parse</span>` : ''}. Rich result types: ${r.richResultTypes.length ? esc(r.richResultTypes.join(', ')) : 'none'}. Required and recommended properties follow Google's rich result docs; the <a href="https://search.google.com/test/rich-results?url=${encodeURIComponent(page.url)}" target="_blank" rel="noopener">Rich Results Test</a> is the final word.</p>`
  $('schema').innerHTML = head + r.items.map((i) => `<div class="schema-item"><span class="t">${esc(i.type)}</span>${i.label ? `<span class="l">${esc(i.label)}</span>` : ''}
    ${!i.known ? '<div class="l">No rules for this type.</div>' : i.missingRequired.length ? `<div class="miss">Missing required: ${esc(i.missingRequired.join(', '))}</div>` : '<div class="ok">Required properties present.</div>'}
    ${i.missingRecommended.length ? `<div class="rec">Recommended: ${esc(i.missingRecommended.join(', '))}</div>` : ''}</div>`).join('')
}

function renderLinksTab(page) {
  const list = page.links?.list ?? []
  const draw = (f) => {
    const rows = list.filter((l) => f === 'all' || (f === 'internal' && l.internal) || (f === 'external' && !l.internal) || (f === 'nofollow' && /nofollow/.test(l.rel)))
    $('linklist').innerHTML = rows.length ? rows.slice(0, 400).map((l) => `<li><span class="t">${esc(l.text || '(no text)')}</span><span class="tag ${/nofollow/.test(l.rel) ? 'bad' : ''}">${l.internal ? 'int' : 'ext'}${l.rel ? ' ' + esc(l.rel) : ''}</span><a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.href)}</a></li>`).join('') + (rows.length > 400 ? `<li>…${rows.length - 400} more in the CSV.</li>` : '') : '<li>None.</li>'
    document.querySelectorAll('#linkfilters button[data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === f))
  }
  $('linkfilters').onclick = (e) => { const b = e.target.closest('button[data-f]'); if (b) draw(b.dataset.f) }
  draw('all')
  const imgs = page.images?.list ?? []
  $('imagelist').innerHTML = imgs.length ? imgs.slice(0, 200).map((i) => `<li><span class="t">${i.alt === null ? '<span style="color:var(--alert)">no alt attribute</span>' : i.alt === '' ? '<span style="color:var(--warn)">alt=""</span>' : esc(i.alt)}</span><span class="tag ${i.width && i.displayWidth && i.width > i.displayWidth * 2 ? 'bad' : ''}">${i.width && i.height ? `${i.width}×${i.height}` : '?'}${i.displayWidth ? ` → ${i.displayWidth}px` : ''}${i.loading ? ' ' + i.loading : ''}${i.sized ? '' : ' no w/h'}</span><a href="${esc(i.src)}" target="_blank" rel="noopener">${esc(i.src)}</a></li>`).join('') : '<li>No images.</li>'
}

function ccToggleHighlightInPage(kind) { return ccToggleHighlight(kind) }

function renderToolsTab(page, tab) {
  $('hl').onclick = async (e) => {
    const b = e.target.closest('button[data-hl]')
    if (!b) return
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/highlight.js'] })
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: ccToggleHighlightInPage, args: [b.dataset.hl] })
      b.classList.toggle('on', r.result.on)
      $('hlmsg').textContent = r.result.on ? `${r.result.count} highlighted on the page. Press again to clear.` : 'Cleared.'
    } catch (err) {
      $('hlmsg').textContent = `Could not highlight: ${err?.message ?? err}`
    }
  }
  const q = quickLinks(page.url)
  $('quick-google').innerHTML = q.google.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>${l.hint ? `<small>${esc(l.hint)}</small>` : ''}</li>`).join('')
  $('quick-cc').innerHTML = q.crawlcove.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join('')
}

async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); $('copied').textContent = msg } catch { $('copied').textContent = 'Copy failed. Download instead.' }
  setTimeout(() => { $('copied').textContent = '' }, 2500)
}

for (const b of document.querySelectorAll('.tabs button')) {
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b))
    document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== `tab-${b.dataset.tab}` })
  })
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || !tab.id) { fail('No active tab.'); return }
  if (!/^https?:/i.test(tab.url || '') && !(tab.url || '').startsWith('file:')) {
    fail('This page cannot be checked. Open an http(s) page and press the button again.')
    return
  }
  const key = String(tab.id)
  const cached = (await chrome.storage.session.get(key))[key]
  if (cached && cached.page?.url === tab.url) { render(cached, tab); return }
  try {
    const data = await analyse(tab)
    render(data, tab)
    chrome.storage.session.set({ [key]: data }).catch(() => {})
  } catch (e) {
    fail(`Could not check this page: ${e?.message ?? e}. Some pages (Chrome Web Store, browser pages, PDFs) do not allow extensions to run.`)
  }
}

function fail(msg) {
  const s = $('state')
  s.textContent = msg
  s.classList.add('err')
}

main()
