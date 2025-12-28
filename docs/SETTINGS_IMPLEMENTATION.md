# Settings Page Implementation

## Overview
Comprehensive settings management system for the Aero Safety flight school application with role-based access control, organized tab navigation, and real-time updates.

## Security Implementation

### Access Control
- **Restricted Access**: Only `owner` and `admin` roles can access settings
- **API Security**: All settings API endpoints enforce role-based authorization using `userHasAnyRole`
- **Frontend Protection**: Settings page checks access before rendering content
- **Sidebar Navigation**: Settings link only visible to owners and admins

### API Endpoints

#### GET /api/settings
- **Purpose**: Fetch settings by category
- **Auth**: Required (owner/admin only)
- **Query Params**:
  - `category`: Filter by category (general, invoicing, charges, bookings, training, memberships)
  - `key`: Filter by specific setting key
- **Response**: Array of settings or single setting

#### PATCH /api/settings
- **Purpose**: Update a setting value
- **Auth**: Required (owner/admin only)
- **Body**:
  ```json
  {
    "category": "general",
    "setting_key": "school_name",
    "setting_value": "New School Name"
  }
  ```
- **Response**: Updated setting object

## Architecture

### Custom Hook: `useSettingsManager`
Located in `hooks/use-settings.ts`

**Features**:
- Category-based settings fetching with React Query
- Automatic caching (30 seconds stale time)
- Optimistic updates with cache invalidation
- Type-safe getter with default values
- Mutation handling with loading states

**Usage**:
```typescript
const {
  settings,              // Array of settings
  isLoading,            // Loading state
  isUpdating,           // Update in progress
  error,                // Error state
  refetch,              // Manual refetch
  getSettingValue,      // Get value by key with default
  updateSettingValue,   // Update a setting
} = useSettingsManager('general');
```

### Page Structure

```
/settings
├── Main Settings Page (app/settings/page.tsx)
│   ├── General Tab (components/settings/general-tab.tsx)
│   │   ├── School Information
│   │   ├── Contact Information
│   │   └── System Settings
│   ├── Invoicing Tab (components/settings/invoicing-tab.tsx)
│   ├── Charges Tab (components/settings/charges-tab.tsx)
│   ├── Bookings Tab (components/settings/bookings-tab.tsx)
│   ├── Training Tab (components/settings/training-tab.tsx)
│   └── Memberships Tab (components/settings/memberships-tab.tsx)
```

## Settings Categories

### 1. General Settings
**Sub-tabs**: School Information, Contact Information, System Settings

**Settings**:
- `school_name` - Flight school name
- `registration_number` - Registration number
- `description` - School description
- `website_url` - School website
- `contact_email` - Main contact email
- `contact_phone` - Main phone number
- `address` - Physical address
- `billing_address` - Billing address for invoices
- `gst_number` - GST/Tax registration number
- `timezone` - Default timezone (Pacific/Auckland, UTC, etc.)
- `currency` - Default currency (NZD, USD, AUD, etc.)

### 2. Invoicing Settings
**Settings**:
- `invoice_prefix` - Invoice number prefix (e.g., "INV")
- `default_invoice_due_days` - Default days until invoice due (7)
- `payment_terms_days` - Payment terms in days (30)
- `payment_terms_message` - Payment terms text for invoices
- `invoice_footer_message` - Footer message on invoices
- `auto_generate_invoices` - Auto-generate after flights (boolean)
- `include_logo_on_invoice` - Show logo on invoices (boolean)
- `invoice_due_reminder_days` - Days before due to send reminder (7)
- `late_fee_percentage` - Late fee percentage (0-100)

### 3. Bookings Settings
**Settings**:
- `default_booking_duration_hours` - Default booking duration (2)
- `minimum_booking_duration_minutes` - Minimum duration (30)
- `maximum_booking_duration_hours` - Maximum duration (8)
- `booking_buffer_minutes` - Buffer between bookings (15)
- `allow_past_bookings` - Allow creating past bookings (boolean)
- `require_instructor_for_solo` - Require instructor approval for solo (boolean)
- `require_flight_authorization_for_solo` - Require authorization for solo (boolean)
- `auto_cancel_unpaid_hours` - Auto-cancel unpaid after hours (72)

### 4. Training Settings
**Settings**:
- `default_lesson_duration_minutes` - Default lesson duration (60)
- `require_lesson_plan` - Require lesson plan for training flights (boolean)
- `require_instructor_signature` - Require signature on completion (boolean)
- `track_student_progress` - Enable progress tracking (boolean)

