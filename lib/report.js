// Export shapes: a Markdown report for pasting into a ticket or client note,
// and a JSON record whose page fields follow the Crawl Cove export spec
// (github.com/CrawlCove/seo-crawl-export-spec) so anything that reads a
// crawl export can read a page checked here.
import { SUB_SCORE_LABEL } from './extractability.js'
import { fixUrl, siteUrl } from './links.js'

export const EXPORT_SCHEMA_VERSION = '1.0.0'

export function toExportPage(page, site, result) {
  const headings = page.headings ?? []
  return {
    url: page.url,
    finalUrl: page.url,
    statusCode: site.statusCode ?? null,
    contentType: site.contentType ?? page.contentType ?? null,
    depth: null,
    indexable: result.indexable,
    title: page.title ?? null,
    titleLength: page.title ? page.title.length : null,
    metaDescription: page.metaDescription ?? null,
    metaLength: page.metaDescription ? page.metaDescription.length : null,
    canonical: page.canonical ?? null,
    htmlLang: page.htmlLang ?? null,
    robotsMeta: page.robotsMeta ?? null,
    xRobotsTag: site.xRobotsTag ?? null,
    h1Count: page.h1Count ?? headings.filter((h) => h.level === 1).length,
    wordCount: page.wordCount ?? null,
    linksInternal: page.links?.internal ?? null,
    linksExternal: page.links?.external ?? null,
    imageCount: page.images?.count ?? null,
    imagesMissingAlt: page.images?.missingAlt ?? null,
    responseTimeMs: null,
    byteSize: null,
    rendered: true,
    redirectHops: null,
    fetchError: null,
    schemaBlocks: (page.jsonLd ?? []).length,
    hreflangCount: (page.hreflang ?? []).length,
    contentFingerprint: null,
    findingsCount: result.findings.length
  }
}

export function toExportJson(page, site, result) {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    source: 'seo-chrome-extension',
    exportedAt: new Date().toISOString(),
    pageCount: 1,
    pages: [toExportPage(page, site, result)],
    findings: result.findings.map((x) => ({ url: page.url, ...x })),
    aiVisibility: {
      extractability: result.ai.extractability,
      llmsTxt: result.ai.llmsTxt,
      snippetBlocked: result.ai.snippetBlocked,
      crawlers: result.ai.bots.map((b) => ({ token: b.token, operator: b.operator, purpose: b.purpose, allowed: b.allowed, rootBlocked: b.rootBlocked, pathBlocked: b.pathBlocked }))
    }
  }
}

export function toMarkdown(page, site, result) {
  const ai = result.ai
  const lines = []
  lines.push(`# SEO + AI visibility check: ${page.url}`)
  lines.push('')
  lines.push(`Checked ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC with the Crawl Cove Chrome extension.`)
  lines.push('')
  lines.push('## AI answer visibility')
  lines.push('')
  lines.push(`- Extractability score: **${ai.extractability.score}/100**`)
  for (const [k, v] of Object.entries(ai.extractability.subScores)) lines.push(`  - ${v ? '✓' : '✗'} ${SUB_SCORE_LABEL[k]}`)
  lines.push(`- AI search crawlers allowed: ${ai.searchBotsAllowed} of ${ai.searchBotsTotal}` + (ai.robotsTxt === 'unreachable' ? ' (robots.txt unreachable, treated as allowed)' : ''))
  const blocked = ai.bots.filter((b) => !b.allowed)
  if (blocked.length > 0) lines.push(`- Blocked: ${blocked.map((b) => `${b.token} (${b.purpose})`).join(', ')}`)
  lines.push(`- Snippet blocked from AI Overviews: ${ai.snippetBlocked ? 'yes' : 'no'}`)
  lines.push(`- llms.txt: ${ai.llmsTxt}`)
  lines.push('')
  lines.push(`## Findings (${result.findings.length})`)
  lines.push('')
  if (result.findings.length === 0) lines.push('Nothing flagged on this page.')
  for (const x of result.findings) {
    lines.push(`- **${x.severity.toUpperCase()}** ${x.title} (\`${x.checkId}\`)`)
    lines.push(`  ${x.evidence}`)
    lines.push(`  Fix: ${x.recommendation} ${fixUrl(x.checkId)}`)
  }
  lines.push('')
  lines.push('## Page')
  lines.push('')
  lines.push(`- Title (${page.title ? page.title.length : 0}): ${page.title ?? '(none)'}`)
  lines.push(`- Meta description (${page.metaDescription ? page.metaDescription.length : 0}): ${page.metaDescription ?? '(none)'}`)
  lines.push(`- Canonical: ${page.canonical ?? '(none)'}`)
  lines.push(`- Robots: ${page.robotsMeta ?? '(none)'}${site.xRobotsTag ? `; X-Robots-Tag: ${site.xRobotsTag}` : ''}`)
  lines.push(`- Language: ${page.htmlLang ?? '(none)'}`)
  lines.push(`- Words: ${page.wordCount}; H1s: ${page.h1Count}; headings: ${(page.headings ?? []).length}`)
  lines.push(`- Links: ${page.links?.internal ?? 0} internal, ${page.links?.external ?? 0} external`)
  lines.push(`- Images: ${page.images?.count ?? 0}, ${page.images?.missingAlt ?? 0} without alt`)
  lines.push(`- Structured data: ${result.schemaTypes.length > 0 ? result.schemaTypes.join(', ') : 'none'}`)
  lines.push('')
  lines.push(`One page checked. Crawl the whole site with Crawl Cove: ${siteUrl('/')}`)
  return lines.join('\n')
}
