import test from "node:test"
import assert from "node:assert/strict"

import { buildRosteredInstructorIdsForInterval } from "./availability.ts"
import type { RosterRule } from "../types/roster"

test("buildRosteredInstructorIdsForInterval includes instructor when interval is within roster window", () => {
  const instructorId = "8185f631-0430-4f64-842d-b9e958b2a429"

  const rules: RosterRule[] = [
    {
      id: "e5ea482b-4518-4cf8-a271-432cefd398a0",
      instructor_id: instructorId,
      day_of_week: 3,
      start_time: "07:30:00",
      end_time: "22:00:00",
      is_active: true,
      effective_from: "2026-01-07",
      effective_until: "2026-01-07",
      notes: null,
      created_at: "2026-01-07T00:35:50.354666+00",
      updated_at: "2026-01-07T00:35:50.354666+00",
      voided_at: null,
    },
  ]

  const rostered = buildRosteredInstructorIdsForInterval({
    rules,
    startHHmm: "11:00",
    endHHmm: "12:00",
  })

  assert.equal(rostered.has(instructorId), true)
})


