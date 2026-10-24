// The AI crawler registry and robots.txt reading, ported from the Crawl Cove
// desktop app's ai-bot-access check (v1.2.0). Keep the two in step: the token
// list is what decides which answer engines the extension says can read a page.

/** @typedef {'search'|'user'|'training'} AiBotPurpose */

export const AI_BOTS = Object.freeze([
  { token: 'OAI-SearchBot', operator: 'OpenAI', purpose: 'search', surface: 'ChatGPT search answers' },
  { token: 'Claude-SearchBot', operator: 'Anthropic', purpose: 'search', surface: 'Claude answers' },
  { token: 'PerplexityBot', operator: 'Perplexity', purpose: 'search', surface: 'Perplexity answers' },
  { token: 'DuckAssistBot', operator: 'DuckDuckGo', purpose: 'search', surface: 'DuckDuckGo AI answers' },
  { token: 'MistralAI-Index', operator: 'Mistral AI', purpose: 'search', surface: 'Le Chat search answers' },
  { token: 'YouBot', operator: 'You.com', purpose: 'search', surface: 'You.com AI search' },
  { token: 'Amzn-SearchBot', operator: 'Amazon', purpose: 'search', surface: 'Amazon search experiences such as Alexa' },
  { token: 'ChatGPT-User', operator: 'OpenAI', purpose: 'user', surface: 'ChatGPT' },
  { token: 'Claude-User', operator: 'Anthropic', purpose: 'user', surface: 'Claude' },
  { token: 'Perplexity-User', operator: 'Perplexity', purpose: 'user', surface: 'Perplexity' },
  { token: 'Meta-ExternalFetcher', operator: 'Meta', purpose: 'user', surface: 'Meta AI' },
  { token: 'MistralAI-User', operator: 'Mistral AI', purpose: 'user', surface: 'Le Chat' },
  { token: 'Amzn-User', operator: 'Amazon', purpose: 'user', surface: 'Alexa' },
  { token: 'GPTBot', operator: 'OpenAI', purpose: 'training', surface: 'OpenAI model training' },
  { token: 'ClaudeBot', operator: 'Anthropic', purpose: 'training', surface: 'Claude model training' },
  { token: 'anthropic-ai', operator: 'Anthropic', purpose: 'training', surface: 'Claude model training (legacy token)' },
  { token: 'Google-Extended', operator: 'Google', purpose: 'training', surface: 'Gemini training and grounding' },
  { token: 'Applebot-Extended', operator: 'Apple', purpose: 'training', surface: 'Apple Intelligence training' },
  { token: 'Meta-ExternalAgent', operator: 'Meta', purpose: 'training', surface: 'Meta AI / Llama training' },
  { token: 'Amazonbot', operator: 'Amazon', purpose: 'training', surface: 'Amazon AI model training' },
  { token: 'Bytespider', operator: 'ByteDance', purpose: 'training', surface: 'ByteDance AI training' },
  { token: 'CCBot', operator: 'Common Crawl', purpose: 'training', surface: 'the Common Crawl dataset' },
  { token: 'MistralAI-Training', operator: 'Mistral AI', purpose: 'training', surface: 'Mistral model training' }
])

/** Severity of a root block, by what the crawler is for. */
export const SEVERITY_BY_PURPOSE = Object.freeze({ search: 'medium', user: 'low', training: 'info' })

export const PURPOSE_LABEL = Object.freeze({
  search: 'AI search crawlers (decide whether you get cited)',
  user: 'User-triggered fetchers (open a page when someone asks about it)',
  training: 'Model-training crawlers (opting out is a choice, not a problem)'
})

/**
 * Parse robots.txt into groups: user-agents + their Allow/Disallow rules.
 * A User-agent line after a rule line starts a new group; consecutive
 * User-agent lines share one group.
 */
export function parseRobotsGroups(body) {
  const groups = []
  let current = null
  let lastLineWasRule = false
  for (const rawLine of String(body ?? '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (line === '') continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const field = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (field === 'user-agent') {
      if (current === null || lastLineWasRule) {
        current = { userAgents: [], disallow: [], allow: [] }
        groups.push(current)
      }
      current.userAgents.push(value.toLowerCase())
      lastLineWasRule = false
    } else if (field === 'disallow') {
      if (current === null) continue
      current.disallow.push(value)
      lastLineWasRule = true
    } else if (field === 'allow') {
      if (current === null) continue
      current.allow.push(value)
      lastLineWasRule = true
    } else {
      lastLineWasRule = true
    }
  }
  return groups
}

/** The group that applies to `token`: a bot-specific group wins over '*'. */
export function groupForBot(groups, token) {
  const lower = token.toLowerCase()
  let wildcard = null
  for (const g of groups) {
    if (g.userAgents.includes(lower)) return g
    if (g.userAgents.includes('*') && wildcard === null) wildcard = g
  }
  return wildcard
}

/** `Disallow: /` with no `Allow: /` in the same group. */
export function blocksRoot(group) {
  if (!group.disallow.some((d) => d.trim() === '/')) return false
  return !group.allow.some((a) => a.trim() === '/')
}

export function botBlockedAtRoot(groups, token) {
  const group = groupForBot(groups, token)
  return group !== null && blocksRoot(group)
}

/**
 * Longest-match path test for ONE bot against the current page path, the way
 * Google's robots parser does it (longest matching rule wins, Allow beats
 * Disallow on a tie). `*` and `$` in patterns are honoured.
 */
export function pathAllowedFor(groups, token, pathname) {
  const group = groupForBot(groups, token)
  if (group === null) return true
  const score = (pattern) => {
    const p = pattern.trim()
    if (p === '') return -1
    const re = new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$'))
    return re.test(pathname) ? p.length : -1
  }
  const bestAllow = Math.max(-1, ...group.allow.map(score))
  const bestDisallow = Math.max(-1, ...group.disallow.map(score))
  if (bestDisallow === -1) return true
  return bestAllow >= bestDisallow
}

/**
 * Per-bot access for the page: blocked at the site root, blocked for this
 * path only, or allowed. `robotsBody` null means robots.txt was unreachable,
 * which counts as allowed for every bot (no file, no rules).
 */
export function botAccess(robotsBody, pathname) {
  const groups = robotsBody === null ? [] : parseRobotsGroups(robotsBody)
  return AI_BOTS.map((bot) => {
    const group = groupForBot(groups, bot.token)
    const rootBlocked = group !== null && blocksRoot(group)
    const pathBlocked = !rootBlocked && !pathAllowedFor(groups, bot.token, pathname)
    const viaWildcard = group !== null && !group.userAgents.includes(bot.token.toLowerCase())
    return { ...bot, rootBlocked, pathBlocked, viaWildcard, allowed: !rootBlocked && !pathBlocked }
  })
}
