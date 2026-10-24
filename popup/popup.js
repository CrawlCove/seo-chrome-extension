import { runChecks, PURPOSE_LABEL } from '../lib/checks.js'
import { SUB_SCORE_LABEL } from '../lib/extractability.js'
import { toMarkdown, toExportJson } from '../lib/report.js'
import { fixUrl, siteUrl } from '../lib/links.js'

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
  return {
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
  $('dl-json').onclick = () => {
    const blob = new Blob([JSON.stringify(toExportJson(page, site, result), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `crawlcove-${page.host}-${page.pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  chrome.action.setBadgeText({ tabId: tab.id, text: String(score) }).catch(() => {})
  chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: score >= 50 ? '#22D3EE' : score >= 25 ? '#FFB020' : '#FF5C7A' }).catch(() => {})
  chrome.action.setBadgeTextColor?.({ tabId: tab.id, color: '#05060A' }).catch?.(() => {})

  $('state').hidden = true
  $('main').hidden = false
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
