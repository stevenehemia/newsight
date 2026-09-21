/**
 * Which page the URL is asking for.
 *
 * <p>Hand-rolled rather than a router library: there are two pages, and `url.ts` already keeps the
 * search term in the URL with `pushState` and `popstate`. A router would add a dependency to do
 * the same job.
 *
 * <p>These are real paths, so **the server has to forward them to `index.html`** — see
 * `ClientRoutes` on the Java side. A query string like `?q=climate` needs no such help, because it
 * leaves the path alone.
 */

export const SEARCH_PATH = '/'
export const BOOKMARKS_PATH = '/bookmarks'

export type Route = 'search' | 'bookmarks'

/** Anything that is not the bookmarks page is the search page, including an unknown path. */
export function routeOf(pathname: string): Route {
  return normalise(pathname) === BOOKMARKS_PATH ? 'bookmarks' : 'search'
}

/**
 * Real browsers produce both `/bookmarks` and `/bookmarks/`, and the server forwards both, so the
 * client has to agree with it rather than treating one of them as the search page.
 */
function normalise(pathname: string): string {
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, '')
    : withLeadingSlash
}
