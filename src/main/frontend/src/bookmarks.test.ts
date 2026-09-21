import { describe, expect, it } from 'vitest'
import {
  isBookmarked,
  parseBookmarks,
  removeBookmark,
  toBookmark,
  toggleBookmark,
  type Bookmark,
} from './bookmarks'
import type { Article } from './filters'

const NYT: Article = {
  title: 'A warming world',
  source: 'The New York Times',
  author: 'By Kate Conger',
  summary: 'An abstract the provider owns.',
  url: 'https://nytimes.com/warming',
  publishedAt: '2026-09-18T09:00:00Z',
  category: 'Climate',
}

const HN: Article = {
  title: 'Show HN: a weather model',
  source: 'Hacker News',
  author: 'someuser',
  summary: null,
  url: 'https://news.ycombinator.com/item?id=1',
  publishedAt: '2026-09-19T09:00:00Z',
  category: null,
}

describe('toBookmark', () => {
  it('keeps only what is needed to link back to the original', () => {
    expect(toBookmark(NYT)).toEqual({
      title: 'A warming world',
      source: 'The New York Times',
      url: 'https://nytimes.com/warming',
      publishedAt: '2026-09-18T09:00:00Z',
    })
  })

  it('does not store the provider’s summary', () => {
    // NYT and Guardian cap storing their content at 24h; a bookmark outlives that.
    expect(toBookmark(NYT)).not.toHaveProperty('summary')
  })
})

describe('toggleBookmark', () => {
  it('saves an article, newest first', () => {
    const saved = toggleBookmark([toBookmark(NYT)], HN)

    expect(saved.map((bookmark) => bookmark.url)).toEqual([HN.url, NYT.url])
  })

  it('unsaves an article that is already saved', () => {
    const saved = toggleBookmark([toBookmark(NYT)], NYT)

    expect(saved).toEqual([])
  })

  it('leaves the other bookmarks alone when unsaving one', () => {
    const both = [toBookmark(HN), toBookmark(NYT)]

    expect(toggleBookmark(both, HN)).toEqual([toBookmark(NYT)])
  })

  it('does not mutate the list it was given', () => {
    const before = [toBookmark(NYT)]

    toggleBookmark(before, HN)

    expect(before).toEqual([toBookmark(NYT)])
  })

  it('keeps two providers’ versions of the same story separately', () => {
    // Same title, different pages: saving both is correct, because the links differ.
    const guardian: Article = { ...NYT, source: 'The Guardian', url: 'https://theguardian.com/warming' }

    expect(toggleBookmark([toBookmark(NYT)], guardian)).toHaveLength(2)
  })
})

describe('isBookmarked', () => {
  it('matches on the url rather than the title', () => {
    const saved = [toBookmark(NYT)]

    expect(isBookmarked(saved, NYT.url)).toBe(true)
    expect(isBookmarked(saved, 'https://theguardian.com/warming')).toBe(false)
  })
})

describe('removeBookmark', () => {
  it('removes by url', () => {
    const both = [toBookmark(HN), toBookmark(NYT)]

    expect(removeBookmark(both, NYT.url)).toEqual([toBookmark(HN)])
  })

  it('leaves the list alone when nothing matches', () => {
    const saved = [toBookmark(NYT)]

    expect(removeBookmark(saved, 'https://example.com/never-saved')).toEqual(saved)
  })
})

describe('parseBookmarks', () => {
  const valid: Bookmark = toBookmark(NYT)

  it('keeps well-formed entries', () => {
    expect(parseBookmarks([valid])).toEqual([valid])
  })

  it('ignores a stored value that is not a list', () => {
    expect(parseBookmarks({ title: 'not a list' })).toEqual([])
    expect(parseBookmarks(null)).toEqual([])
    expect(parseBookmarks('["a"]')).toEqual([])
  })

  it('drops entries missing a field the UI needs', () => {
    const { title: _title, ...noTitle } = valid

    expect(parseBookmarks([noTitle, valid])).toEqual([valid])
  })

  it('drops an entry with a blank url, which would collide with every other blank one', () => {
    expect(parseBookmarks([{ ...valid, url: '' }])).toEqual([])
  })

  it('drops entries whose fields are the wrong type', () => {
    expect(parseBookmarks([{ ...valid, publishedAt: 12345 }, null, 'string'])).toEqual([])
  })
})
