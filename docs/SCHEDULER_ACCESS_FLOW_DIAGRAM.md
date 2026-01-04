# Scheduler Access Flow Diagram

## User Access Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER NAVIGATES TO /scheduler                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE (route-permissions.ts)                     │
│                                                                          │
│  Check: Is user authenticated?                                          │
│    ❌ NO  → Redirect to /login                                          │
│    ✅ YES → Continue                                                     │
│                                                                          │
│  Check: Is user role in ['owner','admin','instructor','member','student']? │
│    ❌ NO  → Redirect to /dashboard (403)                                │
│    ✅ YES → Allow access to /scheduler                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     SCHEDULER PAGE LOADS (page.tsx)                      │
│                                                                          │
│  Renders: ResourceTimelineScheduler component                           │
│  Fetches:                                                               │
│    - Aircraft data (via /api/aircraft)                                  │
│    - Instructor data (via /api/members?person_type=instructor)          │
│    - Roster rules (via /api/roster-rules?date=YYYY-MM-DD)              │
│    - Bookings (via /api/bookings?start_date=...&end_date=...)          │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      API LAYER (API Routes)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
        ┌───────────────────────────────────────────────┐
        │                                               │
        ↓                                               ↓
┌──────────────────┐                          ┌──────────────────┐
│ GET /api/aircraft│                          │GET /api/roster-  │
│                  │                          │     rules        │
│ ✅ ALL AUTH USERS│                          │ ✅ ALL AUTH USERS│
│                  │                          │                  │
│ Check:           │                          │ Check:           │
│  - Authenticated?│                          │  - Authenticated?│
│    ✅ YES → Allow│                          │    ✅ YES → Allow│
│    ❌ NO → 401   │                          │    ❌ NO → 401   │
└──────────────────┘                          └──────────────────┘
        ↓                                               ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (PostgreSQL + RLS)                     │
└─────────────────────────────────────────────────────────────────────────┘
        ↓                                               ↓
┌──────────────────┐                          ┌──────────────────┐
│  aircraft table  │                          │ roster_rules     │
│                  │                          │     table        │
│ RLS Policy:      │                          │ RLS Policy:      │
│  SELECT:         │                          │  SELECT:         │
│   ✅ auth.role() │                          │   ✅ auth.role() │
│      = 'auth...' │                          │      = 'auth...' │
│                  │                          │   AND is_active  │
│  INSERT/UPDATE/  │                          │   AND voided_at  │
│  DELETE:         │                          │      IS NULL     │
│   ✅ instructor+ │                          │                  │
│   ❌ student     │                          │  INSERT/UPDATE/  │
└──────────────────┘                          │  DELETE:         │
                                              │   ✅ instructor+ │
                                              │   ❌ student     │
                                              └──────────────────┘
```

## Write Operation Flow (Student Attempting to Create Aircraft)

```
┌─────────────────────────────────────────────────────────────────────────┐
│              STUDENT USER ATTEMPTS: POST /api/aircraft                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      API LAYER (aircraft/route.ts)                       │
│                                                                          │
│  Check: Is user authenticated?                                          │
│    ✅ YES → Continue                                                     │
│                                                                          │
│  Check: Does user have role ['owner','admin','instructor']?             │
│    ❌ NO (user is 'student')                                            │
│    ↓                                                                    │
│  RETURN: 403 Forbidden - "Insufficient permissions"                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                            ❌ REQUEST BLOCKED
                    (Never reaches database layer)
