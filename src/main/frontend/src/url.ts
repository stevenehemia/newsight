/**
 * The search term lives in the URL as `?q=…`, so a search can be shared, bookmarked and reached
 * again with the back button.
 *
 * <p>A query parameter on the root path rather than a route like `/search`: the server returns
 * `index.html` for `/` whatever the query string says, so refreshing a shared link works without
 * the backend needing a fallback for unknown paths.
 */

/** Reads the term from a location search string, e.g. "?q=climate". Empty when absent. */
export function queryFromSearch(search: string): string {
  return new URLSearchParams(search).get('q')?.trim() ?? ''
}

/** The URL a search should be shown at. No query means the bare path, not a dangling "?q=". */
export function urlForQuery(query: string, pathname = '/'): string {
  const trimmed = query.trim()
  return trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname
}
