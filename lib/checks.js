// Per-page checks. Pure: (snapshot, site) in, findings out. Check ids, titles
// and the AI logic mirror the Crawl Cove desktop crawler so the popup is a
// one-page preview of what the full crawl reports, under the same names.
import { botAccess, SEVERITY_BY_PURPOSE, PURPOSE_LABEL } from './aiBots.js'
import { scoreExtractability, EXTRACTABILITY_FLAG_THRESHOLD, QUESTION_RE } from './extractability.js'
import { nodesFromBlocks, typesOf, hasType, hasStringValue, authorHasIdentity, ARTICLE_TYPES, ENTITY_TYPES } from './jsonld.js'

export const CHECK_TITLES = Object.freeze({
  'ai-bot-access': 'AI crawlers blocked',
  'ai-snippet-blocked': 'Snippets blocked from AI answers',
  'ai-llms-txt': 'No llms.txt',
  'ai-extractability': 'Hard for AI answers to quote',
  'ai-author-authority': 'Article author missing',
  'ai-content-freshness': 'Article updated date missing',
  'ai-answer-structure': 'No question and answer structure',
  'ai-entity-markup': 'No organisation or person markup',
  title: 'Missing title',
  'title-length': 'Title length',
  'meta-description': 'Meta description missing or wrong length',
  canonical: 'Canonical tag problems',
  'insecure-canonical': 'Canonical points at http://',
  'social-meta': 'Missing social share tags',
  'html-lang': 'Missing or invalid page language',
  'viewport-missing': 'Missing viewport tag',
  hreflang: 'Hreflang problems',
  'robots-noindex': 'Page excluded from search (noindex)',
  'structured-data-missing': 'No structured data',
  'heading-h1': 'H1 missing or repeated',
  'heading-order': 'Skipped heading levels',
  'thin-content': 'Thin content',
  'content-under-structured': 'Long text with few subheadings',
  'schema-validity': 'Invalid structured data',
  'nofollow-internal-link': 'Nofollow internal links',
  'non-descriptive-anchor-text': 'Vague link text',
  'mixed-content': 'Mixed content',
  'image-alt': 'Images without alt text',
  'lazy-loaded-first-image': 'First image lazy-loaded'
})

export const SEVERITY_ORDER = Object.freeze({ high: 0, medium: 1, low: 2, info: 3 })

// Thresholds, same as the desktop app's defaults.
export const TITLE_RANGE = Object.freeze({ min: 30, max: 60 })
export const DESCRIPTION_RANGE = Object.freeze({ min: 70, max: 160 })
export const THIN_CONTENT_MIN_WORDS = 200
export const VERY_THIN_MAX_WORDS = 60
export const MIN_WORDS_FOR_STRUCTURE = 600
export const MIN_SUBHEADINGS = 2
export const AI_ANSWER_MIN_WORDS = 400

const f = (checkId, severity, evidence, recommendation) => ({
  checkId, category: checkId.startsWith('ai-') ? 'ai' : 'seo', severity, title: CHECK_TITLES[checkId], evidence, recommendation
})

function directiveBlocksSnippet(d) {
  const t = d.trim().toLowerCase()
  if (t === 'nosnippet') return true
  const m = /^max-snippet\s*:\s*(-?\d+)$/.exec(t)
  return m !== null && Number(m[1]) === 0
}
export function isSnippetBlocked(directives) {
  if (directives === null || directives === undefined) return false
  return String(directives).split(',').some(directiveBlocksSnippet)
}
export function isNoindex(directives) {
  if (directives === null || directives === undefined) return false
  return String(directives).split(',').some((d) => /^(noindex|none)$/.test(d.trim().toLowerCase()))
}

