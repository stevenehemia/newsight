/**
 * Filtering for the results already on screen. Nothing here calls the API: filters narrow the
 * articles a search returned.
 *
 * <p>Kept apart from App.tsx so it can be tested as plain functions, and so `now` can be passed in
 * rather than read from the clock, which would make date tests depend on when they run.
 */

/** Mirrors the Article record returned by GET /api/news/search. */
export type Article = {
  title: string
  source: string
  author: string | null
  summary: string | null
  url: string
  publishedAt: string
  category: string | null
}

/** A source that contributed nothing, and why. */
export type SourceNote = {
  source: string
  reason: string
}

/** Mirrors the SearchResults record returned by GET /api/news/search. */
export type SearchResults = {
  articles: Article[]
  skipped: SourceNote[]
  unavailable: SourceNote[]
}

/** Hacker News and GNews have no sections, so their articles group under this label. */
export const UNCATEGORISED = 'Uncategorised'

export type DatePreset = { id: string; label: string; cutoff: (now: Date) => Date }

/** Cumulative ("nothing older than this"), so only one applies at a time. */
export const DATE_PRESETS: DatePreset[] = [
  { id: 'week', label: 'Last 7 days', cutoff: (now) => daysBefore(now, 7) },
  { id: 'month', label: 'Last 30 days', cutoff: (now) => daysBefore(now, 30) },
  { id: 'year', label: 'This year', cutoff: (now) => new Date(now.getFullYear(), 0, 1) },
]

export type Filters = {
  sources: string[]
  categories: string[]
  datePreset: string | null
}

export const NO_FILTERS: Filters = { sources: [], categories: [], datePreset: null }

/** One chip: its label, how many articles it would leave, and (for dates) which preset it is. */
export type Option = { value: string; count: number; id?: string }

export function categoryOf(article: Article): string {
  return article.category ?? UNCATEGORISED
}

export function hasAnyFilter(filters: Filters): boolean {
  return filters.sources.length > 0 || filters.categories.length > 0 || filters.datePreset !== null
}

export function presetOf(filters: Filters): DatePreset | undefined {
  return DATE_PRESETS.find((preset) => preset.id === filters.datePreset)
}

export function applyFilters(articles: Article[], filters: Filters, now = new Date()): Article[] {
  return articles.filter(
    (article) =>
      matchesSource(article, filters) &&
      matchesCategory(article, filters) &&
      matchesDate(article, filters, now),
  )
}

/**
 * Counts for one facet are taken over the articles the OTHER facets allow, ignoring this facet's
 * own selection. So a count always says how many articles picking that chip would leave, and
 * picking a second value within the same facet widens rather than narrows.
 */
/** Alphabetical: a handful of stable names, so predictable beats ranked. */
export function sourceOptions(articles: Article[], filters: Filters, now = new Date()): Option[] {
  const allowed = articles.filter(
    (article) => matchesCategory(article, filters) && matchesDate(article, filters, now),
  )
  return optionsFor(articles, allowed, (article) => article.source).sort((a, b) =>
    a.value.localeCompare(b.value),
  )
}

/**
 * Busiest first, ties broken alphabetically, except that "Uncategorised" always comes last however
 * many articles it holds: it is the absence of a topic, not a topic, and neither Hacker News nor
 * GNews has sections at all — so ranking it by size would park the least informative chip in front
 * of every real one.
 */
export function categoryOptions(articles: Article[], filters: Filters, now = new Date()): Option[] {
  const allowed = articles.filter(
    (article) => matchesSource(article, filters) && matchesDate(article, filters, now),
  )
  return optionsFor(articles, allowed, categoryOf).sort((a, b) => {
    if (a.value === UNCATEGORISED) return 1
    if (b.value === UNCATEGORISED) return -1
    return b.count - a.count || a.value.localeCompare(b.value)
  })
}

/**
 * No date filter already means all time, so there is no chip for it: clicking the active preset
 * switches it off. Presets matching nothing at all are left out; the rest can still show 0.
 */
export function dateOptions(articles: Article[], filters: Filters, now = new Date()): Option[] {
  const allowed = articles.filter(
    (article) => matchesSource(article, filters) && matchesCategory(article, filters),
  )
  return DATE_PRESETS.filter((preset) =>
    articles.some((article) => isOnOrAfter(article, preset.cutoff(now))),
  ).map((preset) => ({
    value: preset.label,
    id: preset.id,
    count: allowed.filter((article) => isOnOrAfter(article, preset.cutoff(now))).length,
  }))
}

/**
 * Why a search produced nothing, when the cause was not the search itself. Kept apart from the
 * HTTP status so the message logic reads as intent rather than numbers.
 */
export type Failure = 'invalid-query' | 'sources-unavailable' | 'network' | 'unknown'

/** Maps a response status onto what the user needs to be told. */
export function failureFor(status: number): Failure {
  if (status === 400) return 'invalid-query'
  if (status === 503) return 'sources-unavailable'
  return 'unknown'
}

/** What the results area should say when it has no articles to show. */
export type SearchState = {
  /** False before the first search, when the page should stay quiet. */
  searched: boolean
  /** A request is in flight. */
  loading: boolean
  /** Null when the request itself was fine, whatever it returned. */
  failure: Failure | null
  /** Articles the search returned, before filtering. */
  total: number
  /** Articles left after filtering. */
  visible: number
}

const FAILURE_MESSAGES: Record<Failure, string> = {
  // The UI blocks blank searches, so a 400 means something we did not anticipate rather than an
  // empty box — hence "try different words" rather than "type something".
  'invalid-query': 'That search could not be read. Try different words.',
  // Every source failed. Worth saying so plainly: it is temporary and not the user's doing.
  'sources-unavailable': 'No news sources are responding right now. Please try again shortly.',
  // fetch threw, so the request never got an answer: the server, the network or the browser.
  network: 'Could not reach Newsight. Check your connection and try again.',
  unknown: 'Something went wrong. Please try again.',
}

export function emptyMessage(state: SearchState, query: string): string | null {
  // First, so a slow search cannot briefly flash the previous search's "nothing found".
  if (state.loading) return 'Searching…'
  if (!state.searched) return null
  if (state.failure) return FAILURE_MESSAGES[state.failure]
  if (state.total === 0) return `No articles found for “${query}”.`
  if (state.visible === 0) return 'No articles match these filters.'
  return null
}

export function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function matchesSource(article: Article, filters: Filters): boolean {
  return filters.sources.length === 0 || filters.sources.includes(article.source)
}

function matchesCategory(article: Article, filters: Filters): boolean {
  return filters.categories.length === 0 || filters.categories.includes(categoryOf(article))
}

function matchesDate(article: Article, filters: Filters, now: Date): boolean {
  const preset = presetOf(filters)
  return !preset || isOnOrAfter(article, preset.cutoff(now))
}

function isOnOrAfter(article: Article, cutoff: Date): boolean {
  return new Date(article.publishedAt) >= cutoff
}

/** Every value present in the unfiltered results, counted against what the other facets allow. */
function optionsFor(
  articles: Article[],
  allowed: Article[],
  key: (article: Article) => string,
): Option[] {
  const counts = countBy(allowed, key)
  return Object.keys(countBy(articles, key)).map((value) => ({
    value,
    count: counts[value] ?? 0,
  }))
}

function countBy(articles: Article[], key: (article: Article) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const article of articles) {
    counts[key(article)] = (counts[key(article)] ?? 0) + 1
  }
  return counts
}

function daysBefore(now: Date, days: number): Date {
  const date = new Date(now)
  date.setDate(date.getDate() - days)
  return date
}
