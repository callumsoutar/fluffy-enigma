export type TimelineConfig = {
  /** 0-23 */
  startHour: number
  /** 1-24, must be > startHour */
  endHour: number
  /** e.g. 30 */
  intervalMinutes: number
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

export function minutesFromMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

export function withTime(baseDate: Date, hour: number, minute: number) {
  const d = new Date(baseDate)
  d.setHours(hour, minute, 0, 0)
  return d
}

export function roundToInterval(minutes: number, intervalMinutes: number) {
  return Math.round(minutes / intervalMinutes) * intervalMinutes
}

export function formatTimeLabel(d: Date) {
  // 08:30 (24h) reads cleanly in aviation contexts
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

export function formatTimeRangeLabel(start: Date, end: Date) {
  return `${formatTimeLabel(start)}–${formatTimeLabel(end)}`
}

export function buildTimeSlots(date: Date, config: TimelineConfig) {
  const { startHour, endHour, intervalMinutes } = config
  const start = withTime(date, startHour, 0)
  const end = withTime(date, endHour, 0)

  const slots: Date[] = []
  for (let t = new Date(start); t < end; t = new Date(t.getTime() + intervalMinutes * 60_000)) {
    slots.push(t)
  }

  return {
    slots,
    start,
    end,
    spanMinutes: (end.getTime() - start.getTime()) / 60_000,
  }
}

export function getBookingLayout({
  bookingStart,
  bookingEnd,
  timelineStart,
  timelineEnd,
}: {
  bookingStart: Date
  bookingEnd: Date
  timelineStart: Date
  timelineEnd: Date
}) {
  const startMs = timelineStart.getTime()
  const endMs = timelineEnd.getTime()
  const spanMs = endMs - startMs

  const bStart = bookingStart.getTime()
  const bEnd = bookingEnd.getTime()

  // Outside range
  if (bEnd <= startMs || bStart >= endMs) return null

  // Clamp to visible range
  const visibleStart = clamp(bStart, startMs, endMs)
  const visibleEnd = clamp(bEnd, startMs, endMs)

  const leftPct = ((visibleStart - startMs) / spanMs) * 100
  const widthPct = ((visibleEnd - visibleStart) / spanMs) * 100

  return {
    leftPct,
    widthPct,
    isClippedStart: bStart < startMs,
    isClippedEnd: bEnd > endMs,
  }
}


