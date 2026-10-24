# Privacy policy

Crawl Cove SEO + AI Visibility Checker runs entirely inside your browser.

- It does nothing until you press its toolbar button. There is no background
  activity, no browsing history access and no content script on pages you have
  not asked it to check.
- When you press the button it reads the current page's DOM and makes up to
  three requests, all to the SAME site the page is on: `/robots.txt`,
  `/llms.txt` and a HEAD request to the page URL to read its response headers.
- Nothing is sent to Crawl Cove or to any third party. There are no analytics,
  no telemetry, no account and no identifiers.
- Results are kept in Chrome's session storage for the open tab only and are
  discarded when the tab navigates or closes.
- The "How to fix" and "Crawl the whole site" links open crawlcove.com in a new
  tab with a UTM parameter saying the visit came from the extension. That is
  an ordinary web visit, under the website's own privacy policy at
  https://crawlcove.com/legal/privacy.

The source code is public in this repository, so every claim above can be
checked. Questions: hello@crawlcove.com.
