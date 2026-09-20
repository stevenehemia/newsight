import { useState, type FormEvent } from 'react'
import logo from './assets/newsight.png'
import {
  applyFilters,
  categoryOptions,
  dateOptions,
  emptyMessage,
  hasAnyFilter,
  NO_FILTERS,
  presetOf,
  sourceOptions,
  toggle,
  type Filters,
  type Option,
  type SearchResults,
} from './filters'

export default function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  // The query that produced the current results, which may differ from what is in the box now.
  const [searched, setSearched] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  async function search(event: FormEvent) {
    event.preventDefault()
    const response = await fetch(`/api/news/search?q=${encodeURIComponent(query)}`)
    setSearched(query)
    setFilters(NO_FILTERS) // the old filters belong to the old results
    // Full error handling comes later; this only stops a failed request being reported
    // as "no articles found", which would be untrue.
    setFailed(!response.ok)
    setResults(response.ok ? await response.json() : null)
  }

  const articles = results?.articles ?? []
  const visible = applyFilters(articles, filters)
  const preset = presetOf(filters)
  const notes = results ? [...results.skipped, ...results.unavailable] : []
  const message = emptyMessage(
    { searched: searched !== null, failed, total: articles.length, visible: visible.length },
    searched ?? '',
  )

  return (
    <div className="page">
      <header className="masthead">
        <div className="brand">
          {/* Decorative: the name is right beside it, so a screen reader reading
              "Newsight logo, Newsight" would just be noise. */}
          <img className="logo" src={logo} alt="" />
          <h1>Newsight</h1>
        </div>
        <p className="tagline">Bringing news together, delivering insights faster.</p>
      </header>

      <form className="search" onSubmit={search}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search news"
          aria-label="Search news"
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
            options={sourceOptions(articles, filters)}
            selected={filters.sources}
            onToggle={(value) => setFilters({ ...filters, sources: toggle(filters.sources, value) })}
          />
          <FilterGroup
            label="Category"
            options={categoryOptions(articles, filters)}
            selected={filters.categories}
            onToggle={(value) =>
              setFilters({ ...filters, categories: toggle(filters.categories, value) })
            }
          />
          <FilterGroup
            label="Date"
            options={dateOptions(articles, filters)}
            selected={preset ? [preset.label] : []}
            onToggle={(_, id) =>
              setFilters({ ...filters, datePreset: filters.datePreset === id ? null : (id ?? null) })
            }
          />
        </section>
      )}

      {/* Caption for the results rather than another filter control, so it sits outside the panel.
          aria-live means a screen reader announces the new count when a chip is clicked; without
          it, filtering is silent. */}
      {articles.length > 0 && (
        <p className="summary" aria-live="polite">
          Showing {visible.length} of {articles.length}
          {hasAnyFilter(filters) && (
            <button type="button" className="link" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          )}
        </p>
      )}

      {message && <p className="empty">{message}</p>}

      <ul className="results">
        {visible.map((article, index) => (
          <li className="card" key={`${article.url}-${index}`}>
            <h2>
              <a href={article.url} target="_blank" rel="noreferrer">
                {article.title}
              </a>
            </h2>
            <div className="meta">
              {/* filter(Boolean) drops the fields a source does not provide, so there are never
                  two dots in a row or a trailing one. */}
              {[
                article.source,
                article.category,
                article.author,
                new Date(article.publishedAt).toLocaleDateString(),
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
            {/* Hacker News link posts have no body text, so summary is usually null. */}
            {article.summary && <p>{article.summary}</p>}
          </li>
        ))}
      </ul>

      {/* Before deploying publicly this needs two logos: NYT's, linked to developer.nytimes.com,
          and a "Powered by The Guardian" logo. Both terms require them on any page showing their
          content. */}
      <footer className="attribution">
        News from Hacker News, The New York Times and The Guardian. Headlines link to the original
        articles.
      </footer>
    </div>
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
  options: Option[]
  selected: string[]
  onToggle: (value: string, id?: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div className="filter-options">
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              // The selected look is driven by aria-pressed in CSS, so the styling and the state
              // screen readers announce cannot disagree.
              aria-pressed={isSelected}
              // Nothing left to show, and not currently selected: leave it visible but unusable.
              disabled={option.count === 0 && !isSelected}
              className="chip"
              onClick={() => onToggle(option.value, option.id)}
            >
              {option.value} ({option.count})
            </button>
          )
        })}
      </div>
    </div>
  )
}
