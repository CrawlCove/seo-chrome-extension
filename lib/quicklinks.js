// The checks an SEO opens in another tab a dozen times a day. One click each,
// prefilled with the current URL. Third-party tools first, then ours.
import { SITE, UTM } from './links.js'

export function quickLinks(pageUrl) {
  const u = encodeURIComponent(pageUrl)
  let origin = ''
  let host = ''
  try { const x = new URL(pageUrl); origin = x.origin; host = x.hostname } catch { /* leave empty */ }
  return {
    google: [
      { label: 'Google: this URL', url: `https://www.google.com/search?q=${encodeURIComponent(pageUrl)}`, hint: 'Is it in the index, and what snippet shows?' },
      { label: 'Google: site:' + host, url: `https://www.google.com/search?q=site%3A${encodeURIComponent(host)}`, hint: 'Indexed pages on this host' },
      { label: 'Bing: this URL', url: `https://www.bing.com/search?q=url%3A${u}`, hint: '' },
      { label: 'PageSpeed Insights', url: `https://pagespeed.web.dev/analysis?url=${u}`, hint: 'Field and lab Core Web Vitals' },
      { label: 'Rich Results Test', url: `https://search.google.com/test/rich-results?url=${u}`, hint: 'What Google makes of the structured data' },
      { label: 'Schema.org validator', url: `https://validator.schema.org/#url=${u}`, hint: '' },
      { label: 'Wayback Machine', url: `https://web.archive.org/web/*/${pageUrl}`, hint: 'How the page looked before' },
      { label: 'W3C HTML validator', url: `https://validator.w3.org/nu/?doc=${u}`, hint: '' },
      { label: 'robots.txt', url: `${origin}/robots.txt`, hint: '' },
      { label: 'sitemap.xml', url: `${origin}/sitemap.xml`, hint: '' },
      { label: 'llms.txt', url: `${origin}/llms.txt`, hint: '' }
    ],
    crawlcove: [
      { label: 'AI crawler access checker', url: `${SITE}/tools/ai-crawler-access-checker?${UTM}` },
      { label: 'AI search visibility checker', url: `${SITE}/tools/ai-search-visibility-checker?${UTM}` },
      { label: 'SERP snippet preview', url: `${SITE}/tools/serp-snippet-preview?${UTM}` },
      { label: 'Redirect checker', url: `${SITE}/tools/redirect-checker?${UTM}` },
      { label: 'Broken link checker', url: `${SITE}/tools/broken-link-checker?${UTM}` },
      { label: 'robots.txt tester', url: `${SITE}/tools/robots-txt-tester?${UTM}` },
      { label: 'XML sitemap checker', url: `${SITE}/tools/xml-sitemap-checker?${UTM}` },
      { label: 'Hreflang checker', url: `${SITE}/tools/hreflang-checker?${UTM}` },
      { label: 'Duplicate content checker', url: `${SITE}/tools/duplicate-content-checker?${UTM}` },
      { label: 'Orphan page checker', url: `${SITE}/tools/orphan-page-checker?${UTM}` }
    ]
  }
}
