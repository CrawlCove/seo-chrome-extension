# Chrome Web Store listing (draft for Bloo)

Publishing needs a Chrome Web Store developer account (one-off $5 registration,
Google account) and a human to upload `dist/seo-chrome-extension.zip` from
`npm run pack`. Agents cannot create accounts or spend, so this is Bloo's step.

**Name (45 chars max):** Crawl Cove SEO Checker + AI Visibility

**Summary (132 chars max):**
On-page SEO checker with an AI visibility report: metas, headings, schema, links, vitals, keyword, which AI crawlers can read it.

**Keywords:** the Store rejected 1.1.0 on 11 Nov 2026 for keyword spam
(Yellow Argon), quoting the list of tool names in the old description. Keep the
description in sentences: no lists of brands, tools or search terms, and no AI
product names.

**Category:** Developer Tools (secondary: Productivity)

**Description:**

Check the page you are on for SEO problems, and see whether AI answer engines can read and quote it.

AI ANSWER VISIBILITY
The extractability score, from 0 to 100, estimates how cleanly an AI answer engine can lift an answer from the page. The extension reads the site's robots.txt for this exact path and shows which of 23 known AI crawlers are allowed or blocked, grouped by purpose, so you can tell a block that costs citations from a deliberate training opt-out. It also flags snippet controls that hide the page from AI summaries, and tells you whether the site has an llms.txt file.

ON-PAGE SEO CHECKS
The checks cover the title and meta description with a search result preview, canonical and indexing tags, heading order, structured data, thin content, image alt text and internal links. Each finding shows the evidence from the page and links to how to fix it.

FOCUS KEYWORD
Type a keyword to see where it appears on the page and whether it is overused.

SCHEMA, LINKS, IMAGES AND SPEED
See every structured data block with any missing required properties, export the page's links and images as CSV, and read load timings measured from the page you have open.

HIGHLIGHT AND EXPORT
Highlight elements on the page, open common testing tools for the current URL in one click, and copy a Markdown report or download JSON. Keyboard shortcut: Alt+Shift+C.

PRIVATE BY DESIGN
No account and no analytics. The extension only requests files from the site you are already viewing, and the source code is public on GitHub.

The checks use the same names as the Crawl Cove desktop crawler, so when one page has a problem you can crawl the whole site and find every page that shares it.

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
