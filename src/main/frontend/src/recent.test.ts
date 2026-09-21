import { describe, expect, it } from 'vitest'
import { addRecent, RECENT_LIMIT } from './recent'

describe('addRecent', () => {
  it('puts the newest search first', () => {
    expect(addRecent(['climate'], 'bitcoin')).toEqual(['bitcoin', 'climate'])
  })

  it('moves a repeated search back to the front instead of duplicating it', () => {
    expect(addRecent(['bitcoin', 'climate'], 'climate')).toEqual(['climate', 'bitcoin'])
  })

  it('treats differently cased searches as the same one', () => {
    // "Climate" and "climate" are one search to a person, so the list should hold one entry.
    expect(addRecent(['climate'], 'Climate')).toEqual(['Climate'])
  })

  it('trims before storing, so padding does not create a near-duplicate', () => {
    expect(addRecent(['climate'], '  climate  ')).toEqual(['climate'])
    expect(addRecent([], '  bitcoin ')).toEqual(['bitcoin'])
  })

  it('ignores a blank search', () => {
    expect(addRecent(['climate'], '   ')).toEqual(['climate'])
  })

  it('keeps only the most recent few', () => {
    const many = Array.from({ length: RECENT_LIMIT }, (_, i) => `search ${i}`)

    const result = addRecent(many, 'newest')

    expect(result).toHaveLength(RECENT_LIMIT)
    expect(result[0]).toBe('newest')
    // The oldest fell off the end rather than the list growing without limit.
    expect(result).not.toContain(`search ${RECENT_LIMIT - 1}`)
  })
})
