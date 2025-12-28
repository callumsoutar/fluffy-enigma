# Flight History Refactor - Bookings Table Migration

## Overview
Refactored the member flight history feature to use the `bookings` table with correct field references instead of the legacy `flight-logs` table.

## Date
December 28, 2025

## Changes Made

### 1. API Endpoint Update
**File:** `app/api/members/[id]/flight-history/route.ts`

#### Key Changes:
- **Corrected Aircraft Reference**: Changed from `aircraft_id` to `checked_out_aircraft_id`
- **Corrected Instructor Reference**: Changed from `instructor_id` to `checked_out_instructor_id`
- **Updated Foreign Key Syntax**: Used explicit foreign key references with `!` notation

#### Rationale:
The `bookings` table has two sets of fields:
- **Scheduled fields** (`aircraft_id`, `instructor_id`): The planned/scheduled aircraft and instructor
- **Checked-out fields** (`checked_out_aircraft_id`, `checked_out_instructor_id`): The actual aircraft and instructor used for the flight

For flight history, we need to show the **actual** aircraft and instructor that were used, not the scheduled ones, as these may differ from what was originally planned.

### 2. Query Details

#### Before:
```typescript
.select(`
  id,
  user_id,
  start_time,
  end_time,
  status,
  purpose,
  flight_time,
  aircraft:aircraft_id (
    id,
    registration
  ),
  instructor:instructors!instructor_id (
    id,
    first_name,
    last_name
  ),
  flight_type:flight_type_id (
    id,
    name
  ),
  lesson:lesson_id (
    id,
    name
  )
`)
```

#### After:
```typescript
.select(`
  id,
  user_id,
  start_time,
  end_time,
  status,
  purpose,
  flight_time,
  aircraft:aircraft!checked_out_aircraft_id (
    id,
    registration
  ),
  instructor:instructors!checked_out_instructor_id (
    id,
    user_id,
    first_name,
    last_name
  ),
  flight_type:flight_types (
    id,
    name
  ),
  lesson:lessons (
    id,
    name
  )
`)
```

### 3. Filter Criteria
The query filters for completed flights:
- `status = 'complete'`
- `flight_time IS NOT NULL`
- `user_id = [memberId]`

Results are ordered by `end_time` descending (most recent first).

### 4. Frontend Components
**No changes required** to the following components as they already use the correct type interfaces:
- `components/members/member-flight-history-tab.tsx`
- `lib/types/flight-history.ts`

The frontend component correctly displays:
- Flight date (from `end_time`)
- Aircraft registration (from checked-out aircraft)
- Instructor name (from checked-out instructor, or "Solo" if null)
- Flight description (from lesson name, flight type, or purpose)
- Flight time in hours

## Database Schema Reference

### Bookings Table Relevant Fields:
```sql
-- Scheduled (original booking)
aircraft_id              uuid NOT NULL
instructor_id            uuid NULL

-- Actual (what was used)
checked_out_aircraft_id  uuid NULL
checked_out_instructor_id uuid NULL

-- Flight data
status                   booking_status NOT NULL DEFAULT 'unconfirmed'
flight_time              numeric NULL
start_time               timestamptz NOT NULL
end_time                 timestamptz NOT NULL
purpose                  text NOT NULL DEFAULT 'Flight'

-- Related data
flight_type_id           uuid NULL
lesson_id                uuid NULL
```

### Foreign Key Constraints:
- `bookings_checked_out_aircraft_id_fkey` → `aircraft(id)`
- `bookings_checked_out_instructor_id_fkey` → `instructors(id)`

## Testing

### SQL Verification Query:
```sql
SELECT 
  b.id,
  b.user_id,
  b.start_time,
  b.end_time,
  b.status,
  b.purpose,
  b.flight_time,
  a.registration as aircraft_registration,
  i.first_name || ' ' || i.last_name as instructor_name,
  ft.name as flight_type_name,
  l.name as lesson_name
FROM bookings b
LEFT JOIN aircraft a ON b.checked_out_aircraft_id = a.id
LEFT JOIN instructors i ON b.checked_out_instructor_id = i.id
LEFT JOIN flight_types ft ON b.flight_type_id = ft.id
LEFT JOIN lessons l ON b.lesson_id = l.id
WHERE b.status = 'complete'
  AND b.flight_time IS NOT NULL
ORDER BY b.end_time DESC;
```

### Test Cases Covered:
1. ✅ Flights with instructor (dual instruction)
2. ✅ Solo flights (null `checked_out_instructor_id`)
3. ✅ Flights with lessons
4. ✅ Flights with flight types
5. ✅ Proper ordering by end_time

## Security
- Authentication required (user must be logged in)
- Authorization required (owner/admin/instructor roles only)
- RLS policies enforced at database level
- Member ID validated with Zod schema

## Performance Considerations
- Query uses proper indexes on foreign keys
- Filters applied before joins
- Results ordered at database level
- Efficient LEFT JOINs for optional relationships

## Migration Notes
- **No data migration required** - this is a query-only change
- The `flight_logs` table still exists but is no longer used for this feature
- All existing completed bookings with `flight_time` will appear in flight history
- Historical data integrity maintained

## Related Files
- `/app/api/members/[id]/flight-history/route.ts` - API endpoint (modified)
- `/components/members/member-flight-history-tab.tsx` - Frontend component (no changes)
- `/lib/types/flight-history.ts` - TypeScript types (no changes)
- `/app/members/[id]/page.tsx` - Member detail page (no changes)

## Future Enhancements
Consider adding:
- Filtering by date range (already implemented in frontend)
- Filtering by aircraft type
- Filtering by instructor
- Export to CSV/PDF for logbook purposes
- Summary statistics (total hours by aircraft type, etc.)

