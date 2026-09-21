import { describe, expect, it } from 'vitest'
import { queryFromSearch, urlForQuery } from './url'

describe('queryFromSearch', () => {
  it('reads the term', () => {
    expect(queryFromSearch('?q=climate')).toBe('climate')
  })

  it('decodes what the browser encoded', () => {
    expect(queryFromSearch('?q=AT%26T')).toBe('AT&T')
    expect(queryFromSearch('?q=spring+boot')).toBe('spring boot')
  })

  it('is empty when there is no query at all', () => {
    expect(queryFromSearch('')).toBe('')
    expect(queryFromSearch('?other=1')).toBe('')
  })

  it('trims, so a padded link does not search for spaces', () => {
    expect(queryFromSearch('?q=%20%20climate%20')).toBe('climate')
    expect(queryFromSearch('?q=%20%20')).toBe('')
  })
})

describe('urlForQuery', () => {
  it('puts the term in the query string', () => {
    expect(urlForQuery('climate')).toBe('/?q=climate')
  })

  it('encodes characters that would otherwise break the URL', () => {
    expect(urlForQuery('AT&T')).toBe('/?q=AT%26T')
  })

  it('drops the query string entirely when there is no term', () => {
    expect(urlForQuery('')).toBe('/')
    expect(urlForQuery('   ')).toBe('/')
  })

  it('keeps whatever path it is given, for a deployment served under a sub-path', () => {
    expect(urlForQuery('climate', '/app/')).toBe('/app/?q=climate')
  })
})
