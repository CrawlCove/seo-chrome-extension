// The badge shows the last AI visibility score for a tab. A navigation makes
// that number stale, so clear it as soon as the tab starts loading again.
// Nothing else runs in the background: the extension does no work until the
// toolbar button is pressed, and it never phones home.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {})
    chrome.storage.session.remove(String(tabId)).catch(() => {})
  }
})
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(String(tabId)).catch(() => {})
})
