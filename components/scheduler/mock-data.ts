import { withTime } from "./scheduler-utils"

export type InstructorResource = {
  id: string
  name: string
  endorsements?: string
}

export type AircraftResource = {
  id: string
  registration: string
  type: string
}

export type BookingStatus = "confirmed" | "flying" | "complete" | "cancelled"

export type MockBooking = {
  id: string
  startsAt: Date
  endsAt: Date
  studentName: string
  instructorId: string
  aircraftId: string
  status: BookingStatus
}

export const MOCK_INSTRUCTORS: InstructorResource[] = [
  { id: "inst_1", name: "John Smith", endorsements: "IFR, Night" },
  { id: "inst_2", name: "Sarah Johnson", endorsements: "Aerobatics" },
  { id: "inst_3", name: "Mike Chen", endorsements: "Multi, IFR" },
  { id: "inst_4", name: "Priya Nair", endorsements: "Night" },
]

export const MOCK_AIRCRAFT: AircraftResource[] = [
  { id: "ac_1", registration: "ZK-ABC", type: "C172" },
  { id: "ac_2", registration: "ZK-DEF", type: "PA28" },
  { id: "ac_3", registration: "ZK-GHI", type: "C152" },
  { id: "ac_4", registration: "ZK-JKL", type: "DA40" },
]

export function buildMockBookingsForDate(date: Date): MockBooking[] {
  // Keep bookings within 07:00–19:00 and varied durations, like a real flight school day.
  return [
    {
      id: "bk_1001",
      startsAt: withTime(date, 8, 0),
      endsAt: withTime(date, 9, 30),
      studentName: "Alice Brown",
      instructorId: "inst_1",
      aircraftId: "ac_1",
      status: "confirmed",
    },
    {
      id: "bk_1002",
      startsAt: withTime(date, 9, 30),
      endsAt: withTime(date, 10, 30),
      studentName: "Bob Wilson",
      instructorId: "inst_2",
      aircraftId: "ac_2",
      status: "flying",
    },
    {
      id: "bk_1003",
      startsAt: withTime(date, 11, 0),
      endsAt: withTime(date, 12, 0),
      studentName: "Carol Davis",
      instructorId: "inst_1",
      aircraftId: "ac_3",
      status: "confirmed",
    },
    {
      id: "bk_1004",
      startsAt: withTime(date, 13, 0),
      endsAt: withTime(date, 14, 30),
      studentName: "David Lee",
      instructorId: "inst_3",
      aircraftId: "ac_1",
      status: "confirmed",
    },
    {
      id: "bk_1005",
      startsAt: withTime(date, 14, 30),
      endsAt: withTime(date, 16, 0),
      studentName: "Eve Martinez",
      instructorId: "inst_4",
      aircraftId: "ac_4",
      status: "complete",
    },
    {
      id: "bk_1006",
      startsAt: withTime(date, 16, 30),
      endsAt: withTime(date, 18, 0),
      studentName: "Noah Taylor",
      instructorId: "inst_2",
      aircraftId: "ac_2",
      status: "confirmed",
    },
  ]
}


