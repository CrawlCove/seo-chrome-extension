// JSON-LD helpers shared by the AI checks (same shape as the desktop app's).

export function parseJsonLd(raw) {
  try { return JSON.parse(raw) } catch { return null }
}

/** Every node from a parsed value, descending arrays and @graph. */
export function collectNodes(value, out = []) {
  if (value === null || typeof value !== 'object') return out
  if (Array.isArray(value)) { for (const v of value) collectNodes(v, out); return out }
  out.push(value)
  if (Array.isArray(value['@graph'])) collectNodes(value['@graph'], out)
  return out
}

/** All nodes across all raw blocks, plus which blocks failed to parse. */
export function nodesFromBlocks(blocks) {
  const nodes = []
  const invalid = []
  blocks.forEach((raw, i) => {
    if (typeof raw !== 'string' || raw.trim() === '') return
    const parsed = parseJsonLd(raw)
    if (parsed === null) invalid.push(i)
    else collectNodes(parsed, nodes)
  })
  return { nodes, invalid }
}

export function typesOf(node) {
  const t = node['@type']
  if (typeof t === 'string') return [t.replace(/^.*[/#]/, '')]
  if (Array.isArray(t)) return t.filter((x) => typeof x === 'string').map((x) => x.replace(/^.*[/#]/, ''))
  return []
}

export const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'ScholarlyArticle', 'Report'])
export const ENTITY_TYPES = new Set(['Organization', 'Corporation', 'LocalBusiness', 'OnlineBusiness', 'NGO', 'GovernmentOrganization', 'EducationalOrganization', 'Person'])

export function hasType(nodes, set) {
  return nodes.some((n) => typesOf(n).some((t) => set.has(t)))
}

export function hasStringValue(node, key) {
  const v = node[key]
  return typeof v === 'string' && v.trim() !== ''
}

/** An author object carries an identity link when url/sameAs/@id is non-empty. */
export function authorHasIdentity(author) {
  if (!author || typeof author !== 'object') return false
  return ['url', 'sameAs', '@id'].some((k) => {
    const v = author[k]
    if (typeof v === 'string') return v.trim() !== ''
    if (Array.isArray(v)) return v.some((x) => typeof x === 'string' && x.trim() !== '')
    return false
  })
}
