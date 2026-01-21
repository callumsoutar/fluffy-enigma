/**
 * FLIGHT CORRECTION SYSTEM - INTEGRATION EXAMPLE
 * 
 * This file shows the exact code snippets to add to your check-in page
 * to enable the flight correction system.
 * 
 * File to modify: app/bookings/[id]/checkin/page.tsx
 */

// ========================================
// STEP 1: Add Imports (at the top of the file)
// ========================================

import { FlightCorrectionDialog } from "@/components/bookings/FlightCorrectionDialog"
import { useFlightCorrection } from "@/hooks/useFlightCorrection"
import { IconEdit } from "@tabler/icons-react"

// ========================================
// STEP 2: Add Hook (inside the component, after existing hooks)
// ========================================

// Around line 260, after other hooks
const {
  isCorrectionDialogOpen,
  openCorrectionDialog,
  closeCorrectionDialog,
  correctFlight,
  isSubmitting: isCorrecting,
} = useFlightCorrection({
  bookingId,
  onSuccess: () => {
    // Optional: Add any additional logic after successful correction
    console.log('Flight corrected successfully')
  },
})

// ========================================
// STEP 3: Update Header Actions (around line 1370)
// ========================================

// BEFORE (existing code):
const headerActions = isAdminOrInstructor && !isApproved && (
  <Button
    onClick={void handleSubmit(async (data) => {
      // ... existing approve logic
    })}
    disabled={!canApprove}
    className="bg-green-600 hover:bg-green-700"
  >
    <IconCheck className="h-5 w-5 mr-2" />
    Approve Check-In
  </Button>
)

// AFTER (updated code):
const headerActions = isAdminOrInstructor && (
  <div className="flex items-center gap-2 sm:gap-3">
    {/* Correction button - shown only for approved bookings and admin/owner */}
    {isApproved && (role === 'owner' || role === 'admin') && (
      <Button
        size="sm"
        variant="outline"
        className="h-9 px-4 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950"
        onClick={openCorrectionDialog}
        disabled={isCorrecting}
      >
        <IconEdit className="h-4 w-4 mr-2" />
        Correct Flight
      </Button>
    )}

    {/* Approve button - shown only for unapproved bookings */}
    {!isApproved && (
      <Button
        onClick={void handleSubmit(async (data) => {
          // ... existing approve logic (keep as is)
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

// ========================================
// STEP 4: Add Correction Badge (around line 1380 - optional but recommended)
// ========================================

// BEFORE (existing code):
extra={!isApproved && (
  <Badge variant="outline" className="bg-blue-50/50 text-blue-700">
    Check-In In Progress
  </Badge>
)}

// AFTER (updated code):
extra={(
  <>
    {!isApproved && (
      <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 rounded-full text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5">
        Check-In In Progress
      </Badge>
    )}
    {isApproved && booking.corrected_at && (
      <Badge variant="outline" className="bg-amber-50/50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 rounded-full text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 flex items-center gap-1">
        <IconEdit className="h-3 w-3" />
        Corrected
      </Badge>
    )}
  </>
)}

// ========================================
// STEP 5: Add Correction History Display (optional - in billing section)
// ========================================

// Add this inside the billing collapsible content, after the meter readings
{booking.corrected_at && (
  <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-4">
    <div className="flex items-start gap-3">
      <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-2">
        <IconInfoCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Flight Corrected
        </div>
        <div className="text-xs text-amber-700 dark:text-amber-300">
          <div>
            <span className="font-medium">When:</span>{" "}
            {new Date(booking.corrected_at).toLocaleString('en-NZ', {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}
          </div>
          {booking.correction_delta && (
            <div className="mt-1">
              <span className="font-medium">Delta Applied:</span>{" "}
              <span className={`font-mono font-semibold ${
                booking.correction_delta > 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}>
                {booking.correction_delta > 0 ? "+" : ""}
                {booking.correction_delta.toFixed(2)}h
              </span>
            </div>
          )}
          {booking.correction_reason && (
            <div className="mt-1">
              <span className="font-medium">Reason:</span>{" "}
              {booking.correction_reason}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}

// ========================================
// STEP 6: Add Dialog Component (at the end of JSX, before closing tags)
// ========================================

// Around line 2980, before the closing </SidebarInset>
{booking && isApproved && (role === 'owner' || role === 'admin') && (
  <FlightCorrectionDialog
    booking={booking}
    open={isCorrectionDialogOpen}
    onOpenChange={(open) => {
      if (open) {
        openCorrectionDialog()
      } else {
        closeCorrectionDialog()
      }
    }}
    onCorrect={correctFlight}
    isSubmitting={isCorrecting}
  />
)}

// ========================================
// COMPLETE! The correction system is now integrated.
// ========================================

/**
 * VERIFICATION CHECKLIST:
 * 
 * ✅ Imports added
 * ✅ useFlightCorrection hook added
 * ✅ Header actions updated to show "Correct Flight" button
 * ✅ Badge shows "Corrected" status (optional)
 * ✅ Correction history display added (optional)
 * ✅ FlightCorrectionDialog component added
 * 
 * TESTING:
 * 
 * 1. Log in as admin or owner
 * 2. Navigate to an approved booking's check-in page
 * 3. You should see "Correct Flight" button in header
 * 4. Click button to open correction dialog
 * 5. Modify meter end values
 * 6. See delta changes update in real-time
 * 7. Enter correction reason
 * 8. Click "Apply Correction"
 * 9. Verify booking updates with new values
 * 10. Verify "Corrected" badge appears
 * 11. Check aircraft total time updated correctly
 * 
 * TROUBLESHOOTING:
 * 
 * - If button doesn't show: Check user role is admin or owner
 * - If correction fails: Check API route permissions
 * - If TTIS doesn't update: Check aircraft has total_time_method set
 * - If form validation fails: Check meter end >= meter start
 */

export {}
