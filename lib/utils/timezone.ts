/**
 * Timezone helpers
 *
 * Why this exists:
 * - Bookings are stored as UTC instants (ISO timestamps).
 * - Roster rules are stored as local "wall-clock" times and local calendar dates.
 *
 * Therefore, when validating roster rules server-side we must convert a UTC instant into:
 * - The *school-local* calendar date (YYYY-MM-DD)
 * - The *school-local* time (HH:mm)
 *
 * This module intentionally avoids adding a heavyweight timezone dependency by using
 * `Intl.DateTimeFormat(...).formatToParts`, which is DST-safe.
 */

export type ZonedDateTimeParts = {
  yyyyMmDd: string
  hhmm: string
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function parseHHmmToMinutes(hhmm: string): number {
  const [hRaw, mRaw] = hhmm.split(":")
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN
  return h * 60 + m
}

function ymdToUtcDayNumber(dateYyyyMmDd: string): number {
  const [yy, mm, dd] = dateYyyyMmDd.split("-").map((x) => Number(x))
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return NaN
  return Math.floor(Date.UTC(yy, mm - 1, dd) / 86_400_000)
}

export function addDaysYyyyMmDd(dateYyyyMmDd: string, days: number): string {
  const dayNum = ymdToUtcDayNumber(dateYyyyMmDd)
  if (!Number.isFinite(dayNum)) return dateYyyyMmDd
  const utc = new Date((dayNum + days) * 86_400_000)
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`
}

/**
 * Returns YYYY-MM-DD and HH:mm for a given UTC instant in an IANA timezone.
 */
export function getZonedYyyyMmDdAndHHmm(date: Date, timeZone: string): ZonedDateTimeParts {
  // hourCycle: 'h23' ensures 00-23 hour formatting
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })

  const parts = dtf.formatToParts(date)
  const map = new Map(parts.map((p) => [p.type, p.value]))
  const y = map.get("year")
  const m = map.get("month")
  const d = map.get("day")
  const hh = map.get("hour")
  const mm = map.get("minute")

  if (!y || !m || !d || !hh || !mm) {
    // Extremely defensive fallback: treat as UTC.
    const yyyyMmDd = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
    const hhmm = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`
    return { yyyyMmDd, hhmm }
  }

  return { yyyyMmDd: `${y}-${m}-${d}`, hhmm: `${hh}:${mm}` }
}

/**
 * Compute JS-style day-of-week (0=Sun..6=Sat) for a calendar date string YYYY-MM-DD.
 *
 * Important: day-of-week of a calendar date is absolute and does not depend on timezone.
 * We compute it using UTC to avoid server-local timezone differences.
 */
export function dayOfWeekFromYyyyMmDd(dateYyyyMmDd: string): number {
  const [yy, mm, dd] = dateYyyyMmDd.split("-").map((x) => Number(x))
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return NaN
  const utc = new Date(Date.UTC(yy, mm - 1, dd))
  return utc.getUTCDay()
}

/**
 * Convert a *school-local* date+time ("wall clock") into a UTC Date.
 *
 * This is DST-safe and does not rely on any fixed offsets.
 *
 * Notes on DST edge cases:
 * - If the local time is "skipped" (spring forward gap), the algorithm will converge to the next
 *   representable instant (effectively pushing forward).
 * - If the local time is ambiguous (fall back overlap), the algorithm will converge to the earlier
 *   occurrence. If you ever need "later occurrence" semantics, we can add an option.
 */
export function zonedDateTimeToUtc(params: { dateYyyyMmDd: string; timeHHmm: string; timeZone: string }): Date {
  const desiredDay = ymdToUtcDayNumber(params.dateYyyyMmDd)
  const desiredMin = parseHHmmToMinutes(params.timeHHmm)
  if (!Number.isFinite(desiredDay) || !Number.isFinite(desiredMin)) {
    return new Date("Invalid Date")
  }

  // Initial guess: interpret local wall-clock as if it were UTC.
  let guess = new Date(`${params.dateYyyyMmDd}T${params.timeHHmm}:00Z`)

  // Iterate to correct for timezone offset + DST.
  // This converges quickly (typically 1-2 iterations).
  for (let i = 0; i < 6; i++) {
    const got = getZonedYyyyMmDdAndHHmm(guess, params.timeZone)
    const gotDay = ymdToUtcDayNumber(got.yyyyMmDd)
    const gotMin = parseHHmmToMinutes(got.hhmm)
    if (!Number.isFinite(gotDay) || !Number.isFinite(gotMin)) break

    const diffMinutes = (desiredDay - gotDay) * 1440 + (desiredMin - gotMin)
    if (diffMinutes === 0) return guess
    guess = new Date(guess.getTime() + diffMinutes * 60_000)
  }

  return guess
}

/**
 * Compute the UTC ISO range that corresponds to a *local calendar day* in an IANA timezone.
 * The returned interval is [start, end) where end is the next local midnight.
 */
export function zonedDayRangeUtcIso(params: { dateYyyyMmDd: string; timeZone: string }): {
  startUtcIso: string
  endUtcIso: string
} {
  const start = zonedDateTimeToUtc({ dateYyyyMmDd: params.dateYyyyMmDd, timeHHmm: "00:00", timeZone: params.timeZone })
  const next = addDaysYyyyMmDd(params.dateYyyyMmDd, 1)
  const end = zonedDateTimeToUtc({ dateYyyyMmDd: next, timeHHmm: "00:00", timeZone: params.timeZone })
  return { startUtcIso: start.toISOString(), endUtcIso: end.toISOString() }
}

/**
 * Get today's date key (YYYY-MM-DD) in a specific timezone.
 */
export function zonedTodayYyyyMmDd(timeZone: string): string {
  return getZonedYyyyMmDdAndHHmm(new Date(), timeZone).yyyyMmDd
}


