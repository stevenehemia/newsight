import { useState, type FormEvent } from 'react'

/** Mirrors the Article record returned by GET /api/news/search. */
type Article = {
  title: string
  source: string
  author: string | null
  summary: string | null
  url: string
  publishedAt: string
  category: string | null
}

/** A source that contributed nothing, and why. */
type SourceNote = {
  source: string
  reason: string
}

/** Mirrors the SearchResults record returned by GET /api/news/search. */
type SearchResults = {
  articles: Article[]
  skipped: SourceNote[]
  unavailable: SourceNote[]
}

/** Hacker News and GNews have no sections, so their articles are grouped under this label. */
const UNCATEGORISED = 'Uncategorised'

/**
 * Date filters are cumulative ("nothing older than this"), so only one applies at a time.
 * Options with no matching articles are hidden rather than shown as an empty choice.
 */
const DATE_PRESETS = [
  { id: 'week', label: 'Last 7 days', cutoff: () => daysAgo(7) },
  { id: 'month', label: 'Last 30 days', cutoff: () => daysAgo(30) },
  { id: 'year', label: 'This year', cutoff: () => new Date(new Date().getFullYear(), 0, 1) },
]

export default function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [sources, setSources] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [datePreset, setDatePreset] = useState<string | null>(null)

  async function search(event: FormEvent) {
    event.preventDefault()
    const response = await fetch(`/api/news/search?q=${encodeURIComponent(query)}`)
    setResults(await response.json())
    clearFilters() // the old filters belong to the old results
  }

  function clearFilters() {
    setSources([])
    setCategories([])
    setDatePreset(null)
  }

  const articles = results?.articles ?? []
  const preset = DATE_PRESETS.find((p) => p.id === datePreset)

  const matchesSource = (a: Article) => sources.length === 0 || sources.includes(a.source)
  const matchesCategory = (a: Article) =>
    categories.length === 0 || categories.includes(a.category ?? UNCATEGORISED)
  const matchesDate = (a: Article) => !preset || new Date(a.publishedAt) >= preset.cutoff()

  const visible = articles.filter((a) => matchesSource(a) && matchesCategory(a) && matchesDate(a))

  // Each facet counts what the OTHER filters allow, ignoring its own selection, so a count always
  // says how many articles picking that chip would leave. A search returns tens of articles, so
  // recounting on every render costs nothing.
  const sourceCounts = countBy(articles.filter((a) => matchesCategory(a) && matchesDate(a)), (a) => a.source)
  const categoryCounts = countBy(
    articles.filter((a) => matchesSource(a) && matchesDate(a)),
    (a) => a.category ?? UNCATEGORISED,
  )

  // Options stay listed once they exist in the unfiltered results, showing (0) rather than
  // disappearing, so the bar does not jump around as filters are ticked.
  const sourceOptions = optionsFor(articles, (a) => a.source, sourceCounts)
  const categoryOptions = optionsFor(articles, (a) => a.category ?? UNCATEGORISED, categoryCounts)
  const dateOptions = DATE_PRESETS.filter((p) =>
    articles.some((a) => new Date(a.publishedAt) >= p.cutoff()),
  ).map(
    (p) =>
      [
        p.label,
        articles.filter(
          (a) => matchesSource(a) && matchesCategory(a) && new Date(a.publishedAt) >= p.cutoff(),
        ).length,
        p.id,
      ] as const,
  )

  const filtering = sources.length > 0 || categories.length > 0 || datePreset !== null
  const notes = results ? [...results.skipped, ...results.unavailable] : []

  return (
    <main>
      <h1>Newsight</h1>

      <form onSubmit={search}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search news"
        />
        <button type="submit">Search</button>
      </form>

      {notes.length > 0 && (
        <p className="notes">
          Not included — {notes.map((note) => `${note.source}: ${note.reason}`).join(' · ')}
        </p>
      )}

      {articles.length > 0 && (
        <section className="filters">
          <FilterGroup
            label="Source"
            options={sourceOptions}
            selected={sources}
            onToggle={(value) => setSources(toggle(sources, value))}
          />
          <FilterGroup
            label="Category"
            options={categoryOptions}
            selected={categories}
            onToggle={(value) => setCategories(toggle(categories, value))}
          />
          <FilterGroup
            label="Date"
            options={dateOptions}
            selected={preset ? [preset.label] : []}
            onToggle={(_, id) => setDatePreset(datePreset === id ? null : (id ?? null))}
          />

          <p className="summary">
            Showing {visible.length} of {articles.length}
            {filtering && (
              <button type="button" className="link" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </p>
        </section>
      )}

      {articles.length > 0 && visible.length === 0 && (
        <p className="empty">No articles match these filters.</p>
      )}

      <ul>
        {visible.map((article, index) => (
          <li key={`${article.url}-${index}`}>
            <a href={article.url} target="_blank" rel="noreferrer">
              {article.title}
            </a>
            <div className="meta">
              {article.source}
              {article.category && ` · ${article.category}`}
              {article.author && ` · ${article.author}`}
              {` · ${new Date(article.publishedAt).toLocaleDateString()}`}
            </div>
            {/* Hacker News link posts have no body text, so summary is usually null. */}
            {article.summary && <p>{article.summary}</p>}
          </li>
        ))}
      </ul>
    </main>
  )
}

/** One row of the filter bar: a label and a set of toggleable chips with counts. */
function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: (readonly [string, number] | readonly [string, number, string])[]
  selected: string[]
  onToggle: (value: string, id?: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      {options.map(([value, count, id]) => {
        const isSelected = selected.includes(value)
        return (
          <button
            key={value}
            type="button"
            // Nothing left to show, and not currently selected: leave it visible but unusable.
            disabled={count === 0 && !isSelected}
            className={isSelected ? 'chip chip-on' : 'chip'}
            onClick={() => onToggle(value, id)}
          >
            {value} ({count})
          </button>
        )
      })}
    </div>
  )
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/** Every value present in the unfiltered results, paired with its cross-filtered count. */
function optionsFor(
  articles: Article[],
  key: (article: Article) => string,
  counts: Record<string, number>,
) {
  return Object.keys(countBy(articles, key)).map((value) => [value, counts[value] ?? 0] as const)
}

function countBy(articles: Article[], key: (article: Article) => string) {
  const counts: Record<string, number> = {}
  for (const article of articles) {
    counts[key(article)] = (counts[key(article)] ?? 0) + 1
  }
  return counts
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}
