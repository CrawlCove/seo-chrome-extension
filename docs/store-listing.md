# Chrome Web Store listing (draft for Bloo)

Publishing needs a Chrome Web Store developer account (one-off $5 registration,
Google account) and a human to upload `dist/seo-chrome-extension.zip` from
`npm run pack`. Agents cannot create accounts or spend, so this is Bloo's step.

**Name (45 chars max):** Crawl Cove SEO + AI Visibility Checker

**Summary (132 chars max):**
On-page SEO check plus AI visibility: which AI crawlers can read the page, snippet blocks, llms.txt and an extractability score.

**Category:** Developer Tools (secondary: Productivity)

**Description:**

Every SEO extension shows you the title, the metas, the headings and the links.
This one also tells you whether AI answer engines can read and quote the page.

AI ANSWER VISIBILITY
- Extractability score, 0 to 100: can ChatGPT, Perplexity, Claude or Google AI
  Mode lift a clean answer from this page?
- 23 AI crawlers, allowed or blocked, read from robots.txt with this page's
  path applied. Grouped by purpose so you know which blocks cost citations and
  which are a deliberate training opt-out.
- Snippet blocks (nosnippet, max-snippet:0) in the meta tags or the
  X-Robots-Tag header that silently remove the page from AI Overviews.
- llms.txt present or missing.

ON-PAGE SEO
Title and description lengths, canonical, noindex, H1 and heading order,
language and viewport, Open Graph, structured data validity, thin content,
hreflang, mixed content, image alt, lazy-loaded hero image, nofollow and vague
internal links. Every finding has the evidence and a how-to-fix link.

EXPORT
Copy a Markdown report for a ticket or client email, or download JSON in the
open Crawl Cove export format.

PRIVATE BY DESIGN
No account. No analytics. Nothing leaves your browser: the only requests are
to the site you are already on (robots.txt, llms.txt, the page's headers).
Open source: github.com/CrawlCove/seo-chrome-extension

The same checks, under the same names, as the Crawl Cove desktop crawler, so
when one page looks wrong you can crawl the whole site and see every page that
shares the problem.

**Permissions justification (Store form):**
- activeTab: read the page you pressed the button on; no access to other tabs.
- scripting: inject the read-only snapshot script into that page on click.
- storage: keep the result for the open tab in session storage so reopening
  the popup is instant; cleared on navigation.
- No host permissions are requested.

**Single purpose:** audit the current page for SEO and AI answer visibility.

**Privacy policy URL:** https://github.com/CrawlCove/seo-chrome-extension/blob/main/PRIVACY.md
(or a crawlcove.com page once the open-source page exists)

**Screenshots (1280x800 or 640x400):** take from docs/screenshots after a run
on a real site, or capture the popup on crawlcove.com. Suggested five:
1. AI answer visibility panel with a mid score and one blocked crawler.
2. Findings tab on a page with a nosnippet block.
3. Page tab (facts + heading outline).
4. Export tab with the Markdown report pasted next to it.
5. The crawlers grid expanded (search, user, training).

**Promo tile copy (440x280):** "Can AI quote this page?"
