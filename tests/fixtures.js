export function page(overrides = {}) {
  return {
    url: 'https://example.com/guide',
    protocol: 'https:',
    pathname: '/guide',
    host: 'example.com',
    contentType: 'text/html',
    title: 'How to write a title tag that ranks and reads well',
    metaDescription: 'A practical guide to writing title tags: length, keyword placement, brand suffixes and the mistakes that get titles rewritten by Google.',
    canonical: 'https://example.com/guide',
    robotsMeta: null,
    googlebotMeta: null,
    htmlLang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    headings: [
      { level: 1, text: 'How to write a title tag' },
      { level: 2, text: 'What is a title tag?' },
      { level: 2, text: 'How long should a title be?' },
      { level: 3, text: 'Examples' }
    ],
    h1Count: 1,
    wordCount: 900,
    links: { internal: 12, external: 3, nofollowInternal: 0, uniqueInternal: 11, vagueAnchors: [] },
    images: { count: 3, missingAlt: 0, emptyAlt: 0, firstImageLazy: false },
    jsonLd: [JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: 'x', author: { '@type': 'Person', name: 'A', url: 'https://example.com/a' }, datePublished: '2026-01-01', dateModified: '2026-02-01' })],
    social: { ogTitle: 't', ogDescription: 'd', ogImage: 'i', twitterCard: 'summary' },
    hreflang: [],
    mixedContent: [],
    tableCount: 0,
    visible: { timeElements: 1, publishedMeta: null, modifiedMeta: null, authorMeta: null, relAuthor: 0 },
    ...overrides
  }
}

export function site(overrides = {}) {
  return {
    robotsTxt: 'User-agent: *\nDisallow: /admin/\n',
    robotsStatus: 200,
    llmsTxt: { status: 200, contentType: 'text/plain' },
    xRobotsTag: null,
    statusCode: 200,
    contentType: 'text/html; charset=utf-8',
    ...overrides
  }
}
