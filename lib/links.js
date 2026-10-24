// Where "How to fix" points for each check. Every link carries the same UTM
// pair so the site can see what the extension sends.
export const SITE = 'https://crawlcove.com'
export const UTM = 'utm_source=chrome&utm_medium=seo-chrome-extension'

const FIX_PATH = {
  'ai-bot-access': '/tools/ai-crawler-access-checker',
  'ai-snippet-blocked': '/guides/measuring-ai-visibility',
  'ai-llms-txt': '/tools/llms-txt-generator',
  'ai-extractability': '/tools/ai-search-visibility-checker',
  'ai-answer-structure': '/tools/ai-search-visibility-checker',
  'ai-author-authority': '/guides/measuring-ai-visibility',
  'ai-content-freshness': '/guides/measuring-ai-visibility',
  'ai-entity-markup': '/structured-data-checker',
  title: '/tools/title-tag-checker',
  'title-length': '/tools/title-tag-checker',
  'meta-description': '/tools/meta-tag-generator',
  'social-meta': '/tools/meta-tag-generator',
  canonical: '/on-page-seo-checker',
  'insecure-canonical': '/on-page-seo-checker',
  'heading-h1': '/on-page-seo-checker',
  'heading-order': '/on-page-seo-checker',
  'thin-content': '/on-page-seo-checker',
  'content-under-structured': '/on-page-seo-checker',
  'html-lang': '/on-page-seo-checker',
  'viewport-missing': '/on-page-seo-checker',
  'robots-noindex': '/tools/robots-txt-tester',
  'structured-data-missing': '/structured-data-checker',
  'schema-validity': '/structured-data-checker',
  'image-alt': '/tools/image-alt-text-checker',
  'lazy-loaded-first-image': '/image-seo-checker',
  hreflang: '/tools/hreflang-checker',
  'mixed-content': '/security',
  'nofollow-internal-link': '/internal-link-checker',
  'non-descriptive-anchor-text': '/internal-link-checker'
}

export function fixUrl(checkId) {
  return `${SITE}${FIX_PATH[checkId] ?? '/guides/audit-check-reference'}?${UTM}`
}

export function siteUrl(path = '/') {
  return `${SITE}${path}?${UTM}`
}
