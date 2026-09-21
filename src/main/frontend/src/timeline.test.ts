import { describe, expect, it } from 'vitest'
import { bars, chartLabel, summary, trend, type Timeline, type Week } from './timeline'

/** Counts are all the test cares about; the boundaries only have to be distinct and ordered. */
function weeks(...counts: number[]): Week[] {
  return counts.map((count, index) => ({
    start: `2026-07-${String(6 + index * 7).padStart(2, '0')}T00:00:00Z`,
    end: `2026-07-${String(13 + index * 7).padStart(2, '0')}T00:00:00Z`,
    count,
  }))
}

function timeline(...counts: number[]): Timeline {
  return { source: 'Hacker News', weeks: weeks(...counts) }
}

describe('bars', () => {
  it('scales heights against the busiest week', () => {
    expect(bars(weeks(50, 100, 25)).map((bar) => bar.height)).toEqual([0.5, 1, 0.25])
  })

  it('marks the most recent week', () => {
    expect(bars(weeks(1, 2, 3)).map((bar) => bar.latest)).toEqual([false, false, true])
  })

  it('keeps a lone post visible beside a busy week', () => {
    // A true proportion is 0.002, which draws as nothing and reads as "no coverage".
    const [quiet, busy] = bars(weeks(1, 500))

    expect(quiet.height).toBeGreaterThan(0.03)
    expect(busy.height).toBe(1)
  })

  it('draws a week with no posts as nothing at all', () => {
    expect(bars(weeks(0, 10))[0].height).toBe(0)
  })

  it('survives a topic with no coverage in any week', () => {
    expect(bars(weeks(0, 0, 0)).map((bar) => bar.height)).toEqual([0, 0, 0])
  })
})

describe('trend', () => {
  it('measures the latest week against the average of the earlier ones', () => {
    // Earlier weeks average 20; the latest is 80.
    const measured = trend(weeks(10, 20, 30, 80))

    expect(measured).toEqual({ total: 140, latest: 80, average: 20, direction: 'rising' })
  })

  it('calls a collapse in coverage falling', () => {
    expect(trend(weeks(100, 100, 100, 10))?.direction).toBe('falling')
  })

  it('calls a small wobble steady', () => {
    expect(trend(weeks(100, 110, 90, 105))?.direction).toBe('steady')
  })

  it('does not call a quiet topic rising on a handful of posts', () => {
    // 1 → 3 is a tripling in proportion, but three posts is not a story.
    expect(trend(weeks(1, 1, 1, 3))?.direction).toBe('steady')
  })

  it('has nothing to compare with a single week', () => {
    expect(trend(weeks(5))).toBeNull()
  })
})

describe('summary', () => {
  it('names the source, the volume and the direction', () => {
    expect(summary(timeline(10, 20, 30, 80))).toBe(
      '140 posts on Hacker News over 4 weeks — picking up, with 80 posts in the latest week ' +
        'against an average of 20.',
    )
  })

  it('says plainly when a topic was never mentioned', () => {
    expect(summary(timeline(0, 0, 0))).toBe(
      'No Hacker News posts mentioned this in the last 3 weeks.',
    )
  })

  it('does not write "1 posts"', () => {
    expect(summary(timeline(0, 0, 1))).toContain('1 post in the latest week')
  })
})

describe('chartLabel', () => {
  it('reads the counts out for a screen reader', () => {
    expect(chartLabel(timeline(3, 9))).toBe('Weekly Hacker News posts, oldest week first: 3, 9.')
  })
})
