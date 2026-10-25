// Structured data inspector: which schema.org types the page declares and
// which required or recommended properties Google's rich result docs list
// are missing. Pure; the node collection comes from jsonld.js.
import { nodesFromBlocks, typesOf } from './jsonld.js'

export const SCHEMA_RULES = Object.freeze({
  Article: { required: ['headline', 'image', 'datePublished'], recommended: ['author', 'dateModified', 'publisher'] },
  BlogPosting: { required: ['headline', 'image', 'datePublished'], recommended: ['author', 'dateModified', 'publisher'] },
  NewsArticle: { required: ['headline', 'image', 'datePublished'], recommended: ['author', 'dateModified', 'publisher'] },
  TechArticle: { required: ['headline', 'image', 'datePublished'], recommended: ['author', 'dateModified'] },
  Product: { required: ['name'], recommended: ['image', 'description', 'offers', 'aggregateRating', 'review', 'brand', 'sku'] },
  Offer: { required: ['price', 'priceCurrency'], recommended: ['availability', 'url'] },
  FAQPage: { required: ['mainEntity'], recommended: [] },
  Question: { required: ['name', 'acceptedAnswer'], recommended: [] },
  HowTo: { required: ['name', 'step'], recommended: ['image', 'totalTime'] },
  Organization: { required: ['name', 'url'], recommended: ['logo', 'sameAs', 'contactPoint'] },
  LocalBusiness: { required: ['name', 'address'], recommended: ['telephone', 'openingHoursSpecification', 'geo', 'image', 'url'] },
  BreadcrumbList: { required: ['itemListElement'], recommended: [] },
  WebSite: { required: ['name', 'url'], recommended: ['potentialAction'] },
  WebPage: { required: [], recommended: ['name', 'description'] },
  Person: { required: ['name'], recommended: ['url', 'sameAs', 'jobTitle'] },
  Event: { required: ['name', 'startDate', 'location'], recommended: ['endDate', 'image', 'offers', 'organizer'] },
  JobPosting: { required: ['title', 'description', 'datePosted', 'hiringOrganization', 'jobLocation'], recommended: ['baseSalary', 'validThrough', 'employmentType'] },
  Recipe: { required: ['name', 'image'], recommended: ['author', 'datePublished', 'description', 'recipeIngredient', 'recipeInstructions'] },
  VideoObject: { required: ['name', 'thumbnailUrl', 'uploadDate'], recommended: ['description', 'duration', 'contentUrl'] },
  SoftwareApplication: { required: ['name', 'offers', 'applicationCategory', 'operatingSystem'], recommended: ['aggregateRating', 'screenshot'] },
  Review: { required: ['itemReviewed', 'author', 'reviewRating'], recommended: ['datePublished'] },
  AggregateRating: { required: ['ratingValue', 'ratingCount'], recommended: ['bestRating'] },
  Course: { required: ['name', 'description', 'provider'], recommended: [] }
})

function has(node, key) {
  const v = node[key]
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}

function label(node) {
  for (const k of ['name', 'headline', 'title']) if (typeof node[k] === 'string' && node[k].trim()) return node[k].trim().slice(0, 80)
  return null
}

/** @returns {{ blocks:number, invalid:number, items:{type:string, label:string|null, missingRequired:string[], missingRecommended:string[], known:boolean}[], richResultTypes:string[] }} */
export function inspectSchema(blocks) {
  const { nodes, invalid } = nodesFromBlocks(blocks ?? [])
  const items = []
  const seen = new Set()
  const walk = (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || seen.has(node)) return
    seen.add(node)
    const types = typesOf(node)
    for (const type of types) {
      const rule = SCHEMA_RULES[type]
      items.push({
        type,
        label: label(node),
        known: rule !== undefined,
        missingRequired: rule ? rule.required.filter((k) => !has(node, k)) : [],
        missingRecommended: rule ? rule.recommended.filter((k) => !has(node, k)) : []
      })
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') walk(v)
    }
  }
  nodes.forEach(walk)
  const RICH = new Set(['Article', 'BlogPosting', 'NewsArticle', 'Product', 'FAQPage', 'HowTo', 'BreadcrumbList', 'Event', 'JobPosting', 'Recipe', 'VideoObject', 'SoftwareApplication', 'LocalBusiness', 'Organization', 'Review', 'Course'])
  return {
    blocks: (blocks ?? []).length,
    invalid: invalid.length,
    items,
    richResultTypes: [...new Set(items.filter((i) => RICH.has(i.type)).map((i) => i.type))]
  }
}
