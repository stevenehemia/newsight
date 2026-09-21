import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  categoryOptions,
  dateOptions,
  emptyMessage,
  failureFor,
  NO_FILTERS,
  sourceOptions,
  toggle,
  type Article,
  type Failure,
  type Filters,
} from './filters'

// Fixed so the date presets mean the same thing whenever the tests run.
const NOW = new Date('2026-09-20T12:00:00Z')

const YESTERDAY = article('NYT yesterday', 'The New York Times', 'U.S.', '2026-09-19T09:00:00Z')
const TWO_DAYS = article('HN two days ago', 'Hacker News', null, '2026-09-18T09:00:00Z')
const TEN_DAYS = article('NYT ten days ago', 'The New York Times', 'Climate', '2026-09-10T09:00:00Z')
const THIS_YEAR = article('HN in March', 'Hacker News', null, '2026-03-01T09:00:00Z')
const OLD = article('NYT in 2024', 'The New York Times', 'Climate', '2024-05-05T09:00:00Z')

const ARTICLES = [YESTERDAY, TWO_DAYS, TEN_DAYS, THIS_YEAR, OLD]

describe('applyFilters', () => {
  it('returns everything when nothing is selected', () => {
    expect(applyFilters(ARTICLES, NO_FILTERS, NOW)).toEqual(ARTICLES)
  })

  it('keeps only the selected sources', () => {
    const visible = applyFilters(ARTICLES, filters({ sources: ['Hacker News'] }), NOW)

    expect(visible).toEqual([TWO_DAYS, THIS_YEAR])
  })

  it('widens when a second value in the same facet is selected', () => {
    const visible = applyFilters(
      ARTICLES,
      filters({ sources: ['Hacker News', 'The New York Times'] }),
      NOW,
    )

    expect(visible).toEqual(ARTICLES)
  })

  it('groups articles without a category under Uncategorised', () => {
    const visible = applyFilters(ARTICLES, filters({ categories: ['Uncategorised'] }), NOW)

    expect(visible).toEqual([TWO_DAYS, THIS_YEAR])
  })

  it('treats date presets as cumulative', () => {
    expect(applyFilters(ARTICLES, filters({ datePreset: 'week' }), NOW)).toEqual([
      YESTERDAY,
      TWO_DAYS,
    ])
    expect(applyFilters(ARTICLES, filters({ datePreset: 'month' }), NOW)).toEqual([
      YESTERDAY,
      TWO_DAYS,
      TEN_DAYS,
    ])
    expect(applyFilters(ARTICLES, filters({ datePreset: 'year' }), NOW)).toEqual([
      YESTERDAY,
      TWO_DAYS,
      TEN_DAYS,
      THIS_YEAR,
    ])
  })

  it('narrows across different facets', () => {
    const visible = applyFilters(
      ARTICLES,
      filters({ sources: ['The New York Times'], datePreset: 'week' }),
      NOW,
    )

    expect(visible).toEqual([YESTERDAY])
  })
})

describe('facet counts', () => {
  it('lists sources alphabetically', () => {
    expect(sourceOptions(ARTICLES, NO_FILTERS, NOW)).toEqual([
      { value: 'Hacker News', count: 2 },
      { value: 'The New York Times', count: 3 },
    ])
  })

  it('lists categories busiest first, ties broken alphabetically', () => {
    expect(categoryOptions(ARTICLES, NO_FILTERS, NOW)).toEqual([
      { value: 'Climate', count: 2 },
      { value: 'U.S.', count: 1 },
      // Last despite tying Climate on 2: it is the absence of a topic, not a topic.
      { value: 'Uncategorised', count: 2 },
    ])
  })

  it('keeps Uncategorised last even when it is by far the biggest group', () => {
    const uncategorised = Array.from({ length: 20 }, (_, i) =>
      article(`HN story ${i}`, 'Hacker News', null, '2026-09-18T09:00:00Z'),
    )

    const options = categoryOptions([...uncategorised, YESTERDAY], NO_FILTERS, NOW)

    expect(options).toEqual([
      { value: 'U.S.', count: 1 },
      { value: 'Uncategorised', count: 20 },
    ])
  })

  it('recounts categories when a date is selected, so the counts match what is shown', () => {
    const selected = filters({ datePreset: 'week' })

    expect(categoryOptions(ARTICLES, selected, NOW)).toEqual([
      { value: 'U.S.', count: 1 },
      { value: 'Climate', count: 0 },
      { value: 'Uncategorised', count: 1 },
    ])

    const shown = applyFilters(ARTICLES, selected, NOW).length
    const counted = categoryOptions(ARTICLES, selected, NOW).reduce((sum, o) => sum + o.count, 0)
    expect(counted).toBe(shown)
  })

  it('ignores a facet’s own selection, so picking another value in it still looks useful', () => {
    const counts = sourceOptions(ARTICLES, filters({ sources: ['Hacker News'] }), NOW)

    // Not 0 for NYT: selecting it as well would show its 3 articles.
    expect(counts).toEqual([
      { value: 'Hacker News', count: 2 },
      { value: 'The New York Times', count: 3 },
    ])
  })

  it('keeps an option listed with a count of zero rather than dropping it', () => {
    const counts = categoryOptions(ARTICLES, filters({ sources: ['Hacker News'] }), NOW)

    expect(counts).toContainEqual({ value: 'Climate', count: 0 })
  })

  it('counts dates against the other facets', () => {
    const counts = dateOptions(ARTICLES, filters({ sources: ['Hacker News'] }), NOW)

    expect(counts).toEqual([
      { value: 'Last 7 days', id: 'week', count: 1 },
      { value: 'Last 30 days', id: 'month', count: 1 },
      { value: 'This year', id: 'year', count: 2 },
    ])
  })

  it('offers no date presets when every article is older than all of them', () => {
    expect(dateOptions([OLD], NO_FILTERS, NOW)).toEqual([])
  })
})

