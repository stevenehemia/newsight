/**
 * The search term lives in the URL as `?q=…`, so a search can be shared, bookmarked and reached
 * again with the back button.
 *
 * <p>A query parameter on the root path rather than a route like `/search`: the server returns
 * `index.html` for `/` whatever the query string says, so a shared link survives a refresh on its
 * own. A *path* does not — `/bookmarks` needs `ClientRoutes` on the Java side to forward it, or it
 * answers a Whitelabel 404 (verified against a packaged build). See `route.ts`.
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
