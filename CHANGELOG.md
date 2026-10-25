# Changelog

## 1.1.0 (2026-10-25)

For people who do this all day.

- Keyword tab: a focus keyword check scored on placement (title, H1, meta
  description, opening paragraph, H2/H3, URL, body) with density and
  stuffing warnings, plus the phrases the page itself repeats most, one click
  to test any of them. The keyword is remembered per site.
- Page tab: Google search preview with cut-off warnings, and lab web vitals
  from this load (LCP, CLS, TTFB, DOMContentLoaded, page weight and request
  count, DOM size) with good / needs work / poor colouring.
- Schema tab: every JSON-LD node by type with the required and recommended
  properties Google's rich result docs list, missing ones named, and a
  one-click Rich Results Test.
- Links tab: every link with its text, internal or external, rel and
  target, filterable, and every image with alt, natural and displayed size,
  loading attribute and missing width/height. CSV copy and download for
  both.
- Tools tab: highlight headings, nofollow links, external links or images
  without alt on the page itself; one-click checks of the current URL in
  Google, Bing, PageSpeed Insights, Rich Results Test, the schema.org
  validator, the Wayback Machine and the W3C validator; robots.txt,
  sitemap.xml and llms.txt; the Crawl Cove free tools.
- Copy the heading outline. Keyboard shortcut Alt+Shift+C opens the popup.
- Popup is 460px wide; tabs scroll.

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
