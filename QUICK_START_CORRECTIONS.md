# Flight Corrections - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Add Imports
```typescript
// Add to app/bookings/[id]/checkin/page.tsx (top of file)
import { FlightCorrectionDialog } from "@/components/bookings/FlightCorrectionDialog"
import { useFlightCorrection } from "@/hooks/useFlightCorrection"
import { IconEdit } from "@tabler/icons-react"
```

### Step 2: Add Hook
```typescript
// Add inside component (around line 260)
const {
  isCorrectionDialogOpen,
  openCorrectionDialog,
  closeCorrectionDialog,
  correctFlight,
  isSubmitting: isCorrecting,
} = useFlightCorrection({ bookingId })
```

### Step 3: Add Button
```typescript
// Update headerActions to include correction button
{isApproved && (role === 'owner' || role === 'admin') && (
  <Button onClick={openCorrectionDialog}>
    <IconEdit className="h-4 w-4 mr-2" />
    Correct Flight
  </Button>
)}
```

### Step 4: Add Dialog
```typescript
// Add at end of JSX (around line 2980)
{booking && isApproved && (role === 'owner' || role === 'admin') && (
  <FlightCorrectionDialog
    booking={booking}
    open={isCorrectionDialogOpen}
    onOpenChange={closeCorrectionDialog}
    onCorrect={correctFlight}
    isSubmitting={isCorrecting}
  />
)}
```

## ✅ Done!

Test it:
1. Navigate to an approved booking's check-in page
2. Click "Correct Flight" button
3. Modify meter end values
4. Enter correction reason
5. Click "Apply Correction"

## 📚 Full Documentation

- **Complete Guide:** `FLIGHT_CORRECTION_SYSTEM.md`
- **Code Example:** `FLIGHT_CORRECTION_INTEGRATION_EXAMPLE.tsx`
- **Summary:** `CORRECTION_SYSTEM_SUMMARY.md`

## 🔒 Security

- ✅ Only admins and owners can correct
- ✅ Requires correction reason
- ✅ Complete audit trail
- ✅ Database-level immutability protection

## 🎯 Key Features

- Real-time delta calculations
- Aircraft TTIS impact preview
- Correction history display
- Mobile-responsive UI
- Dark mode support

## 💡 Pro Tips

1. **Start values are locked** - Only end values can be corrected
2. **Delta-of-deltas** - System calculates the difference, not absolute values
3. **Audit trail** - Every correction is logged with who, when, and why
4. **Multiple corrections** - You can correct the same booking multiple times
5. **No invoice changes** - Corrections only affect meter readings and aircraft TTIS

## ⚠️ Important Notes

- Corrections are **irreversible** (but can be corrected again)
- Large corrections (> 5 hours decrease) trigger validation warnings
- Aircraft TTIS update is **atomic** with booking update
- All corrections require a reason (minimum 10 characters)

## 🐛 Troubleshooting

**Button not showing?**
- Check user is admin or owner
- Verify booking is approved

**Correction fails?**
- Ensure meter end >= meter start
- Check correction reason is at least 10 characters
- Verify aircraft has total_time_method set

**Wrong TTIS delta?**
- Check which meter method aircraft uses
- Verify calculation in dialog preview
- Review applied_total_time_method on booking

## 📞 Need Help?

Refer to the detailed documentation:
- `FLIGHT_CORRECTION_SYSTEM.md` - Full system documentation
- `FLIGHT_CORRECTION_INTEGRATION_EXAMPLE.tsx` - Complete code example
