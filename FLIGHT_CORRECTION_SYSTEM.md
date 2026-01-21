# Flight Correction System - Implementation Guide

## Overview

The Flight Correction System allows admins and owners to correct meter readings for already-approved flight bookings. The system uses delta-of-deltas logic to ensure aircraft total time in service (TTIS) remains accurate across corrections.

## Components

### 1. Backend (Already Exists)

**RPC Function:** `correct_booking_checkin_ttis_atomic`
- **Location:** `supabase/migrations/012_aircraft_ttis_delta_tracking.sql` (lines 720-905)
- **Purpose:** Atomically applies corrections to booking meter readings and aircraft TTIS
- **Parameters:**
  - `p_booking_id`: UUID of the booking to correct
  - `p_hobbs_end`: New hobbs end value (nullable)
  - `p_tach_end`: New tach end value (nullable)
  - `p_airswitch_end`: New airswitch end value (nullable)
  - `p_correction_reason`: Required text explanation (3-1000 characters)

**API Route:** `/api/bookings/[id]/checkin/correct`
- **Location:** `app/api/bookings/[id]/checkin/correct/route.ts`
- **Method:** POST
- **Auth:** Requires owner/admin/instructor role
- **Validation:** Zod schema enforces data types and constraints

### 2. Frontend Component (New)

**Component:** `FlightCorrectionDialog`
- **Location:** `components/bookings/FlightCorrectionDialog.tsx`
- **Purpose:** Provides UI for correcting flight meter readings
- **Features:**
  - Shows current vs. new meter readings side-by-side
  - Calculates delta changes in real-time
  - Displays aircraft TTIS impact preview
  - Requires correction reason (minimum 10 characters)
  - Shows correction history if booking was previously corrected
  - Locks start values (immutable for delta calculation)

## Integration into Check-In Page

Add the following to `/app/bookings/[id]/checkin/page.tsx`:

### Step 1: Import the Dialog Component

```typescript
import { FlightCorrectionDialog } from "@/components/bookings/FlightCorrectionDialog"
```

### Step 2: Add State Management

Add near the other state declarations (around line 186):

```typescript
// Correction dialog state
const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = React.useState(false)
```

### Step 3: Add Correction Mutation

Add after the `approveMutation` (around line 1130):