### 5. Charges Settings
**Status**: Placeholder for future implementation
**Purpose**: Manage default charge rates, categories, and pricing structures

### 6. Memberships Settings
**Status**: Placeholder for future implementation
**Purpose**: Manage membership types, renewal policies, and membership year configuration

## UI/UX Features

### Tab Navigation
- **Main Tabs**: Horizontal tab bar with icons and labels
- **Sub-tabs**: Nested tabs within General settings
- **Animated Underline**: Smooth transition indicator for active tab
- **Scroll Indicators**: Fade gradients when tabs overflow
- **Responsive**: Touch-friendly on mobile devices

### Form Handling
- **Local State**: Form data stored in component state
- **Optimistic Updates**: Immediate UI feedback
- **Section Saving**: Save related fields together
- **Auto-save**: System settings (timezone, currency) save immediately
- **Loading States**: Spinners during save operations
- **Toast Notifications**: Success/error feedback

### Styling
- Consistent with existing application design
- shadcn/ui components throughout
- Tailwind CSS for styling
- Proper spacing and typography
- Accessible form labels and descriptions

## Database Schema

Settings are stored in the `settings` table:

```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  data_type TEXT CHECK (data_type IN ('string', 'number', 'boolean', 'object', 'array')),
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  is_required BOOLEAN DEFAULT false,
  validation_schema JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE(category, setting_key)
);
```

## Best Practices Implemented

### Security
✅ Role-based access control (owner/admin only)
✅ Server-side authorization checks
✅ RLS policies enforced via Supabase
✅ Input validation on API endpoints
✅ Audit trail with updated_by tracking

### Performance
✅ React Query caching (30s stale time)
✅ Optimistic updates
✅ Lazy loading of tab content
✅ Minimal re-renders with proper memoization

### Code Quality
✅ TypeScript throughout
✅ Proper error handling
✅ Loading states for all async operations
✅ Consistent naming conventions
✅ Reusable components and hooks
✅ No linter errors

### User Experience
✅ Clear section organization
✅ Helpful descriptions and placeholders
✅ Immediate feedback on actions
✅ Accessible form controls
✅ Responsive design
✅ Smooth animations

## Testing Checklist

### Access Control
- [ ] Non-admin users cannot access /settings
- [ ] Non-admin users get 403 on API calls
- [ ] Settings link not visible to non-admins in sidebar

### Functionality
- [ ] Settings load correctly for each category
- [ ] Updates save successfully
- [ ] Toast notifications appear on save
- [ ] Form values persist after save
- [ ] Validation works for required fields

### UI/UX
- [ ] Tab navigation works smoothly
- [ ] Sub-tabs work in General section
- [ ] Scroll indicators appear when needed
- [ ] Loading states display correctly
- [ ] Responsive on mobile devices

## Future Enhancements

1. **Charges Tab**: Implement charge rate management
2. **Memberships Tab**: Implement membership configuration
3. **Business Hours**: Add business hours configuration to General tab
4. **Logo Upload**: Add logo upload functionality
5. **Email Templates**: Add email template configuration
6. **Backup/Restore**: Export/import settings functionality
7. **Change History**: View audit log of setting changes
8. **Validation**: Add client-side validation schemas
9. **Search**: Add search functionality for settings
10. **Bulk Operations**: Import/export settings as JSON

## Related Files

### Core Implementation
- `hooks/use-settings.ts` - Settings management hook
- `app/api/settings/route.ts` - Settings API endpoints
- `app/settings/page.tsx` - Main settings page

### Tab Components
- `components/settings/general-tab.tsx` - General settings with sub-tabs
- `components/settings/invoicing-tab.tsx` - Invoicing configuration
- `components/settings/bookings-tab.tsx` - Booking rules and permissions
- `components/settings/training-tab.tsx` - Training requirements
- `components/settings/charges-tab.tsx` - Charges (placeholder)
- `components/settings/memberships-tab.tsx` - Memberships (placeholder)

### Navigation
- `components/app-sidebar.tsx` - Updated to restrict settings access

## Notes

- All settings are stored in the `settings` table in Supabase
- Settings values are stored as JSONB for flexibility
- The hook handles type coercion automatically
- System settings (timezone, currency) auto-save on change
- Other settings require explicit save button click
- Settings are cached for 30 seconds to reduce API calls
- Mutations invalidate cache to ensure fresh data

