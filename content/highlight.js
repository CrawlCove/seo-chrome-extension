// On-page highlights, toggled from the popup. Injected with
// chrome.scripting.executeScript({ func }) via the wrapper in popup.js; this
// file documents the function and is used by the browser test. Each call
// toggles one overlay set; a second call with the same kind removes it.
// Nothing here changes the page's own DOM beyond adding/removing elements
// with the data-cc-highlight attribute and one <style> block.
function ccToggleHighlight(kind) {
  const ATTR = 'data-cc-highlight'
  const STYLE_ID = 'cc-highlight-style'
  const existing = document.querySelectorAll(`[${ATTR}="${kind}"]`)
  if (existing.length) { existing.forEach((n) => n.remove()); return { kind, on: false, count: 0 } }
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style')
    st.id = STYLE_ID
    st.textContent = `[${ATTR}]{position:absolute;z-index:2147483646;pointer-events:none;box-sizing:border-box;font:600 11px/1 system-ui,sans-serif;border-radius:3px}
[${ATTR}] span{position:absolute;left:0;top:-16px;padding:2px 5px;border-radius:3px;color:#05060A;white-space:nowrap}
[${ATTR}="nofollow"]{outline:2px dashed #FF5C7A;background:rgba(255,92,122,.12)}[${ATTR}="nofollow"] span{background:#FF5C7A}
[${ATTR}="alt"]{outline:2px dashed #FFB020;background:rgba(255,176,32,.14)}[${ATTR}="alt"] span{background:#FFB020}
[${ATTR}="headings"]{outline:2px solid #22D3EE}[${ATTR}="headings"] span{background:#22D3EE}
[${ATTR}="external"]{outline:2px dashed #7C5CFF;background:rgba(124,92,255,.10)}[${ATTR}="external"] span{background:#7C5CFF;color:#fff}`
    document.documentElement.appendChild(st)
  }
  const host = location.hostname.replace(/^www\./, '')
  const isExternal = (a) => { try { return new URL(a.href).hostname.replace(/^www\./, '') !== host } catch { return false } }
  let targets = []
  if (kind === 'nofollow') targets = [...document.querySelectorAll('a[rel~="nofollow" i]')].map((a) => [a, 'nofollow'])
  else if (kind === 'alt') targets = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt') || i.getAttribute('alt').trim() === '').map((i) => [i, i.hasAttribute('alt') ? 'alt=""' : 'no alt'])
  else if (kind === 'headings') targets = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => [h, h.tagName])
  else if (kind === 'external') targets = [...document.querySelectorAll('a[href^="http"]')].filter(isExternal).map((a) => [a, /nofollow/i.test(a.rel) ? 'ext nofollow' : 'external'])
  let count = 0
  for (const [el, label] of targets) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const box = document.createElement('div')
    box.setAttribute(ATTR, kind)
    box.style.left = `${r.left + scrollX}px`
    box.style.top = `${r.top + scrollY}px`
    box.style.width = `${Math.max(r.width, 8)}px`
    box.style.height = `${Math.max(r.height, 8)}px`
    const tag = document.createElement('span')
    tag.textContent = label
    box.appendChild(tag)
    document.body.appendChild(box)
    count++
  }
  return { kind, on: true, count }
}
