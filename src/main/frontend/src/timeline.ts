/**
 * Shaping for the coverage timeline. Like filters.ts this is plain functions with no React and no
 * fetching, so the arithmetic that decides what the chart claims can be tested directly.
 */

/** One bucket from GET /api/news/timeline. `start` is exclusive, `end` inclusive. */
export type Week = {
  start: string
  end: string
  count: number
}

/** Mirrors the Timeline record returned by GET /api/news/timeline. */
export type Timeline = {
  source: string
  weeks: Week[]
}

/** A week ready to draw: the count, plus its height as a fraction of the busiest week. */
export type Bar = Week & {
  /** 0 to 1, for the bar's height. */
  height: number
  /** The most recent week, which the summary singles out. */
  latest: boolean
}

/**
 * Enough height that one post is still visible next to a week of hundreds. A true proportion would
 * round a lone post down to nothing, which reads as "no coverage" rather than "a little".
 */
const MIN_VISIBLE = 0.04

/** How far from the earlier average the latest week must sit before it counts as a change. */
const CHANGE = 0.35

export function bars(weeks: Week[]): Bar[] {
  const busiest = Math.max(...weeks.map((week) => week.count), 0)
  return weeks.map((week, index) => ({
    ...week,
    height: busiest === 0 ? 0 : Math.max(week.count / busiest, week.count > 0 ? MIN_VISIBLE : 0),
    latest: index === weeks.length - 1,
  }))
}

export type Direction = 'rising' | 'falling' | 'steady'

export type Trend = {
  total: number
  /** The most recent week's count. */
  latest: number
  /** Mean of the weeks before the latest one, rounded, which the latest is judged against. */
  average: number
  direction: Direction
}

/**
 * Compares the most recent week with the average of the weeks before it. Deliberately not a
 * line-of-best-fit: over eight buckets the question a reader actually has is "is this picking up
 * right now", and a trend line answers a subtly different one while being far harder to explain.
 */
export function trend(weeks: Week[]): Trend | null {
  if (weeks.length < 2) return null
  const earlier = weeks.slice(0, -1)
  const latest = weeks[weeks.length - 1].count
  const total = weeks.reduce((sum, week) => sum + week.count, 0)
  const average = Math.round(earlier.reduce((sum, week) => sum + week.count, 0) / earlier.length)

  let direction: Direction = 'steady'
  // A quiet topic swinging 2 → 5 is noise, not a story, so the change has to clear a floor of
  // posts as well as a proportion.
  if (Math.abs(latest - average) >= 3) {
    if (latest >= average * (1 + CHANGE)) direction = 'rising'
    else if (latest <= average * (1 - CHANGE)) direction = 'falling'
  }
  return { total, latest, average, direction }
}

const PHRASES: Record<Direction, string> = {
  rising: 'picking up',
  falling: 'quietening down',
  steady: 'holding steady',
}

/**
 * The sentence under the chart. Says the source out loud: counted against Hacker News, "rust" is a
 * real signal and "fashion" is close to meaningless, so a bare "coverage" would overclaim.
 */
export function summary(timeline: Timeline): string {
  const measured = trend(timeline.weeks)
  const weeks = timeline.weeks.length
  if (!measured || measured.total === 0) {
    return `No ${timeline.source} posts mentioned this in the last ${weeks} weeks.`
  }
  return (
    `${plural(measured.total, 'post')} on ${timeline.source} over ${weeks} weeks — ` +
    `${PHRASES[measured.direction]}, with ${plural(measured.latest, 'post')} in the latest week ` +
    `against an average of ${measured.average}.`
  )
}

/** A text alternative for the chart, since a row of bars tells a screen reader nothing. */
export function chartLabel(timeline: Timeline): string {
  const counts = timeline.weeks.map((week) => week.count).join(', ')
  return `Weekly ${timeline.source} posts, oldest week first: ${counts}.`
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`
}
