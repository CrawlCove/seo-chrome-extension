// AI extractability score, ported from the Crawl Cove desktop app
// (src/shared/seo/extractability.ts, formula 1.0.0). Same weights, same
// thresholds, so the number in the popup is the number the full crawl shows.
//
// It approximates how easily an AI answer engine (ChatGPT, Perplexity, Google
// AI Overviews, Claude) can lift a self-contained answer from the page. It is
// not a ranking score.

export const EXTRACTABILITY_VERSION = '1.0.0'
export const EXTRACTABILITY_WEIGHTS = Object.freeze({
  answerFirst: 25,
  answerBlocks: 25,
  comparisonTable: 15,
  faqSchema: 20,
  visibleDateAuthor: 15
})
export const EXTRACTABILITY_FLAG_THRESHOLD = 50

const ANSWER_FIRST_MIN_WORDS = 20
const ANSWER_FIRST_MAX_WORDS_WITHOUT_HEADINGS = 250
export const QUESTION_RE = /\?\s*$|^\s*(how|what|why|when|where|who|which|can|do|does|is|are|should)\b/i

function isAnswerFirst(s) {
  const words = s.wordCount ?? 0
  if (words < ANSWER_FIRST_MIN_WORDS) return false
  if (!s.headings.some((h) => h.level === 1 && h.text.trim() !== '')) return false
  const hasSub = s.headings.some((h) => h.level >= 2)
  if (words > ANSWER_FIRST_MAX_WORDS_WITHOUT_HEADINGS && !hasSub) return false
  return true
}

function hasAnswerBlocks(s) {
  if (s.hasFaqSchema) return true
  return s.headings.filter((h) => h.level >= 2 && h.level <= 3 && QUESTION_RE.test(h.text)).length >= 2
}

/**
 * @param {{headings:{level:number,text:string}[], wordCount:number|null,
 *   hasComparisonTable:boolean, hasFaqSchema:boolean, hasVisibleDateAuthor:boolean}} signals
 */
export function scoreExtractability(signals) {
  const subScores = {
    answerFirst: isAnswerFirst(signals),
    answerBlocks: hasAnswerBlocks(signals),
    comparisonTable: signals.hasComparisonTable === true,
    faqSchema: signals.hasFaqSchema === true,
    visibleDateAuthor: signals.hasVisibleDateAuthor === true
  }
  let raw = 0
  for (const k of Object.keys(EXTRACTABILITY_WEIGHTS)) if (subScores[k]) raw += EXTRACTABILITY_WEIGHTS[k]
  return { score: Math.max(0, Math.min(100, Math.round(raw))), subScores }
}

export const SUB_SCORE_LABEL = Object.freeze({
  answerFirst: 'Leads with an answer',
  answerBlocks: 'Question-shaped sections',
  comparisonTable: 'Table in structured data',
  faqSchema: 'FAQ structured data',
  visibleDateAuthor: 'Article date and author in structured data'
})
