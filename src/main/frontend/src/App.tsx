import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
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
  type Article,
  type Failure,
  type Filters,
  type SearchResults,
} from './filters'
import {
  isBookmarked,
  readBookmarks,
  removeBookmark,
  toggleBookmark,
  writeBookmarks,
  type Bookmark,
} from './bookmarks'
import { addRecent, clearRecent, readRecent, writeRecent } from './recent'
import { BOOKMARKS_PATH, routeOf, SEARCH_PATH, type Route } from './route'
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
  const [recent, setRecent] = useState<string[]>(() => readRecent())
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => readBookmarks())
  // Bookmarks are their own page at /bookmarks, not a filtered view: filters narrow the current
  // search, and a bookmarked article usually came from a different one.
  const [route, setRoute] = useState<Route>(() => routeOf(window.location.pathname))
  const [writeFailed, setWriteFailed] = useState(false)
  const inFlight = useRef<AbortController | null>(null)
  const started = useRef(false)
  const searchInput = useRef<HTMLInputElement>(null)
  // What the current results are for, readable from the popstate listener without making it
  // re-subscribe on every search. Coming back from /bookmarks must not refetch what is on screen.
  const searchedFor = useRef<string | null>(null)

  // Whitespace only is not a search. The backend rejects it with a 400, but the user should never
  // get that far: a rejection reads like a fault, when the answer is just "type something".
  const trimmed = query.trim()
  const canSearch = trimmed.length > 0

  /**
   * Back to an empty search page, for when the back button lands on a bare "/". The URL says
   * there is no search, so the page must agree rather than keep showing the previous results.
   */
  const clearSearch = useCallback(() => {
    // A search still in flight would otherwise land afterwards and repopulate the page.
    inFlight.current?.abort()
    setQuery('')
    setResults(null)
    setSearched(null)
    searchedFor.current = null
    setFailure(null)
    // runSearch's finally block skips this when it sees the abort, so it falls to us.
    setLoading(false)
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
    searchedFor.current = term
    setFilters(NO_FILTERS) // the old filters belong to the old results
    setResults(null) // clear the previous results rather than showing them under "Searching…"
    setFailure(null)
    setLoading(true)
    // Searching means you want results, even if you were looking at the bookmarks page. Covers
    // the form, a recent chip, a shared link and the back button, since all four come through here.
    setRoute('search')
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
  }, [])

  /** Searches and records it in the URL, so the result can be shared and the back button works. */
  const startSearch = useCallback(
    (term: string) => {
      // Always the search path, never the current one: searching from /bookmarks must land on
      // /?q=…, not /bookmarks?q=….
      const target = urlForQuery(term, SEARCH_PATH)
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

  // Back and forward move between searches and the bookmarks page rather than leaving the app.
  useEffect(() => {
    function onPopState() {
      const next = routeOf(window.location.pathname)
      setRoute(next)
      if (next === 'bookmarks') return // nothing to fetch, and the results stay for the way back

      const term = queryFromSearch(window.location.search)
      setQuery(term)
      if (!term) {
        clearSearch()
      } else if (term !== searchedFor.current) {
        // Only when it is a different search. Otherwise returning from /bookmarks would refetch
        // results that are still on screen, for no gain and a call against every provider.
        void runSearch(term)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [runSearch, clearSearch])

  /** Moves between the app's two pages without a reload, keeping the back button working. */
  function go(path: string) {
    if (path !== window.location.pathname + window.location.search) {
      window.history.pushState({}, '', path)
    }
    setRoute(routeOf(path))
  }

  /** Leaves modified clicks to the browser, so "open in new tab" still does that. */
  function navigate(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return
    }
    event.preventDefault()
    go(path)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSearch) return // belt and braces; the button is disabled too
    startSearch(trimmed)
  }

  /**
   * Storage is the source of truth, so the write happens with the state change rather than in an
   * effect afterwards. writeBookmarks reports failure — a full or blocked store has to be said out
   * loud, or the user believes an article was bookmarked when it was not.
   */
  function persist(next: Bookmark[]) {
    setBookmarks(next)
    setWriteFailed(!writeBookmarks(next))
  }

  function forgetRecent() {
    setRecent([])
    clearRecent()
    // The whole row disappears along with the button that was just clicked, so focus would fall
    // back to the body. Hand it to the search box, which is where someone clearing history is
    // most likely headed next.
    searchInput.current?.focus()
  }

  const articles = results?.articles ?? []
  const visible = applyFilters(articles, filters)
  // Returns to the search that was on screen rather than a bare "/", so the results survive the
  // round trip and nothing is fetched again.
  const backToSearch = urlForQuery(searched ?? '', SEARCH_PATH)
  const preset = presetOf(filters)
  const notes = results ? [...results.skipped, ...results.unavailable] : []
  const message = emptyMessage(
    { searched: searched !== null, loading, failure, total: articles.length, visible: visible.length },
    searched ?? '',
  )

  return (
    <div className="page">
      <header className="masthead">
        {/* The brand goes home, as it does almost everywhere. Deliberately a plain link with no
            click handler: going home is a reset, and a real navigation gives that for free and
            exactly right — the browser discards all of this and React starts fresh. The cost is a
            page reload, which is the correct trade for the one link whose job is starting over.

            One link around both the mark and the wordmark rather than two: a screen reader should
            hear "Newsight, link" once, and its accessible name comes from the heading text. */}
        <a className="brand" href={SEARCH_PATH}>
          {/* Decorative: the name is right beside it, so a screen reader reading
              "Newsight logo, Newsight" would just be noise. */}
          <img className="logo" src={logo} alt="" />
          <h1>Newsight</h1>
        </a>
        <p className="tagline">Bringing news together, delivering insights faster</p>
      </header>

      {/* The bookmarks page has no search box and no recent searches: "← Back to search" is the
          way out, and repeating the search controls on a page about saved articles would blur what
          the page is for. Searching from here means going back first, which is one click. */}
      {route === 'search' && (
        <>
          <form className="search" onSubmit={onSubmit}>
            <input
              ref={searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search news"
              aria-label="Search news"
              // Matches the backend limit, so the rejection cannot normally be reached.
              maxLength={200}
            />
            {/* Disabled while a search runs, to stop double submits, and while the box is empty,
                so a blank search cannot be sent. The label stays "Search": the results area
                already says "Searching…", and saying it twice is noise. */}
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
              onClear={forgetRecent}
            />
          </div>
        </>
      )}

      {/* Real anchors, not buttons: the server forwards /bookmarks, so ctrl-click and middle-click
          genuinely open it in a new tab, and the address bar shows where you are. The handler only
          takes over the plain click, to move pages without a reload.

          "Bookmarked articles", not "Saved": this sits right under the recent searches, where
          "Saved" would read as saved searches — a thing the app deliberately does not do. */}
      {(route === 'bookmarks' || bookmarks.length > 0) && (
        <p className="page-link">
          {route === 'search' ? (
            <a
              className="page-action"
              href={BOOKMARKS_PATH}
              onClick={(event) => navigate(event, BOOKMARKS_PATH)}
            >
              Bookmarked articles ({bookmarks.length})
            </a>
          ) : (
            // Back to the search that was on screen, not a bare "/", so the results are still
            // there and nothing is fetched again.
            <a href={backToSearch} onClick={(event) => navigate(event, backToSearch)}>
              ← Back to search
            </a>
          )}
        </p>
      )}

      {writeFailed && (
        <p className="notes">
          This browser would not store the change — saving is blocked or its storage is full.
        </p>
      )}

      {notes.length > 0 && route === 'search' && (
        <p className="notes">
          Not included — {notes.map((note) => `${note.source}: ${note.reason}`).join(' · ')}
        </p>
      )}

      {articles.length > 0 && route === 'search' && (
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
      {articles.length > 0 && route === 'search' && (
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
      {message && route === 'search' && (
        <p className="empty" role="status" aria-busy={loading}>
          {message}
        </p>
      )}

      {route === 'bookmarks' && (
        <h2 className="page-heading">
          Bookmarked articles
          {bookmarks.length > 0 && <span className="count"> ({bookmarks.length})</span>}
        </h2>
      )}

      {route === 'bookmarks' && bookmarks.length === 0 && (
        <p className="empty">
          No bookmarks yet — use Bookmark on an article to keep it here.
        </p>
      )}

      <ul className="results">
        {route === 'bookmarks'
          ? bookmarks.map((bookmark) => (
              <ResultCard
                key={bookmark.url}
                article={bookmark}
                bookmarked
                // This list holds bookmarks, not articles, so there is nothing to re-create from
                // here — the button only ever removes.
                onToggle={() => persist(removeBookmark(bookmarks, bookmark.url))}
              />
            ))
          : visible.map((article, index) => (
              <ResultCard
                key={`${article.url}-${index}`}
                article={article}
                bookmarked={isBookmarked(bookmarks, article.url)}
                onToggle={() => persist(toggleBookmark(bookmarks, article))}
              />
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
 * What a card needs. The four required fields are exactly what a bookmark keeps; the richer ones
 * are optional, so one card renders both a search result and a bookmarked article. A bookmark holds no
 * summary, author or category on purpose — it is a citation, not a copy of the provider's content.
 */
type CardArticle = Bookmark & Partial<Pick<Article, 'author' | 'summary' | 'category'>>

function ResultCard({
  article,
  bookmarked,
  onToggle,
}: {
  article: CardArticle
  bookmarked: boolean
  onToggle: () => void
}) {
  return (
    <li className="card">
      <div className="card-head">
        <h2>
          <a href={article.url} target="_blank" rel="noreferrer">
            {article.title}
          </a>
        </h2>
        {/* The label carries the state, so no aria-pressed: with both, a screen reader would
            announce "Bookmarked, pressed". The filter chips are the other way round — their label
            is a fixed facet value, so there the state can only come from aria-pressed. */}
        <button
          type="button"
          className="chip bookmark"
          data-bookmarked={bookmarked || undefined}
          onClick={onToggle}
        >
          {bookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </div>
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
  )
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
  onClear,
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
  /** Given only by rows whose contents can be thrown away, which today is recent searches. */
  onClear?: () => void
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

        {/* Same treatment as "Clear filters": a text link, not a chip, because it acts on the row
            rather than being one of its values. */}
        {onClear && (
          <button type="button" className="link" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
