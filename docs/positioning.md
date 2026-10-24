# Why this extension stands out, and how to market it

## The field

The SEO extensions people actually install (Detailed SEO Extension, SEO META in
1 CLICK, SEOquake, META SEO inspector, Ahrefs SEO Toolbar, MozBar) all do the
same job: show title, metas, headings, links, images, schema, sometimes a
third-party authority metric that needs an account. None of them answers the
question SEOs are being asked in 2026: "will ChatGPT, Perplexity or AI
Overviews cite this page?"

## The wedge

1. **AI answer visibility, on the page you are looking at.** 23 named AI
   crawlers, allowed or blocked, graded by what each one is for. Snippet
   blocks that silently remove pages from AI Overviews. llms.txt. An
   extractability score with the five signals spelled out. Nobody in the
   Store does this today, so the first screenshot and the first sentence of
   the listing are this, not "view meta tags".
2. **Same checks as the desktop crawler.** The extension is a one-page
   preview under the same ids, names and severities. That makes the upsell
   literal: "this page has it, how many of your other pages do?" One button
   goes to the full crawl.
3. **Private and open.** No account, no analytics, no host permissions, the
   only requests are to the site you are on, and the source is public. The
   big-brand toolbars require logins and send browsing data. Reviewers and
   agencies notice.
4. **Exports in an open format.** Markdown for a client note; JSON that the
   Sheets importer, JS library and MCP server already read.

## Launch plan (suggested order)

- Store listing (Bloo: developer account, upload the zip from `npm run pack`,
  copy in docs/store-listing.md).
- Page on crawlcove.com: /open-source/crawlcove-chrome-extension, plus a
  "Can AI quote this page? Check in one click" post targeting
  "seo chrome extension" and "ai visibility checker chrome extension".
- Product Hunt style launch is cheap here because the hook is one sentence:
  "The first SEO extension that tells you whether AI can quote your page."
- Comparison section on the listing page: one table, us vs the five
  incumbents, rows = AI crawler access, snippet block detection, llms.txt,
  extractability, privacy, open source, price.
- Add the extension to the Related tools footer of every CrawlCove repo and
  to the /open-source index.

## What to measure

Store installs and weekly users (Store dashboard), clicks on the
utm_medium=seo-chrome-extension links in GA4, and whether /download visits
with that medium convert to trials. Under 30 of anything is a rumour.
