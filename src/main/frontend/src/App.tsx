import { useState, type FormEvent } from 'react'
import {
  applyFilters,
  categoryOptions,
  dateOptions,
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

  async function search(event: FormEvent) {
    event.preventDefault()
    const response = await fetch(`/api/news/search?q=${encodeURIComponent(query)}`)
    setResults(await response.json())
    setFilters(NO_FILTERS) // the old filters belong to the old results
  }

  const articles = results?.articles ?? []
  const visible = applyFilters(articles, filters)
  const preset = presetOf(filters)
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

          <p className="summary">
            Showing {visible.length} of {articles.length}
            {hasAnyFilter(filters) && (
              <button type="button" className="link" onClick={() => setFilters(NO_FILTERS)}>
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
  options: Option[]
  selected: string[]
  onToggle: (value: string, id?: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      {options.map((option) => {
        const isSelected = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            // Nothing left to show, and not currently selected: leave it visible but unusable.
            disabled={option.count === 0 && !isSelected}
            className={isSelected ? 'chip chip-on' : 'chip'}
            onClick={() => onToggle(option.value, option.id)}
          >
            {option.value} ({option.count})
          </button>
        )
      })}
    </div>
  )
}