describe('failureFor', () => {
  it('tells the three causes apart', () => {
    expect(failureFor(400)).toBe('invalid-query')
    expect(failureFor(503)).toBe('sources-unavailable')
    expect(failureFor(500)).toBe('unknown')
    expect(failureFor(404)).toBe('unknown')
  })
})

describe('emptyMessage', () => {
  const searched = {
    searched: true,
    loading: false,
    failure: null as Failure | null,
    total: 5,
    visible: 5,
  }

  it('says something different for each kind of failure', () => {
    const messageFor = (failure: Failure) =>
      emptyMessage({ ...searched, failure, total: 0, visible: 0 }, 'climate')

    expect(messageFor('invalid-query')).toBe('That search could not be read. Try different words.')
    expect(messageFor('sources-unavailable')).toBe(
      'No news sources are responding right now. Please try again shortly.',
    )
    expect(messageFor('network')).toBe(
      'Could not reach Newsight. Check your connection and try again.',
    )
    expect(messageFor('unknown')).toBe('Something went wrong. Please try again.')

    // Each cause needs its own wording, or the distinction is pointless.
    const messages = (['invalid-query', 'sources-unavailable', 'network', 'unknown'] as const).map(
      messageFor,
    )
    expect(new Set(messages).size).toBe(4)
  })

  it('says nothing before the first search', () => {
    expect(emptyMessage({ ...searched, searched: false, total: 0, visible: 0 }, '')).toBeNull()
  })

  it('says it is searching while a request is in flight', () => {
    expect(emptyMessage({ ...searched, loading: true, total: 0, visible: 0 }, 'climate')).toBe(
      'Searching…',
    )
  })

  it('does not flash the previous result state while loading', () => {
    // Mid-search the old counts are still in state; "nothing found" would be wrong, not just early.
    const message = emptyMessage({ ...searched, loading: true, total: 0, visible: 0 }, 'climate')

    expect(message).not.toBe('No articles found for “climate”.')
  })

  it('prefers the loading message over a failure from the previous attempt', () => {
    const message = emptyMessage(
      { ...searched, loading: true, failure: 'network', total: 0, visible: 0 },
      'climate',
    )

    expect(message).toBe('Searching…')
  })

  it('says nothing while there are articles to show', () => {
    expect(emptyMessage(searched, 'climate')).toBeNull()
  })

  it('names the query when the search found nothing', () => {
    expect(emptyMessage({ ...searched, total: 0, visible: 0 }, 'zzzznomatches')).toBe(
      'No articles found for “zzzznomatches”.',
    )
  })

  it('distinguishes filters hiding everything from a search finding nothing', () => {
    expect(emptyMessage({ ...searched, visible: 0 }, 'climate')).toBe(
      'No articles match these filters.',
    )
  })

  it('does not claim nothing was found when the request failed', () => {
    const message = emptyMessage(
      { searched: true, loading: false, failure: 'unknown', total: 0, visible: 0 },
      'climate',
    )

    expect(message).toBe('Something went wrong. Please try again.')
  })
})

describe('toggle', () => {
  it('adds a value that is not selected and removes one that is', () => {
    expect(toggle([], 'Hacker News')).toEqual(['Hacker News'])
    expect(toggle(['Hacker News'], 'NYT')).toEqual(['Hacker News', 'NYT'])
    expect(toggle(['Hacker News', 'NYT'], 'Hacker News')).toEqual(['NYT'])
  })
})

function filters(overrides: Partial<Filters>): Filters {
  return { ...NO_FILTERS, ...overrides }
}

function article(
  title: string,
  source: string,
  category: string | null,
  publishedAt: string,
): Article {
  return {
    title,
    source,
    author: null,
    summary: null,
    url: `https://example.com/${encodeURIComponent(title)}`,
    publishedAt,
    category,
  }
}
