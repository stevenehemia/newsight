import { useRef, useState, type FormEvent } from 'react'
import logo from './assets/newsight.png'
import guardianLogo from './assets/powered-by-guardian.png'
import nytLogo from './assets/powered-by-nytimes.png'
import {
  applyFilters,
  categoryOptions,
  dateOptions,
  emptyMessage,
  failureFor,
  hasAnyFilter,
  NO_FILTERS,
  presetOf,
  sourceOptions,
  toggle,
  type Failure,
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
  const [failure, setFailure] = useState<Failure | null>(null)
  const [loading, setLoading] = useState(false)
  const inFlight = useRef<AbortController | null>(null)

  // Whitespace only is not a search. The backend rejects it with a 400, but the user should never
  // get that far: a rejection reads like a fault, when the answer is just "type something".
  const trimmed = query.trim()
  const canSearch = trimmed.length > 0

  async function search(event: FormEvent) {
    event.preventDefault()
    if (!canSearch) return // belt and braces; the button is disabled too
    // Drop any search still in flight: without this, a slow first response can arrive after a
    // faster second one and overwrite it with results for a query the user has moved on from.
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    setSearched(trimmed)
    setFilters(NO_FILTERS) // the old filters belong to the old results
    setResults(null) // clear the previous results rather than showing them under "Searching…"
    setFailure(null)
    setLoading(true)
    try {
      // Trimmed: surrounding spaces are never meaningful to a search, and sending them would put
      // them in the "No articles found for …" message too.
      const response = await fetch(`/api/news/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
      if (response.ok) {
        setFailure(null)
        setResults(await response.json())
      } else {
        setFailure(failureFor(response.status))
        // A 503 still carries the per-source reasons, so the notes line can name what failed.
        // Other statuses have no body worth showing, and a malformed one must not mask the error.
        setResults(
          response.status === 503 ? await response.json().catch(() => null) : null,
        )
      }
    } catch {
      // An aborted request was replaced by a newer one, which owns the state now.
      if (controller.signal.aborted) return
      // fetch only throws when the request never completed: no server, no network, no response.
      setFailure('network')
    } finally {
      // Same reason: the newer search is still loading, so do not switch its state off.
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  const articles = results?.articles ?? []
  const visible = applyFilters(articles, filters)
  const preset = presetOf(filters)
  const notes = results ? [...results.skipped, ...results.unavailable] : []
  const message = emptyMessage(
    { searched: searched !== null, loading, failure, total: articles.length, visible: visible.length },
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
          // Matches the backend limit, so the rejection cannot normally be reached.
          maxLength={200}
        />
        {/* Disabled while a search runs, to stop double submits, and while the box is empty, so a
            blank search cannot be sent. The label stays "Search": the results area already says
            "Searching…", and saying it twice is noise. */}
        <button type="submit" disabled={loading || !canSearch}>
          Search
        </button>
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
            // A broad search can produce a dozen sections, most with one article.
            limit={10}
            onToggle={(value) =>
              setFilters({ ...filters, categories: toggle(filters.categories, value) })
            }
          />
          <FilterGroup
            label="Date"
            options={dateOptions(articles, filters)}
            // No chip selected already means all time; clicking the active one switches it off.
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

      {/* role="status" announces the message to a screen reader; without it the wait between
          pressing Search and results appearing is silent. */}
      {message && (
        <p className="empty" role="status" aria-busy={loading}>
          {message}
        </p>
      )}

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

      {/* Both providers' terms require their logo on any page showing their content, unaltered,
          and NYT's must link to developer.nytimes.com. Real alt text, not empty: these are
          attribution, not decoration. */}
      <footer className="attribution">
        <p>
          News from Hacker News, The New York Times and The Guardian. Headlines link to the original
          articles.
        </p>
        <div className="attribution-logos">
          <a href="https://developer.nytimes.com" target="_blank" rel="noreferrer">
            <img src={nytLogo} alt="The New York Times" />
          </a>
          <a href="https://www.theguardian.com" target="_blank" rel="noreferrer">
            <img src={guardianLogo} alt="Powered by The Guardian" />
          </a>
        </div>
      </footer>
    </div>
  )
}

/** One row of the filter bar: a label and a set of toggleable chips with counts. */
function FilterGroup({
  label,
  options,
  selected,
  limit,
  onToggle,
}: {
  label: string
  options: Option[]
  selected: string[]
  /** Show at most this many chips until the user asks for the rest. */
  limit?: number
  onToggle: (value: string, id?: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (options.length === 0) return null

  const capped = limit !== undefined && !expanded && options.length > limit
  // A selected chip beyond the cap stays visible, or there would be no way to switch it off.
  const shown = capped
    ? options.filter((option, index) => index < limit || selected.includes(option.value))
    : options

  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div className="filter-options">
        {shown.map((option) => {
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

        {limit !== undefined && options.length > limit && (
          <button type="button" className="link" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show fewer' : `Show all ${options.length}`}
          </button>
        )}
      </div>
    </div>
  )
}