function joinList(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * @param {object} page   snapshot from content/snapshot.js
 * @param {object} site   { robotsTxt: string|null, robotsStatus, llmsTxt: {status, contentType}|null,
 *                          xRobotsTag: string|null, statusCode: number|null }
 */
export function runChecks(page, site) {
  const findings = []
  const { nodes, invalid } = nodesFromBlocks(page.jsonLd ?? [])
  const isHome = page.pathname === '/' || page.pathname === ''
  const noindex = isNoindex(page.robotsMeta) || isNoindex(page.googlebotMeta) || isNoindex(site.xRobotsTag)
  const indexable = !noindex && (site.statusCode === null || site.statusCode === 200)

  // ---- AI visibility --------------------------------------------------
  const bots = botAccess(site.robotsTxt, page.pathname)
  for (const purpose of ['search', 'user', 'training']) {
    const blocked = bots.filter((b) => b.purpose === purpose && b.rootBlocked)
    if (blocked.length === 0) continue
    const tokens = blocked.map((b) => b.token)
    const viaWildcard = blocked.every((b) => b.viaWildcard)
    const surfaces = joinList([...new Set(blocked.map((b) => b.surface))])
    const rule = viaWildcard
      ? `robots.txt blocks ${joinList(tokens)} from the site root through the wildcard rule (User-agent: * / Disallow: /).`
      : `robots.txt blocks ${joinList(tokens)} from the site root (Disallow: /).`
    const rec = purpose === 'search'
      ? `Pages on this site may not appear in ${surfaces} while these crawlers are blocked. They index pages for AI search answers and are not used for training. Remove the Disallow: / rule for them unless staying out of those answers is intentional.`
      : purpose === 'user'
        ? `${surfaces} may not open this page when a user asks about it directly while these fetchers are blocked. They act on a single user's request and are not used for training.`
        : `This opts the site out of ${surfaces}. It does not affect Google Search, AI Overviews or the AI search answers that cite websites. No change needed unless you want the content used for training.`
    findings.push(f('ai-bot-access', SEVERITY_BY_PURPOSE[purpose], rule, rec))
  }
  const pathBlocked = bots.filter((b) => b.pathBlocked && b.purpose === 'search')
  if (pathBlocked.length > 0) {
    findings.push(f('ai-bot-access', 'medium',
      `robots.txt disallows this path (${page.pathname}) for ${joinList(pathBlocked.map((b) => b.token))}.`,
      'These AI search crawlers cannot read this page, so it cannot be cited from it. Loosen the matching Disallow rule if the page should be quotable.'))
  }

  const snippetWhere = []
  if (indexable && isSnippetBlocked(page.robotsMeta)) snippetWhere.push(`<meta name="robots" content="${page.robotsMeta}">`)
  if (indexable && isSnippetBlocked(page.googlebotMeta)) snippetWhere.push(`<meta name="googlebot" content="${page.googlebotMeta}">`)
  if (indexable && isSnippetBlocked(site.xRobotsTag)) snippetWhere.push(`X-Robots-Tag: ${site.xRobotsTag}`)
  if (snippetWhere.length > 0) {
    findings.push(f('ai-snippet-blocked', 'medium', snippetWhere.join(' and '),
      'nosnippet / max-snippet:0 removes the page from AI Overviews and AI Mode answers as well as its search snippet. Remove the directive unless the content is paywalled or sensitive.'))
  }

  const llmsPresent = site.llmsTxt !== null && site.llmsTxt.status === 200 && !/html/i.test(site.llmsTxt.contentType || '')
  if (site.llmsTxt !== null && !llmsPresent) {
    findings.push(f('ai-llms-txt', 'info', 'No /llms.txt file was found at the site root.',
      'Consider publishing an /llms.txt file (llmstxt.org): a plain-text, curated map of your most important pages that helps AI answer engines find, summarise and cite the right content.'))
  }

  const faq = nodes.some((n) => typesOf(n).some((t) => /^(FAQPage|QAPage)$/i.test(t)))
  const tableSchema = nodes.some((n) => typesOf(n).includes('Table'))
  const articleNodes = nodes.filter((n) => typesOf(n).some((t) => ARTICLE_TYPES.has(t)))
  const articleDateAuthor = articleNodes.some((n) => (hasStringValue(n, 'datePublished') || hasStringValue(n, 'dateModified')) && n.author !== undefined && n.author !== null && n.author !== '')
  const extract = scoreExtractability({
    headings: page.headings ?? [],
    wordCount: page.wordCount ?? null,
    hasComparisonTable: tableSchema,
    hasFaqSchema: faq,
    hasVisibleDateAuthor: articleDateAuthor
  })
  if (indexable && (page.wordCount ?? 0) >= 20 && extract.score < EXTRACTABILITY_FLAG_THRESHOLD) {
    const failed = Object.entries(extract.subScores).filter(([, v]) => !v).map(([k]) => k)
    findings.push(f('ai-extractability', 'low',
      `Extractability ${extract.score}/100 (threshold ${EXTRACTABILITY_FLAG_THRESHOLD}). Not met: ${failed.join(', ')}.`,
      'Put a one-paragraph answer directly under the H1, break the body into question-shaped H2/H3 sections, and add FAQPage structured data where the page answers questions.'))
  }

  if (indexable && (page.wordCount ?? 0) >= AI_ANSWER_MIN_WORDS && !faq) {
    const q = (page.headings ?? []).filter((h) => h.level >= 2 && h.level <= 3 && QUESTION_RE.test(h.text)).length
    if (q < 2) {
      findings.push(f('ai-answer-structure', 'low',
        `${page.wordCount} words with ${q} question-shaped subheading${q === 1 ? '' : 's'} and no FAQPage/QAPage markup.`,
        'Answer engines lift question-and-answer blocks verbatim. Rephrase key H2/H3s as the questions people ask and answer each one in its first sentence, or add FAQPage structured data.'))
    }
  }

  if (indexable && articleNodes.length > 0) {
    let noAuthor = false, noIdentity = false
    for (const n of articleNodes) {
      const a = n.author
      const list = Array.isArray(a) ? a : [a]
      const usable = list.filter((x) => (typeof x === 'string' && x.trim() !== '') || (x && typeof x === 'object' && hasStringValue(x, 'name')))
      if (usable.length === 0) { noAuthor = true; continue }
      if (!usable.some((x) => typeof x === 'object' && authorHasIdentity(x))) noIdentity = true
    }
    if (noAuthor) findings.push(f('ai-author-authority', 'low', 'Article structured data has no author.', 'Add an author (Person or Organization) with a url or sameAs link so generative engines can attribute and trust the content.'))
    else if (noIdentity) findings.push(f('ai-author-authority', 'low', 'Article author has no identity link (url/sameAs/@id).', 'Give the author node a url or sameAs pointing at a profile page so the entity can be disambiguated.'))

    const stale = articleNodes.filter((n) => !hasStringValue(n, 'dateModified'))
    if (stale.length > 0) {
      const noPub = stale.some((n) => !hasStringValue(n, 'datePublished'))
      findings.push(f('ai-content-freshness', 'low',
        `Article structured data has no dateModified (freshness) signal${noPub ? ' and no datePublished' : ''}.`,
        'Add and maintain dateModified (and datePublished) in the Article schema so generative engines can judge recency.'))
    }
  }

  if (indexable && isHome && !hasType(nodes, ENTITY_TYPES)) {
    findings.push(f('ai-entity-markup', 'low', 'The homepage has no Organization or Person JSON-LD.',
      'Add Organization (or Person) JSON-LD with name, logo and sameAs links to authoritative profiles so generative engines can identify and trust the entity.'))
  }

  // ---- Classic on-page ----------------------------------------------
  const title = (page.title ?? '').trim()
  if (title === '') findings.push(f('title', 'high', 'The page has no <title>.', 'Add a unique, descriptive title of 30 to 60 characters.'))
  else if (title.length < TITLE_RANGE.min || title.length > TITLE_RANGE.max) {
    findings.push(f('title-length', 'low', `Title is ${title.length} characters (recommended ${TITLE_RANGE.min} to ${TITLE_RANGE.max}).`,
      title.length > TITLE_RANGE.max ? 'Shorten the title so it is not cut off in results.' : 'Lengthen the title to say what the page is about.'))
  }

  const desc = (page.metaDescription ?? '').trim()
  if (page.metaDescription === null || desc === '') findings.push(f('meta-description', 'medium', 'No meta description.', 'Write a 70 to 160 character description that says what the reader gets.'))
  else if (desc.length < DESCRIPTION_RANGE.min || desc.length > DESCRIPTION_RANGE.max) {
    findings.push(f('meta-description', 'low', `Meta description is ${desc.length} characters (recommended ${DESCRIPTION_RANGE.min} to ${DESCRIPTION_RANGE.max}).`, 'Adjust the length so the whole description shows in results.'))
  }

  if (page.canonical === null) findings.push(f('canonical', 'low', 'No canonical tag.', 'Add <link rel="canonical"> pointing at the preferred URL for this content.'))
  else {
    if (/^http:\/\//i.test(page.canonical) && page.protocol === 'https:') findings.push(f('insecure-canonical', 'medium', `Canonical is ${page.canonical}`, 'Point the canonical at the https:// URL.'))
    const norm = (u) => { try { const x = new URL(u); x.hash = ''; return x.href.replace(/\/$/, '') } catch { return u } }
    if (norm(page.canonical) !== norm(page.url)) findings.push(f('canonical', 'info', `Canonical points at ${page.canonical}`, 'This page is canonicalised to another URL. Fine when deliberate; a mistake if this is the page you want indexed.'))
  }

  if (noindex) findings.push(f('robots-noindex', 'medium', [page.robotsMeta && `robots: ${page.robotsMeta}`, page.googlebotMeta && `googlebot: ${page.googlebotMeta}`, site.xRobotsTag && `X-Robots-Tag: ${site.xRobotsTag}`].filter(Boolean).join('; '), 'The page is excluded from search and from AI answers that rely on the index. Remove noindex if that is not intended.'))

  if (page.h1Count === 0) findings.push(f('heading-h1', 'medium', 'No H1 on the page.', 'Add one H1 that states the topic.'))
  else if (page.h1Count > 1) findings.push(f('heading-h1', 'low', `${page.h1Count} H1 headings.`, 'Keep one H1 and demote the others.'))

  let prev = 0, skipped = null
  for (const h of page.headings ?? []) {
    if (prev > 0 && h.level > prev + 1) { skipped = `H${prev} to H${h.level}`; break }
    prev = h.level
  }
  if (skipped) findings.push(f('heading-order', 'low', `Heading level skipped (${skipped}).`, 'Keep heading levels sequential so the outline reads correctly.'))

  const lang = (page.htmlLang ?? '').trim()
  if (lang === '' || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i.test(lang)) findings.push(f('html-lang', 'low', lang === '' ? 'No lang attribute on <html>.' : `lang="${lang}" is not a valid language tag.`, 'Set <html lang="en"> (or the right BCP 47 tag).'))
  if (!page.viewport) findings.push(f('viewport-missing', 'medium', 'No viewport meta tag.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'))

  const soc = page.social ?? {}
  const missingSoc = [!soc.ogTitle && 'og:title', !soc.ogDescription && 'og:description', !soc.ogImage && 'og:image'].filter(Boolean)
  if (indexable && missingSoc.length > 0) findings.push(f('social-meta', 'low', `Missing ${missingSoc.join(', ')}.`, 'Add Open Graph tags so shares show a title, description and image.'))

  if (indexable && (page.jsonLd ?? []).length === 0) findings.push(f('structured-data-missing', 'low', 'No JSON-LD on the page.', 'Add the schema.org type that fits (Article, Product, FAQPage, Organization) as JSON-LD.'))
  if (invalid.length > 0) findings.push(f('schema-validity', 'medium', `${invalid.length} JSON-LD block${invalid.length === 1 ? '' : 's'} failed to parse.`, 'Fix the JSON so search engines and AI answer engines can read it.'))

  const wc = page.wordCount ?? 0
  if (indexable && wc < THIN_CONTENT_MIN_WORDS) findings.push(f('thin-content', wc < VERY_THIN_MAX_WORDS ? 'medium' : 'low', `${wc} words of visible text.`, 'Add substance: the answer, the detail, the evidence. Thin pages rarely rank or get cited.'))
  if (wc >= MIN_WORDS_FOR_STRUCTURE && (page.headings ?? []).filter((h) => h.level >= 2).length < MIN_SUBHEADINGS) findings.push(f('content-under-structured', 'low', `${wc} words with fewer than ${MIN_SUBHEADINGS} subheadings.`, 'Break long text into H2/H3 sections.'))

  const hl = page.hreflang ?? []
  if (hl.length > 0) {
    const problems = []
    if (!hl.some((h) => h.lang.toLowerCase() === 'x-default')) problems.push('no x-default')
    if (!hl.some((h) => h.href && h.href.replace(/\/$/, '') === page.url.split('#')[0].replace(/\/$/, ''))) problems.push('no self-referencing entry')
    const bad = hl.filter((h) => !/^([a-z]{2,3}(-[A-Za-z0-9]{2,8})*|x-default)$/i.test(h.lang))
    if (bad.length > 0) problems.push(`invalid code${bad.length > 1 ? 's' : ''}: ${bad.map((b) => b.lang).join(', ')}`)
    if (problems.length > 0) findings.push(f('hreflang', 'low', `${hl.length} hreflang links; ${problems.join('; ')}.`, 'Every language version should list every other one plus itself, with an x-default.'))
  }

  if ((page.mixedContent ?? []).length > 0) findings.push(f('mixed-content', 'high', `${page.mixedContent.length} http:// resource${page.mixedContent.length === 1 ? '' : 's'} on an https page, e.g. ${page.mixedContent[0]}`, 'Serve every image, script and stylesheet over https.'))

  const imgs = page.images ?? {}
  if ((imgs.missingAlt ?? 0) > 0) findings.push(f('image-alt', 'low', `${imgs.missingAlt} of ${imgs.count} images have no alt attribute.`, 'Describe informative images; use alt="" for decorative ones.'))
  if (imgs.firstImageLazy) findings.push(f('lazy-loaded-first-image', 'low', 'The first image on the page is loading="lazy".', 'Load the first (likely above-the-fold) image eagerly; lazy-loading it delays Largest Contentful Paint.'))

  const links = page.links ?? {}
  if ((links.nofollowInternal ?? 0) > 0) findings.push(f('nofollow-internal-link', 'low', `${links.nofollowInternal} internal link${links.nofollowInternal === 1 ? '' : 's'} ${links.nofollowInternal === 1 ? 'carries' : 'carry'} rel="nofollow".`, 'Internal links should pass signals; drop nofollow unless the target is user-generated.'))
  if ((links.vagueAnchors ?? []).length > 0) findings.push(f('non-descriptive-anchor-text', 'low', `Link text like "${links.vagueAnchors[0].text}" (${links.vagueAnchors.length} found).`, 'Say what the linked page is in the link text.'))

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  return {
    findings,
    ai: {
      extractability: extract,
      bots,
      snippetBlocked: snippetWhere.length > 0,
      llmsTxt: site.llmsTxt === null ? 'unknown' : llmsPresent ? 'present' : 'missing',
      robotsTxt: site.robotsTxt === null ? 'unreachable' : 'found',
      searchBotsAllowed: bots.filter((b) => b.purpose === 'search' && b.allowed).length,
      searchBotsTotal: bots.filter((b) => b.purpose === 'search').length
    },
    indexable,
    schemaTypes: [...new Set(nodes.flatMap(typesOf))]
  }
}

export { PURPOSE_LABEL }
