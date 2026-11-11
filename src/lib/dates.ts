/**
 * Date helpers shared by pages, components and services.
 *
 * Workouts are stored with a `workout_date` column of type DATE, which reaches
 * the client as a plain `YYYY-MM-DD` string with no time zone. Everything here
 * works in the user's *local* calendar so a workout logged late in the evening
 * never slips to the next or previous day.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local `Date` → `YYYY-MM-DD`. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Today as `YYYY-MM-DD` in local time. */
export function todayIso(): string {
  return toIsoDate(new Date())
}

/**
 * `YYYY-MM-DD` → local `Date` at noon. Noon (not midnight) keeps the calendar
 * day stable when the browser converts across a DST change.
 */
export function parseIsoDate(iso: string): Date {
  return new Date(iso + 'T12:00:00')
}

/** Monday 00:00 of the week containing `d` (weeks start on Monday). */
export function weekStart(d: Date = new Date()): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7))
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** `YYYY-MM-DD` → display string, e.g. "Nov 10" (default) or with custom options. */
export function formatDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
  return parseIsoDate(iso).toLocaleDateString('en-US', options)
}
