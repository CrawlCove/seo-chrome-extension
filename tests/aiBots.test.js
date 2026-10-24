import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AI_BOTS, parseRobotsGroups, botBlockedAtRoot, botAccess, pathAllowedFor } from '../lib/aiBots.js'

test('registry has 23 crawlers across three purposes', () => {
  assert.equal(AI_BOTS.length, 23)
  assert.equal(AI_BOTS.filter((b) => b.purpose === 'search').length, 7)
  assert.equal(new Set(AI_BOTS.map((b) => b.token)).size, 23)
})

test('consecutive User-agent lines share one group; a rule line closes it', () => {
  const g = parseRobotsGroups('User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n')
  assert.equal(g.length, 2)
  assert.deepEqual(g[0].userAgents, ['gptbot', 'claudebot'])
  assert.ok(botBlockedAtRoot(g, 'GPTBot'))
  assert.ok(botBlockedAtRoot(g, 'ClaudeBot'))
  assert.ok(!botBlockedAtRoot(g, 'OAI-SearchBot'))
})

test('a bot-specific group wins over the wildcard', () => {
  const g = parseRobotsGroups('User-agent: *\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow:\n')
  assert.ok(botBlockedAtRoot(g, 'GPTBot'))
  assert.ok(!botBlockedAtRoot(g, 'PerplexityBot'))
})

test('Allow: / in the same group cancels Disallow: /', () => {
  const g = parseRobotsGroups('User-agent: *\nDisallow: /\nAllow: /\n')
  assert.ok(!botBlockedAtRoot(g, 'GPTBot'))
})

test('path rules use longest match and honour wildcards', () => {
  const g = parseRobotsGroups('User-agent: *\nDisallow: /private/\nAllow: /private/public-*\nDisallow: /*.pdf$\n')
  assert.ok(pathAllowedFor(g, 'GPTBot', '/blog/post'))
  assert.ok(!pathAllowedFor(g, 'GPTBot', '/private/x'))
  assert.ok(pathAllowedFor(g, 'GPTBot', '/private/public-page'))
  assert.ok(!pathAllowedFor(g, 'GPTBot', '/files/a.pdf'))
  assert.ok(pathAllowedFor(g, 'GPTBot', '/files/a.pdfx'))
})

test('botAccess marks root, path and wildcard blocks', () => {
  const a = botAccess('User-agent: *\nDisallow: /docs/\n\nUser-agent: OAI-SearchBot\nDisallow: /\n', '/docs/page')
  const oai = a.find((b) => b.token === 'OAI-SearchBot')
  const ppl = a.find((b) => b.token === 'PerplexityBot')
  assert.equal(oai.rootBlocked, true)
  assert.equal(oai.viaWildcard, false)
  assert.equal(ppl.rootBlocked, false)
  assert.equal(ppl.pathBlocked, true)
  assert.equal(ppl.viaWildcard, true)
  assert.equal(ppl.allowed, false)
})

test('no robots.txt means every crawler is allowed', () => {
  assert.ok(botAccess(null, '/').every((b) => b.allowed))
})
