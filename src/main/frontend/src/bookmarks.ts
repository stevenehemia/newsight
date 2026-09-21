/**
 * Bookmarked articles, kept in the browser.
 *
 * <p>Per browser and per device, like recent searches: what you save on a laptop is not there on a
 * phone, and clearing site data removes it. That is the trade for needing no accounts and no server
 * state.
 *
 * <p>A bookmark stores a **citation, not a copy** — title, link, source and date, but never the
 * summary. NYT and Guardian terms cap storing their content at 24 hours and a bookmark is meant to
 * outlast that, so it keeps only what is needed to point back at the original, which is what those
 * terms ask for anyway.
 */

import type { Article } from './filters'

const KEY = 'newsight.bookmarks'

/** What a saved article keeps. Deliberately narrower than {@link Article} — see the note above. */
export type Bookmark = {
  title: string
  url: string
  source: string
  publishedAt: string
}

/** Strips an article down to the fields a bookmark keeps. */
export function toBookmark(article: Article): Bookmark {
  return {
    title: article.title,
    url: article.url,
    source: article.source,
    publishedAt: article.publishedAt,
  }
}

/**
 * Identity is the url. Two providers covering the same story are two different pages, and saving
 * both is correct. (GNews serves one story under several urls, which would undermine this — it is
 * not implemented, and de-duplicating it belongs on the search side, not here.)
 */
export function isBookmarked(bookmarks: Bookmark[], url: string): boolean {
  return bookmarks.some((bookmark) => bookmark.url === url)
}

/**
 * Newest first, so the most recently saved sits at the top. Saving something already saved removes
 * it again: one control, both directions.
 *
 * <p>There is deliberately **no cap**. Recent searches evict their oldest because the app adds
 * those by itself; a bookmark is something the user chose to keep, and dropping one to make room
 * would be losing their data without asking. A citation is a couple of hundred bytes against a
 * store of several megabytes, so the ceiling is not reachable in practice — and if it ever is,
 * {@link writeBookmarks} reports it rather than pretending the save worked.
 */
export function toggleBookmark(bookmarks: Bookmark[], article: Article): Bookmark[] {
  if (isBookmarked(bookmarks, article.url)) {
    return removeBookmark(bookmarks, article.url)
  }
  return [toBookmark(article), ...bookmarks]
}

/** Removing takes a url, not an article: the saved list holds bookmarks, which are not articles. */
export function removeBookmark(bookmarks: Bookmark[], url: string): Bookmark[] {
  return bookmarks.filter((bookmark) => bookmark.url !== url)
}

/**
 * Kept apart from {@link readBookmarks} so the rules for what counts as a usable stored value are
 * pure, and testable without a browser.
 */
export function parseBookmarks(value: unknown): Bookmark[] {
  // Anything could be in storage: an older version of this app, or a hand-edited value.
  if (!Array.isArray(value)) return []
  return value.filter(isBookmark)
}

export function readBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? parseBookmarks(JSON.parse(raw)) : []
  } catch {
    // Private mode, blocked site data, or corrupt JSON. Having no bookmarks is not an error.
    return []
  }
}

/**
 * Reports whether the write landed, unlike recent searches, which are written silently. Bookmarking
 * is something the user deliberately did, so a full or blocked store has to be tellable — failing
 * quietly would leave them believing an article was saved when it was not.
 */
export function writeBookmarks(bookmarks: Bookmark[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(bookmarks))
    return true
  } catch {
    return false
  }
}

function isBookmark(value: unknown): value is Bookmark {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    isFilled(candidate.title) &&
    // The url is the identity, so a blank one would make every such entry collide.
    isFilled(candidate.url) &&
    isFilled(candidate.source) &&
    isFilled(candidate.publishedAt)
  )
}

function isFilled(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}
