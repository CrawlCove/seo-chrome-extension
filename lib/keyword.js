// Focus keyword placement check. Pure. The rule set is the one on-page
// editors actually use: the keyword in the title, meta description, H1, one
// or two subheadings, the opening paragraph, the URL and the body, without
// stuffing (keep it under about 2% of body words).

const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the this to was were will with your you we our can how what why when which do does'.split(' '))

export function normalise(s) {
  return String(s ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}'\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

/**
 * Count whole-phrase occurrences of `kw` in `text` (both normalised). Words
 * may be joined by spaces or hyphens and a simple plural on the last word
 * counts ("title tags" matches "title tag"), which is how editors read it.
 */
export function countPhrase(text, kw) {
  const t = normalise(text), k = normalise(kw)
  if (!t || !k) return 0
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(k).replace(/ /g, '[\\s-]+')}(?:e?s)?(?![\\p{L}\\p{N}])`, 'gu')
  return (t.match(re) || []).length
}

export const KEYWORD_WEIGHTS = Object.freeze({ title: 25, h1: 20, description: 15, firstParagraph: 15, subheadings: 10, url: 10, body: 5 })
export const DENSITY_MAX_PERCENT = 2

/**
 * @param {string} keyword
 * @param {object} page  snapshot (title, metaDescription, headings, pathname, firstParagraph, bodyText, wordCount, images.list, social.ogTitle)
 */
export function analyseKeyword(keyword, page) {
  const kw = normalise(keyword)
  if (!kw) return null
  const kwWords = kw.split(' ').length
  const title = page.title ?? ''
  const titlePos = normalise(title).indexOf(kw)
  const subheadings = (page.headings ?? []).filter((h) => h.level >= 2 && h.level <= 3 && countPhrase(h.text, kw) > 0)
  const slug = normalise((page.pathname ?? '').replace(/[-_/]+/g, ' '))
  const bodyCount = countPhrase(page.bodyText ?? '', kw)
  const totalWords = page.wordCount || (normalise(page.bodyText ?? '').split(' ').filter(Boolean).length) || 0
  const density = totalWords > 0 ? Math.round((bodyCount * kwWords / totalWords) * 1000) / 10 : 0
  const altHits = (page.images?.list ?? []).filter((i) => i.alt && countPhrase(i.alt, kw) > 0).length
  const checks = {
    title: { pass: titlePos >= 0, detail: titlePos < 0 ? 'Not in the title.' : titlePos <= 10 ? 'In the title, near the front.' : `In the title at character ${titlePos + 1}; earlier is better.` },
    h1: { pass: (page.headings ?? []).some((h) => h.level === 1 && countPhrase(h.text, kw) > 0), detail: '' },
    description: { pass: countPhrase(page.metaDescription ?? '', kw) > 0, detail: '' },
    firstParagraph: { pass: countPhrase(page.firstParagraph ?? '', kw) > 0, detail: page.firstParagraph ? '' : 'No opening paragraph found after the H1.' },
    subheadings: { pass: subheadings.length >= 1, detail: subheadings.length === 0 ? 'Not in any H2 or H3.' : subheadings.length > 2 ? `In ${subheadings.length} subheadings; one or two is enough.` : `In ${subheadings.length} subheading${subheadings.length === 1 ? '' : 's'}.` },
    url: { pass: slug.includes(kw) || kw.split(' ').every((w) => slug.split(' ').includes(w)), detail: '' },
    body: { pass: bodyCount >= 1, detail: `${bodyCount} mention${bodyCount === 1 ? '' : 's'} in ${totalWords} words (${density}%).` }
  }
  checks.h1.detail = checks.h1.pass ? 'In the H1.' : 'Not in the H1.'
  checks.description.detail = checks.description.pass ? 'In the meta description.' : 'Not in the meta description.'
  checks.url.detail = checks.url.pass ? 'In the URL.' : 'Not in the URL slug.'
  if (checks.firstParagraph.detail === '') checks.firstParagraph.detail = checks.firstParagraph.pass ? 'In the opening paragraph.' : 'Not in the opening paragraph.'
  let score = 0
  for (const [k, w] of Object.entries(KEYWORD_WEIGHTS)) if (checks[k].pass) score += w
  const warnings = []
  if (density > DENSITY_MAX_PERCENT && bodyCount >= 5) warnings.push(`Density ${density}% reads as stuffing; keep it under ${DENSITY_MAX_PERCENT}% and let synonyms carry the rest.`)
  if (subheadings.length > 2) warnings.push('The keyword is in more than two subheadings; vary them.')
  if (titlePos >= 0 && countPhrase(title, kw) > 1) warnings.push('The keyword repeats inside the title.')
  return { keyword: kw, score, checks, bodyCount, density, totalWords, altHits, subheadings: subheadings.map((h) => h.text), warnings }
}

/** The phrases the page itself repeats most: what it reads as being about. */
export function topPhrases(text, { max = 8, minCount = 2 } = {}) {
  const words = normalise(text).split(' ').filter((w) => w && !/^\d+$/.test(w))
  const counts = new Map()
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n)
      if (STOP.has(gram[0]) || STOP.has(gram[n - 1])) continue
      if (gram.some((w) => w.length < 3)) continue
      const key = gram.join(' ')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }
  return [...counts.entries()].filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .filter(([phrase], i, arr) => !arr.slice(0, i).some(([other]) => other.includes(phrase)))
    .slice(0, max).map(([phrase, count]) => ({ phrase, count }))
}