```typescript
const correctionMutation = useMutation({
  mutationFn: async (data: {
    hobbs_end?: number | null
    tach_end?: number | null
    airswitch_end?: number | null
    correction_reason: string
  }) => {
    return fetchJson(`/api/bookings/${bookingId}/checkin/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
    await queryClient.invalidateQueries({ queryKey: ["bookings"] })
    toast.success("Flight correction applied successfully")
  },
  onError: (error) => {
    toast.error(getErrorMessage(error))
  },
})
```

### Step 4: Add "Correct Flight" Button

Add this button in the header actions area (around line 1378), conditionally shown for approved bookings:

```typescript
const headerActions = isAdminOrInstructor && (
  <div className="flex items-center gap-2 sm:gap-3">
    {isApproved && role && ['owner', 'admin'].includes(role) && (
      <Button
        size="sm"
        variant="outline"
        className="h-9 px-4 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950"
        onClick={() => setIsCorrectionDialogOpen(true)}
      >
        <IconEdit className="h-4 w-4 mr-2" />
        Correct Flight
      </Button>
    )}
    
    {/* Existing buttons for unapproved bookings */}
    {!isApproved && (
      <Button
        onClick={void handleSubmit(async (data) => {
          // ... existing approve logic
        })}
        disabled={!canApprove}
        className="bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all h-10 px-6 font-semibold"
      >
        <IconCheck className="h-5 w-5 mr-2" />
        Approve Check-In
      </Button>
    )}
  </div>
)
```

### Step 5: Add Correction Badge (Optional)

Add this badge to show when a booking has been corrected (in the header extra section, around line 1380):

```typescript
extra={(
  <>
    {!isApproved && (
      <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 rounded-full text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5">
        Check-In In Progress
      </Badge>
    )}
    {isApproved && booking.corrected_at && (
      <Badge variant="outline" className="bg-amber-50/50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 rounded-full text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5">
        Corrected
      </Badge>
    )}
  </>
)}
```

### Step 6: Add the Dialog Component

Add at the end of the component's JSX, before the closing tags (around line 2980):

```typescript
{/* Flight Correction Dialog */}
{booking && isApproved && role && ['owner', 'admin'].includes(role) && (
  <FlightCorrectionDialog
    booking={booking}
    open={isCorrectionDialogOpen}
    onOpenChange={setIsCorrectionDialogOpen}
    onCorrect={async (data) => {
      await correctionMutation.mutateAsync(data)
    }}
    isSubmitting={correctionMutation.isPending}
  />
)}
```

### Step 7: Add Icon Import

Add to the icon imports at the top:

```typescript
import { IconEdit } from "@tabler/icons-react"
```

## Usage Flow

### For Admin/Owner:

1. **Navigate to Check-In Page** of an approved booking
2. **Click "Correct Flight"** button in the header
3. **Correction Dialog Opens** showing:
   - Current meter readings (locked start values)
   - Editable end values
   - Real-time delta change calculations
   - Aircraft TTIS impact preview
   - Previous correction history (if any)
4. **Adjust Values**:
   - Modify hobbs_end, tach_end, or airswitch_end as needed
   - See immediate feedback on delta changes
   - See how it affects aircraft total time
5. **Enter Correction Reason**:
   - Required field (minimum 10 characters)
   - Will be permanently logged for audit
6. **Click "Apply Correction"**:
   - System validates inputs
   - Calls RPC function with atomic transaction
   - Updates booking and aircraft TTIS
   - Logs correction metadata (timestamp, user, reason)
7. **Success**: Page refreshes showing corrected values

### Backend Process:

1. **Validation**:
   - Check user has owner/admin/instructor role
   - Verify booking is approved
   - Ensure correction reason is provided
   - Validate meter readings are not negative

2. **Calculation**:
   - Calculate new deltas from start values + new end values
   - Compute new applied delta using aircraft's total_time_method
   - Calculate correction delta (new_applied_delta - old_applied_delta)

3. **Atomic Update**:
   - Lock booking row FOR UPDATE
   - Lock aircraft row FOR UPDATE
   - Update aircraft.total_time_in_service += correction_delta
   - Update booking with:
     - New end values
     - New deltas
     - New applied_aircraft_delta
     - correction_delta
     - corrected_at timestamp
     - corrected_by user_id
     - correction_reason

4. **Commit**: Transaction commits or rolls back entirely

## Data Model

### Booking Fields Added for Corrections

```sql
-- From migration 012_aircraft_ttis_delta_tracking.sql
applied_aircraft_delta numeric          -- Delta applied to aircraft TTIS
applied_total_time_method text          -- Method used (for deterministic recalculation)
correction_delta numeric                -- Delta-of-deltas from correction
corrected_at timestamptz                -- When correction was made
corrected_by uuid                       -- Who made the correction
correction_reason text                  -- Why correction was needed
```

### Aircraft Fields

```sql
total_time_in_service numeric NOT NULL  -- Authoritative aircraft TTIS
total_time_method text                  -- Method for calculating TTIS (hobbs, tacho, etc.)
```

## Safety Features

### Immutability Protection

The `prevent_approved_checkin_mutations()` trigger prevents:
- Direct updates to approved bookings
- Changes to financial/billing fields
- Unauthorized modifications

**Exception:** Corrections with proper metadata (corrected_at, corrected_by, correction_reason)

### Validation

1. **API Level**:
   - Zod schema validation
   - Role-based access control
   - Booking approval status check

2. **Database Level**:
   - Non-negative constraint on TTIS
   - Validation trigger for large TTIS decreases
   - Required correction metadata fields

3. **Application Level**:
   - Real-time delta calculation
   - User confirmation required
   - Clear visual feedback

### Audit Trail

Every correction records:
- Who made the correction (corrected_by)
- When it was made (corrected_at)
- Why it was made (correction_reason)
- What changed (correction_delta)
- Complete before/after values

## Testing Recommendations

### Happy Path

1. Approve a flight booking
2. Click "Correct Flight"
3. Change hobbs_end from 1120 to 1121
4. Enter reason: "Instructor recorded incorrect meter reading"
5. Verify delta change shows +1.0
6. Verify TTIS impact shows (if hobbs method)
7. Click "Apply Correction"
8. Verify booking updates
9. Verify aircraft TTIS increases by 1.0

### Edge Cases

1. **Decrease Meter Reading**:
   - Change end value to less than originally recorded
   - Verify negative delta shown
   - Verify aircraft TTIS decreases correctly

2. **Multiple Corrections**:
   - Correct same booking twice
   - Verify correction history shows
   - Verify each correction properly accumulates

3. **Different Methods**:
   - Test with aircraft using "hobbs" method
   - Test with aircraft using "tacho" method
   - Test with aircraft using "hobbs less 5%" method
   - Verify correct meter is used for TTIS calculation

4. **Validation Failures**:
   - Try correction without reason
   - Try with reason too short (<10 chars)
   - Try with negative meter values
   - Try as student user (should be blocked)

### Security Testing

1. Attempt correction as student → Should be rejected
2. Attempt correction on unapproved booking → Should be rejected
3. Attempt correction on cancelled booking → Should be rejected
4. Attempt direct database update → Should be blocked by trigger

## Troubleshooting

### Correction Fails

**Symptom:** "Booking is missing applied_aircraft_delta"
**Cause:** Booking was approved before migration 012
**Fix:** Manually backfill `applied_aircraft_delta` and `applied_total_time_method`

**Symptom:** "Aircraft TTIS cannot decrease by more than 5 hours"
**Cause:** Validation trigger blocking large decreases
**Fix:** If legitimate, temporarily disable trigger or use direct SQL with justification

**Symptom:** "Correction would result in negative aircraft TTIS"
**Cause:** Correction delta would make aircraft TTIS negative
**Fix:** Review aircraft baseline and all flight history; may indicate data corruption

### UI Issues

**Symptom:** "Correct Flight" button not showing
**Check:**
- User has admin or owner role
- Booking is approved (checkin_approved_at is not null)
- Integration step 4 was completed

**Symptom:** Dialog shows incorrect deltas
**Check:**
- Start values are properly locked
- Form is resetting on dialog open
- Calculations use booking.hobbs_start, not hobbs_end

## Future Enhancements

1. **Correction History Tab**:
   - Show all corrections for a booking
   - Display before/after values
   - Show who made each correction

2. **Bulk Corrections**:
   - Correct multiple bookings at once
   - Import corrections from CSV
   - Apply systematic corrections (e.g., "all flights on 2026-01-15 -0.1h")

3. **Correction Approval Workflow**:
   - Require owner approval for large corrections
   - Two-person rule for corrections > 1 hour
   - Email notifications for corrections

4. **Advanced Validation**:
   - Warn if correction creates unrealistic flight time
   - Check against aircraft max hours per day
   - Validate against booking duration

5. **Correction Reports**:
   - Export correction audit log
   - Analysis of correction patterns
   - Alert for frequent corrections (may indicate training issue)

## Related Documentation

- [Aircraft TTIS Bug Fix Summary](./AIRCRAFT_TTIS_BUG_FIX_SUMMARY.md)
- Database migration: `supabase/migrations/012_aircraft_ttis_delta_tracking.sql`
- Validation safeguards: `supabase/migrations/025_aircraft_ttis_validation_safeguards.sql`

## Questions?

For implementation support, refer to:
- The correction RPC source code (lines 720-905 in migration 012)
- The existing check-in approval flow (for comparison)
- The correction API route (`app/api/bookings/[id]/checkin/correct/route.ts`)
