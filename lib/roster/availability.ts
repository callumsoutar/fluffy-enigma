import type { RosterRule } from "../types/roster"

export type MinutesWindow = { startMin: number; endMin: number }

export function parseTimeToMinutes(time: string): number | null {
  // Accepts "HH:MM" or "HH:MM:SS"
  const [hhRaw, mmRaw] = time.split(":")
  const hh = Number(hhRaw)
  const mm = Number(mmRaw)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

export function ruleToWindow(rule: Pick<RosterRule, "start_time" | "end_time">): MinutesWindow | null {
  const startMin = parseTimeToMinutes(rule.start_time)
  const endMin = parseTimeToMinutes(rule.end_time)
  if (startMin === null || endMin === null) return null
  if (endMin <= startMin) return null
  return { startMin, endMin }
}

/**
 * For point-in-time checks (scheduler grid):
 * - start inclusive
 * - end exclusive
 */
export function isMinuteWithinWindow(mins: number, w: MinutesWindow) {
  return mins >= w.startMin && mins < w.endMin
}

/**
 * For interval checks (booking validation):
 * - requires the rule to fully contain the interval
 * - start inclusive
 * - end inclusive (so a booking ending at 22:00 is allowed if rule ends at 22:00)
 */
export function doesWindowContainInterval(w: MinutesWindow, startMin: number, endMin: number) {
  return w.startMin <= startMin && w.endMin >= endMin
}

export function buildInstructorAvailabilityMap(rules: RosterRule[]) {
  const map = new Map<string, MinutesWindow[]>()
  for (const r of rules) {
    if (!r.is_active || r.voided_at) continue
    const w = ruleToWindow(r)
    if (!w) continue
    const existing = map.get(r.instructor_id) ?? []
    existing.push(w)
    map.set(r.instructor_id, existing)
  }
  return map
}

export function buildRosteredInstructorIdsForInterval(params: {
  rules: RosterRule[]
  startHHmm: string
  endHHmm: string
}) {
  const startMin = parseTimeToMinutes(params.startHHmm)
  const endMin = parseTimeToMinutes(params.endHHmm)
  if (startMin === null || endMin === null) return new Set<string>()

  const eligible = new Set<string>()
  for (const r of params.rules) {
    if (!r.is_active || r.voided_at) continue
    const w = ruleToWindow(r)
    if (!w) continue
    if (doesWindowContainInterval(w, startMin, endMin)) eligible.add(r.instructor_id)
  }
  return eligible
}


