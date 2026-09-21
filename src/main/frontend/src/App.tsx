import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
  type SearchResults,
} from './filters'
import { addRecent, readRecent, writeRecent } from './recent'
import { bars, chartLabel, summary as trendSummary, type Timeline } from './timeline'
import { queryFromSearch, urlForQuery } from './url'

export default function App() {
  // A shared link arrives with ?q=… already set, so the box starts with it rather than being
  // filled in by an effect afterwards.
  const [query, setQuery] = useState(() => queryFromSearch(window.location.search))
  const [results, setResults] = useState<SearchResults | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  // The query that produced the current results, which may differ from what is in the box now.
  const [searched, setSearched] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [timelineFailed, setTimelineFailed] = useState(false)
  const [recent, setRecent] = useState<string[]>(() => readRecent())
  const inFlight = useRef<AbortController | null>(null)
  const started = useRef(false)

  // Whitespace only is not a search. The backend rejects it with a 400, but the user should never
  // get that far: a rejection reads like a fault, when the answer is just "type something".
  const trimmed = query.trim()
  const canSearch = trimmed.length > 0

  /**
   * Loads the coverage timeline alongside the search rather than after it, so the two waits
   * overlap. Shares the search's controller: abandoning a search abandons its timeline too.
   *
   * <p>Failures stop here on purpose. The timeline is an extra — if counting breaks, the articles
   * are still the answer to what the user asked, so a failure gets one quiet line, not the error
   * treatment the results area gives a failed search.
   */
  const loadTimeline = useCallback(async (term: string, controller: AbortController) => {
    try {
      const response = await fetch(`/api/news/timeline?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`timeline responded ${response.status}`)
      setTimeline(await response.json())
    } catch {
      if (controller.signal.aborted) return
      setTimelineFailed(true)
    }
  }, [])

  /**
   * Runs a search for a term. Called from the form, a recent chip, a shared link and the back
   * button, so it takes the term rather than reading state. useCallback with no dependencies is
   * safe because it only touches setters and refs, which React keeps stable.
   */
  const runSearch = useCallback(async (term: string) => {
    if (!term) return
    // Drop any search still in flight: without this, a slow first response can arrive after a
    // faster second one and overwrite it with results for a query the user has moved on from.
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    setSearched(term)
    setFilters(NO_FILTERS) // the old filters belong to the old results
    setResults(null) // clear the previous results rather than showing them under "Searching…"
    setFailure(null)
    setLoading(true)
    setTimeline(null)
    setTimelineFailed(false)
    void loadTimeline(term, controller)
    try {
      const response = await fetch(`/api/news/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
      if (response.ok) {
        setFailure(null)
        setResults(await response.json())
        // Only searches that worked are worth offering again.
        setRecent((previous) => {
          const next = addRecent(previous, term)
          writeRecent(next)
          return next
        })
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
  }, [loadTimeline])

  /** Searches and records it in the URL, so the result can be shared and the back button works. */
  const startSearch = useCallback(
    (term: string) => {
      const target = urlForQuery(term, window.location.pathname)
      // Only a new entry for a different URL: searching the same term twice should not need two
      // presses of the back button to leave.
      if (target !== window.location.pathname + window.location.search) {
        window.history.pushState({}, '', target)
      }
      setQuery(term)
      void runSearch(term)
    },
    [runSearch],
  )

  // …and the search itself runs once on arrival.
  useEffect(() => {
    if (started.current) return // StrictMode runs effects twice in development
    started.current = true
    const initial = queryFromSearch(window.location.search)
    // runSearch sets state before its first await, which the rule flags. That is what this effect
    // is for: synchronising with two external systems, the URL and the API, once on mount.
    // oxlint-disable-next-line react/set-state-in-effect
    if (initial) void runSearch(initial)
  }, [runSearch])

  // Back and forward move between searches rather than leaving the app.
  useEffect(() => {
    function onPopState() {
      const term = queryFromSearch(window.location.search)
      setQuery(term)
      if (term) {
        void runSearch(term)
      } else {
        setResults(null)
        setSearched(null)
        setFailure(null)
        setTimeline(null)
        setTimelineFailed(false)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [runSearch])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSearch) return // belt and braces; the button is disabled too
    startSearch(trimmed)
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

      <form className="search" onSubmit={onSubmit}>
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

      {/* Kept in this browser only, so there are no accounts and no server state to manage.
          Same row component as the filters: capped, with the same "Show all N" toggle. */}
      <div className="recent">
        <FilterGroup
          label="Recent"
          options={recent.map((term) => ({ value: term }))}
          selected={[]}
          limit={5}
          pressable={false}
          onToggle={(term) => startSearch(term)}
        />
      </div>

      {notes.length > 0 && (
        <p className="notes">
          Not included — {notes.map((note) => `${note.source}: ${note.reason}`).join(' · ')}
        </p>
      )}

      {/* Above the filters, not below: these counts describe the topic, not the articles listed
          underneath, and nothing here responds to a chip being ticked. */}
      {timeline && <CoverageTimeline timeline={timeline} />}
      {timelineFailed && <p className="notes">Coverage timeline unavailable for this search.</p>}

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

/**
 * Weekly counts as a row of bars. CSS heights rather than an inline SVG: the chart has to stay
 * readable from a phone to a wide window, and percentage heights in a flex row reflow for free
 * where a fixed viewBox would need scaling rules to avoid stretching the bars.
 */
function CoverageTimeline({ timeline }: { timeline: Timeline }) {
  const drawn = bars(timeline.weeks)
  if (drawn.length === 0) return null
  // A topic nobody posted about draws eight empty slots that say nothing the sentence does not
  // say better, so the chart only appears once there is something to compare.
  const anyCoverage = drawn.some((bar) => bar.count > 0)

  return (
    <section className="timeline">
      <h2>Coverage on {timeline.source}</h2>
      {/* The counts and dates are printed under the bars rather than left to a tooltip, which a
          touch screen never shows. role="img" stops a screen reader walking 8 empty divs. */}
      {anyCoverage && (
        <div className="chart" role="img" aria-label={chartLabel(timeline)}>
          {drawn.map((bar) => (
            <div className="bar-slot" key={bar.end}>
              <span className="bar-count">{bar.count}</span>
              <div className="bar-track">
                <div
                  className="bar"
                  style={{ height: `${bar.height * 100}%` }}
                  // The newest week is what the reader is asking about; the rest is context.
                  data-latest={bar.latest || undefined}
                />
              </div>
              <span className="bar-week">{weekEnding(bar.end)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="timeline-summary">{trendSummary(timeline)}</p>
      {/* Both caveats matter: the bars count every matching post, not the ~30 articles listed
          below, and the provider's totals are its own estimate rather than an exact census. */}
      {anyCoverage && (
        <p className="timeline-note">
          Counted across all matching posts, not only the articles listed below. Totals are
          approximate.
        </p>
      )}
    </section>
  )
}

/** Short enough to sit under a bar on a phone: "3 Aug". */
function weekEnding(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * A chip in the row. Facet options always carry a count and satisfy this; recent searches have
 * nothing to count, so the count is optional here rather than in {@link Option}, where the sorting
 * code relies on it being present.
 */
type Chip = { value: string; count?: number; id?: string }

/** One row of chips: a label, the chips, and a toggle when there are more than `limit`. */
function FilterGroup({
  label,
  options,
  selected,
  limit,
  pressable = true,
  onToggle,
}: {
  label: string
  options: Chip[]
  selected: string[]
  /** Show at most this many chips until the user asks for the rest. */
  limit?: number
  /**
   * False for chips that act rather than toggle, like a recent search. aria-pressed would
   * otherwise announce them as switches that are never on.
   */
  pressable?: boolean
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
              aria-pressed={pressable ? isSelected : undefined}
              // Nothing left to show, and not currently selected: leave it visible but unusable.
              disabled={option.count === 0 && !isSelected}
              className="chip"
              onClick={() => onToggle(option.value, option.id)}
            >
              {option.value}
              {option.count !== undefined && ` (${option.count})`}
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
