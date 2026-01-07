import test from "node:test"
import assert from "node:assert/strict"

import {
  dayOfWeekFromYyyyMmDd,
  getZonedYyyyMmDdAndHHmm,
  zonedDateTimeToUtc,
  zonedDayRangeUtcIso,
} from "./timezone.ts"

test("getZonedYyyyMmDdAndHHmm converts UTC instant to Pacific/Auckland local parts (DST-safe)", () => {
  // 2026-01-07 is summer time in NZ (typically UTC+13).
  // 09:00 on 2026-01-07 local should be 20:00Z on 2026-01-06.
  const startUtc = new Date("2026-01-06T20:00:00Z")
  const endUtc = new Date("2026-01-06T21:00:00Z")

  const startLocal = getZonedYyyyMmDdAndHHmm(startUtc, "Pacific/Auckland")
  const endLocal = getZonedYyyyMmDdAndHHmm(endUtc, "Pacific/Auckland")

  assert.deepEqual(startLocal, { yyyyMmDd: "2026-01-07", hhmm: "09:00" })
  assert.deepEqual(endLocal, { yyyyMmDd: "2026-01-07", hhmm: "10:00" })
})

test("dayOfWeekFromYyyyMmDd returns JS day index (0=Sun..6=Sat)", () => {
  // 2026-01-07 is Wednesday
  assert.equal(dayOfWeekFromYyyyMmDd("2026-01-07"), 3)
})

test("zonedDayRangeUtcIso returns 25h day when NZDT -> NZST ends (fall back)", () => {
  // NZ DST ends on Sunday 2026-04-05 (clock goes back, local day is 25h).
  const r = zonedDayRangeUtcIso({ dateYyyyMmDd: "2026-04-05", timeZone: "Pacific/Auckland" })
  const hours = (new Date(r.endUtcIso).getTime() - new Date(r.startUtcIso).getTime()) / 3_600_000
  assert.equal(hours, 25)
})

test("zonedDayRangeUtcIso returns 23h day when NZST -> NZDT starts (spring forward)", () => {
  // NZ DST starts on Sunday 2026-09-27 (clock goes forward, local day is 23h).
  const r = zonedDayRangeUtcIso({ dateYyyyMmDd: "2026-09-27", timeZone: "Pacific/Auckland" })
  const hours = (new Date(r.endUtcIso).getTime() - new Date(r.startUtcIso).getTime()) / 3_600_000
  assert.equal(hours, 23)
})

test("zonedDateTimeToUtc maps a school-local wall-clock time to the correct UTC instant", () => {
  const utc = zonedDateTimeToUtc({
    dateYyyyMmDd: "2026-01-07",
    timeHHmm: "09:00",
    timeZone: "Pacific/Auckland",
  })
  assert.equal(utc.toISOString(), "2026-01-06T20:00:00.000Z")
})

test("zonedDayRangeUtcIso produces correct day boundaries for a local calendar day", () => {
  const r = zonedDayRangeUtcIso({ dateYyyyMmDd: "2026-01-07", timeZone: "Pacific/Auckland" })
  // NZDT is typically UTC+13, so local midnight is 11:00Z on the previous day.
  assert.equal(r.startUtcIso, "2026-01-06T11:00:00.000Z")
  assert.equal(r.endUtcIso, "2026-01-07T11:00:00.000Z")
})


