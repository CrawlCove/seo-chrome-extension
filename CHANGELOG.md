# Changelog

## 1.0.0 (2026-10-24)

Initial release.

- One click on any page: on-page SEO findings under the same check ids,
  titles and severities as the Crawl Cove desktop crawler.
- AI answer visibility panel: extractability score (formula 1.0.0, the same
  one the desktop app uses), which of 23 AI crawlers may read the page
  (robots.txt, root and path rules, graded by purpose: search, user fetch,
  training), snippet blocks in the robots meta, googlebot meta or
  X-Robots-Tag header, llms.txt presence.
- AI checks: ai-bot-access, ai-snippet-blocked, ai-llms-txt,
  ai-extractability, ai-answer-structure, ai-author-authority,
  ai-content-freshness, ai-entity-markup.
- Classic checks: title, title-length, meta-description, canonical,
  insecure-canonical, robots-noindex, heading-h1, heading-order, html-lang,
  viewport-missing, social-meta, structured-data-missing, schema-validity,
  thin-content, content-under-structured, hreflang, mixed-content,
  image-alt, lazy-loaded-first-image, nofollow-internal-link,
  non-descriptive-anchor-text.
- Export: Markdown report, JSON whose page record follows the Crawl Cove
  export spec.
- No account, no analytics, no remote calls: the only requests are
  same-origin fetches of robots.txt, llms.txt and the page's own headers.
