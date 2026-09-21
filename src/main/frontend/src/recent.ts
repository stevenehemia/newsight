/**
 * Recent searches, kept in the browser.
 *
 * <p>Per browser and per device: what you searched on a laptop is not there on a phone, and
 * clearing site data removes it. That is the trade for needing no accounts and no server state.
 */

const KEY = 'newsight.recent-searches'

export const RECENT_LIMIT = 8

/** Most recent first, no duplicates, capped. Pure, so the list rules are tested on their own. */
export function addRecent(recent: string[], query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return recent
  // Case-insensitive: "Climate" and "climate" are the same search to a person.
  const withoutDuplicate = recent.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())
  return [trimmed, ...withoutDuplicate].slice(0, RECENT_LIMIT)
}

export function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Anything could be in storage: an older version of this app, or a hand-edited value.
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, RECENT_LIMIT)
  } catch {
    // Private mode, blocked site data, or corrupt JSON. Having no history is not an error.
    return []
  }
}

export function writeRecent(recent: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(recent))
  } catch {
    // Storage full or unavailable; not worth failing a search over.
  }
}

/**
 * Forgets every recent search. Removes the key rather than storing an empty list, so clearing
 * leaves nothing behind — the point of the control is that the history is gone.
 */
export function clearRecent(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Same as writeRecent: storage being unavailable is not worth failing over.
  }
}
