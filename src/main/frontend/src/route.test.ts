import { describe, expect, it } from 'vitest'
import { BOOKMARKS_PATH, routeOf, SEARCH_PATH } from './route'

describe('routeOf', () => {
  it('reads the bookmarks page', () => {
    expect(routeOf(BOOKMARKS_PATH)).toBe('bookmarks')
  })

  it('reads the root as the search page', () => {
    expect(routeOf(SEARCH_PATH)).toBe('search')
  })

  it('accepts the trailing-slash spelling, which the server also forwards', () => {
    expect(routeOf('/bookmarks/')).toBe('bookmarks')
  })

  it('falls back to search for a path nobody serves', () => {
    // The server only forwards the routes it knows, so this should not arrive — but if it does,
    // showing the search page beats rendering nothing.
    expect(routeOf('/nonsense')).toBe('search')
  })

  it('does not match a path that merely starts with the same letters', () => {
    expect(routeOf('/bookmarksomething')).toBe('search')
  })
})