```

## Write Operation Flow (Instructor Creating Aircraft)

```
┌─────────────────────────────────────────────────────────────────────────┐
│            INSTRUCTOR USER ATTEMPTS: POST /api/aircraft                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      API LAYER (aircraft/route.ts)                       │
│                                                                          │
│  Check: Is user authenticated?                                          │
│    ✅ YES → Continue                                                     │
│                                                                          │
│  Check: Does user have role ['owner','admin','instructor']?             │
│    ✅ YES (user is 'instructor')                                        │
│    ↓                                                                    │
│  Continue to database operation                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (PostgreSQL + RLS)                     │
│                                                                          │
│  RLS Policy Check: "Authorized roles can create aircraft"               │
│    WITH CHECK (                                                         │
│      public.user_has_any_role(                                          │
│        ARRAY['owner','admin','instructor']::user_role[],                │
│        auth.uid()                                                       │
│      )                                                                  │
│    )                                                                    │
│                                                                          │
│  ✅ Policy passes → INSERT allowed                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                        ✅ AIRCRAFT CREATED SUCCESSFULLY
```

## Role-Based Access Matrix

```
┌──────────────────┬──────────┬──────────┬────────────┬────────┬─────────┐
│ Resource/Action  │  Owner   │  Admin   │ Instructor │ Member │ Student │
├──────────────────┼──────────┼──────────┼────────────┼────────┼─────────┤
│ /scheduler       │    ✅    │    ✅    │     ✅     │   ✅   │   ✅    │
│ (route access)   │          │          │            │        │         │
├──────────────────┼──────────┼──────────┼────────────┼────────┼─────────┤
│ View Aircraft    │    ✅    │    ✅    │     ✅     │   ✅   │   ✅    │
│ (GET /api/       │          │          │            │        │         │
│  aircraft)       │          │          │            │        │         │
├──────────────────┼──────────┼──────────┼────────────┼────────┼─────────┤
│ Create Aircraft  │    ✅    │    ✅    │     ✅     │   ❌   │   ❌    │
│ (POST /api/      │          │          │            │        │         │
│  aircraft)       │          │          │            │        │         │
├──────────────────┼──────────┼──────────┼────────────┼────────┼─────────┤
│ Edit Aircraft    │    ✅    │    ✅    │     ✅     │   ❌   │   ❌    │
│ (PATCH /api/     │          │          │            │        │         │
│  aircraft/:id)   │          │          │            │        │         │
├──────────────────┼──────────┼──────────┼────────────┼────────┼─────────┤
│ Delete Aircraft  │    ✅    │    ✅    │     ❌     │   ❌   │   ❌    │
│ (DELETE /api/    │          │          │            │        │         │
│  aircraft/:id)   │          │          │            │        │         │
├──────────────────┼──────────┼──────────┼────────────┼────────┼─────────┤
│ View Roster      │    ✅    │    ✅    │     ✅     │   ✅   │   ✅    │
│ Rules            │          │          │            │        │         │
├──────────────────┼──────────┼──────────┼────────────┼────────┼─────────┤
│ Create/Edit      │    ✅    │    ✅    │     ✅     │   ❌   │   ❌    │
│ Roster Rules     │          │          │            │        │         │
├──────────────────┼──────────┼──────────┼────────────┼────────┼─────────┤
│ View Instructors │    ✅    │    ✅    │     ✅     │   ✅   │   ✅    │
├──────────────────┼──────────┼──────────┼────────────┼────────┼─────────┤
│ Create Bookings  │    ✅    │    ✅    │     ✅     │   ✅   │   ✅    │
│ (via scheduler)  │          │          │            │        │         │
└──────────────────┴──────────┴──────────┴────────────┴────────┴─────────┘
```

## Data Flow for Scheduler Page Load

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STUDENT OPENS SCHEDULER                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                    ┌───────────────────────────┐
                    │ Parallel API Requests     │
                    └───────────────────────────┘
                                    ↓
        ┌───────────────┬───────────────┬───────────────┬───────────────┐
        ↓               ↓               ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ GET /api/    │ │ GET /api/    │ │ GET /api/    │ │ GET /api/    │
│  aircraft    │ │  members     │ │  roster-     │ │  bookings    │
│              │ │  ?person_    │ │  rules       │ │  ?start_date │
│ ✅ Allowed   │ │  type=       │ │  ?date=...   │ │  =...        │
│              │ │  instructor  │ │              │ │              │
│              │ │              │ │ ✅ Allowed   │ │ ✅ Allowed   │
│              │ │ ✅ Allowed   │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        ↓               ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Returns:     │ │ Returns:     │ │ Returns:     │ │ Returns:     │
│ - Aircraft   │ │ - Instructor │ │ - Roster     │ │ - Bookings   │
│   list       │ │   profiles   │ │   rules      │ │   for date   │
│ - Types      │ │ - Names      │ │ - Avail.     │ │   range      │
│ - Status     │ │ - IDs        │ │   windows    │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        ↓               ↓               ↓               ↓
        └───────────────┴───────────────┴───────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    SCHEDULER RENDERS SUCCESSFULLY                        │
│                                                                          │
│  Shows:                                                                 │
│  - Aircraft rows with availability                                      │
│  - Instructor rows with roster availability                             │
│  - Existing bookings as colored blocks                                  │
│  - Clickable time slots for creating new bookings                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Security Layers Visualization

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  - UI shows/hides buttons based on user role                           │
│  - Client-side validation                                               │
│  ⚠️  NOT A SECURITY BOUNDARY (can be bypassed)                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         LAYER 1: MIDDLEWARE                              │
│  ✅ SECURITY BOUNDARY                                                   │
│  - Checks authentication (JWT token)                                    │
│  - Checks route permissions by role                                     │
│  - Redirects unauthorized users                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       LAYER 2: API ROUTES                                │
│  ✅ SECURITY BOUNDARY                                                   │
│  - Validates authentication                                             │
│  - Checks role-based permissions                                        │
│  - Returns 401/403 for unauthorized requests                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: DATABASE RLS                                 │
│  ✅ SECURITY BOUNDARY (STRONGEST)                                       │
│  - Enforced at PostgreSQL level                                         │
│  - Cannot be bypassed by application code                               │
│  - Uses auth.uid() and custom role functions                            │
│  - Applies to ALL database queries                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Before vs After Comparison

### BEFORE (Instructor-Only Access)

```
Student User → /scheduler → ❌ Middleware blocks → Redirected to /dashboard
Member User  → /scheduler → ✅ Allowed → ❌ API blocks aircraft fetch → Error
Instructor   → /scheduler → ✅ Allowed → ✅ Loads successfully
```

### AFTER (All Authenticated Users)

```
Student User → /scheduler → ✅ Middleware allows → ✅ API allows GET → ✅ Loads successfully
Member User  → /scheduler → ✅ Middleware allows → ✅ API allows GET → ✅ Loads successfully
Instructor   → /scheduler → ✅ Middleware allows → ✅ API allows GET → ✅ Loads successfully

Student User → POST /api/aircraft → ❌ API blocks → 403 Forbidden
Instructor   → POST /api/aircraft → ✅ API allows → ✅ RLS allows → ✅ Created
```

## Summary

**Key Principle**: Read access is open to all authenticated users, write access is restricted to authorized roles.

This allows students and members to:
- View the scheduler and make informed booking decisions
- See aircraft availability
- See instructor schedules

While preventing them from:
- Modifying aircraft data
- Changing roster rules
- Accessing admin functions

All enforced through three independent security layers for defense-in-depth.

