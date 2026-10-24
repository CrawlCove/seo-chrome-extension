// Page snapshot. Injected into the active tab when the toolbar button is
// pressed; reads the DOM and returns one plain object. It fetches nothing,
// changes nothing on the page and is the ONLY code that runs in the page.
// Everything it collects is a field the Crawl Cove desktop crawler also
// records for a page, so the checks in lib/checks.js can mirror the app's.
(() => {
  const doc = document
  const abs = (href) => {
    try { return new URL(href, doc.baseURI).href } catch { return null }
  }
  const meta = (name) => {
    const el = doc.querySelector(`meta[name="${name}" i]`)
    return el ? (el.getAttribute('content') ?? '') : null
  }
  const prop = (name) => {
    const el = doc.querySelector(`meta[property="${name}" i]`)
    return el ? (el.getAttribute('content') ?? '') : null
  }
  const text = (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()

  const pageUrl = new URL(location.href)
  const host = pageUrl.hostname.replace(/^www\./, '')
  const isInternal = (u) => {
    try { return new URL(u).hostname.replace(/^www\./, '') === host } catch { return false }
  }

  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => ({
    level: Number(h.tagName[1]),
    text: text(h).slice(0, 200)
  }))

  // Visible body words. innerText follows CSS, so script, style, noscript and
  // display:none content are already excluded; nothing on the page is touched.
  const wordCount = doc.body
    ? (doc.body.innerText || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
    : 0

  const VAGUE = new Set(['click here', 'here', 'read more', 'more', 'learn more', 'link', 'this', 'this page', 'continue', 'details'])
  const anchors = [...doc.querySelectorAll('a[href]')]
  let internal = 0, external = 0, nofollowInternal = 0
  const vagueAnchors = []
  const internalHrefs = new Set()
  for (const a of anchors) {
    const href = a.getAttribute('href') || ''
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) continue
    const url = abs(href)
    if (!url || !/^https?:/i.test(url)) continue
    const rel = (a.getAttribute('rel') || '').toLowerCase()
    if (isInternal(url)) {
      internal++
      internalHrefs.add(url.split('#')[0])
      if (/\bnofollow\b/.test(rel)) nofollowInternal++
      const label = text(a).toLowerCase()
      if (label && VAGUE.has(label) && vagueAnchors.length < 10) vagueAnchors.push({ text: label, href: url })
    } else {
      external++
    }
  }

  const imgs = [...doc.querySelectorAll('img')]
  const missingAlt = imgs.filter((i) => !i.hasAttribute('alt')).length
  const emptyAlt = imgs.filter((i) => i.hasAttribute('alt') && i.getAttribute('alt').trim() === '').length
  const firstImg = imgs.find((i) => (i.getAttribute('src') || i.getAttribute('data-src')) && !/^data:/.test(i.getAttribute('src') || ''))
  const firstImageLazy = !!firstImg && (firstImg.getAttribute('loading') || '').toLowerCase() === 'lazy'

  const jsonLd = [...doc.querySelectorAll('script[type="application/ld+json" i]')]
    .map((s) => (s.textContent || '').trim())
    .filter((s) => s !== '')

  const hreflang = [...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => ({
    lang: (l.getAttribute('hreflang') || '').trim(),
    href: abs(l.getAttribute('href') || '')
  }))

  // Mixed content: http:// subresources on an https page.
  const mixed = []
  if (pageUrl.protocol === 'https:') {
    const sel = 'img[src], script[src], iframe[src], link[rel~="stylesheet"][href], video[src], audio[src], source[src]'
    for (const el of doc.querySelectorAll(sel)) {
      const v = el.getAttribute('src') || el.getAttribute('href') || ''
      if (/^http:\/\//i.test(v) && mixed.length < 20) mixed.push(v)
    }
  }

  const canonicalEl = doc.querySelector('link[rel="canonical"]')
  const canonical = canonicalEl ? abs(canonicalEl.getAttribute('href') || '') : null
  const title = doc.querySelector('head > title, title')
  const h1s = headings.filter((h) => h.level === 1)

  return {
    url: location.href,
    protocol: pageUrl.protocol,
    pathname: pageUrl.pathname,
    host: pageUrl.hostname,
    contentType: doc.contentType || null,
    title: title ? text(title) : null,
    metaDescription: meta('description'),
    canonical,
    robotsMeta: meta('robots'),
    googlebotMeta: meta('googlebot'),
    htmlLang: doc.documentElement.getAttribute('lang'),
    viewport: meta('viewport'),
    headings,
    h1Count: h1s.length,
    wordCount,
    links: { internal, external, nofollowInternal, uniqueInternal: internalHrefs.size, vagueAnchors },
    images: { count: imgs.length, missingAlt, emptyAlt, firstImageLazy },
    jsonLd,
    social: {
      ogTitle: prop('og:title'),
      ogDescription: prop('og:description'),
      ogImage: prop('og:image'),
      twitterCard: meta('twitter:card')
    },
    hreflang,
    mixedContent: mixed,
    tableCount: doc.querySelectorAll('table').length,
    visible: {
      timeElements: doc.querySelectorAll('time[datetime]').length,
      publishedMeta: prop('article:published_time'),
      modifiedMeta: prop('article:modified_time'),
      authorMeta: meta('author') || prop('article:author'),
      relAuthor: doc.querySelectorAll('a[rel~="author"]').length
    },
    renderedAt: new Date().toISOString()
  }
})()
