# Timezone & Date/Time Strategy (Canonical)

## Goals
- **One consistent strategy** for all timestamps and date-only concepts.
- **DST-safe** for New Zealand transitions (NZDT ↔ NZST) without “magic offsets”.
- **Explicit timezone intent** everywhere (no accidental server-local or browser-local interpretation).

## Canonical Model

### 1) Database (Postgres / Supabase)
- **All instants are stored as UTC** (`timestamptz`), e.g. `bookings.start_time`, `bookings.end_time`, `invoices.issue_date`.
- **Date-only fields remain date-only** (strings like `YYYY-MM-DD`), e.g. roster rule `effective_from` / `effective_until`.
- **Local wall-clock times remain wall-clock** for roster rules (e.g. `07:30:00`), and must always be interpreted in the **school timezone**.

### 2) Business Logic
- Any **comparison of instants** (overlaps, ordering, duration) is done using UTC instants.
- Any **local-calendar** concept (roster `day_of_week`, “today”, “this local day”) is derived using an **explicit IANA timezone**:
  - **School timezone** (default): `Pacific/Auckland`
  - Never rely on runtime defaults (server local timezone, browser local timezone).

### 3) Frontend
- UI should treat “day” and “roster rules” as **school-local**, not browser-local.
- Display should format instants using the **school timezone** for consistency across users.

## Required Input Formats (API)

### ISO “Instant” timestamps
All API inputs representing instants must include timezone information:
- ✅ `2026-01-07T00:35:50Z`
- ✅ `2026-01-07T13:35:50+13:00`
- ❌ `2026-01-07T13:35` (ambiguous, could be interpreted as local or UTC)

This is enforced via `lib/validation/iso-instant.ts`.

## Shared Utilities

### `lib/utils/timezone.ts`
This module implements DST-safe conversions using `Intl.DateTimeFormat(..., { timeZone }).formatToParts`:
- Convert UTC instant → zoned parts (`YYYY-MM-DD`, `HH:mm`) via `getZonedYyyyMmDdAndHHmm`.
- Convert zoned local day → UTC range (`[start, end)`), respecting 23/25 hour days via `zonedDayRangeUtcIso`.
- Convert zoned wall-clock time → UTC instant (iterative, DST-safe) via `zonedDateTimeToUtc`.
- Add calendar days to a date-only string safely via `addDaysYyyyMmDd` (no 24h-millisecond math).

### `lib/roster/availability.ts`
Single source of truth for roster window parsing and interval containment checks.

## What Was Fixed (Timezone/DST Risks)

### Booking + Roster enforcement
- Server-side roster checks now convert booking instants into **school-local date + HH:mm** before querying roster rules.
  - Files: `app/api/bookings/route.ts`, `app/api/bookings/batch/route.ts`

### Scheduler day boundaries
- Scheduler queries now compute day boundaries using an explicit timezone (`Pacific/Auckland`) instead of `setHours(0,0,0,0)` + `toISOString()`.
  - File: `components/scheduler/resource-timeline-scheduler.tsx`

### Bookings “Today” filter
- “Today” is now computed as **school-local** day range (DST-safe, timezone explicit).
  - File: `app/bookings/page.tsx`

### Bookings grouping / headers
- Bookings list groups by **school-local date**, not UTC date derived from `toISOString().split("T")[0]`.
  - File: `components/bookings/bookings-table.tsx`

### Roster Scheduler effective date handling
- `effective_from` / `effective_until` are treated as **date-only strings** and compared as strings (lexicographically), avoiding `new Date(...)` implicit timezone shifts.
  - File: `components/rosters/roster-scheduler.tsx`

### Validation hardening
- Booking / flight-log / invoice timestamp inputs must include timezone offset. No more appending `Z` to “short” datetimes.
  - Files: `lib/validation/bookings.ts`, `lib/validation/flight-logs.ts`, `lib/validation/invoices.ts`, `lib/validation/iso-instant.ts`

## Remaining Work / Follow-ups

### 1) Make school timezone configurable everywhere (not hardcoded)
Client time logic must not depend on admin-only settings APIs. We now expose a minimal safe config via:
- `GET /api/public-config` (auth required): timezone + business hours
- Hook: `lib/hooks/use-school-config.ts`
This uses the service-role client server-side to avoid coupling app correctness to settings-table RLS.

### 2) Audit remaining UI formatting
Many components use `date-fns` `format(...)` which formats in browser-local time. For strict consistency, introduce
UI helpers that format using `Intl.DateTimeFormat(..., { timeZone: schoolTz })`.

## Guardrails (Do / Don’t)

- **Do**: treat date-only strings as date-only; compare them as strings (`YYYY-MM-DD`) or via UTC day numbers.
- **Do**: require timezone/offset on all “instant” inputs.
- **Do**: compute local day ranges via `zonedDayRangeUtcIso` (DST-safe).
- **Don’t**: `new Date("YYYY-MM-DD")` or `new Date("YYYY-MM-DDTHH:mm")` (implicit timezone interpretation varies).
- **Don’t**: add hardcoded `+12/+13` offsets.


