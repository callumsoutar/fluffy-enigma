# Booking Route Architecture Standard

This document defines the standard structure for booking-related routes in the
Next.js App Router. It aims to keep routing and access control server-owned,
while client components remain focused on UI and interactivity.

## Recommended Folder Structure

```
app/
  bookings/
    [id]/
      booking-access.ts
      booking-detail-client.tsx
      page.tsx
      checkin/
        booking-checkin-client.tsx
        page.tsx
      checkout/
        booking-checkout-client.tsx
        page.tsx
```

## Responsibilities

### Server Pages (`page.tsx`)
- Fetch minimal booking data needed for access/flow decisions.
- Enforce access control and guards (no client-only gates).
- Handle redirects for flow eligibility and state transitions.
- Render the client component only after the server decides the user can enter.

### Client Components (`booking-*-client.tsx`)
- Own interactive UI, form state, and mutations.
- Fetch full booking details and supporting data via API routes.
- Never decide whether a user is allowed to enter a flow.
- Accept identifiers (e.g. `bookingId`) via props from the server page.

## Access Checks and Guards

### Access checks
- Centralized in `app/bookings/[id]/booking-access.ts`.
- Use existing role utilities (`userHasAnyRole`) and the same booking access
  rules used by API routes (owner/admin/instructor OR booking owner OR assigned
  instructor).

### Status / flow guards
- Centralized in `app/bookings/[id]/booking-access.ts`.
- Each flow defines a redirect rule:
  - View: redirect flying flight bookings to checkout.
  - Checkout: block non-flight bookings.
  - Check-in: block non-flight bookings.
- Server pages call guard helpers and redirect before rendering UI.

### Redirect handling
- Always done in server pages using `redirect()` from `next/navigation`.
- Client components should not perform redirect logic for eligibility.

## Naming Conventions

- **Server pages**: `page.tsx`
- **Client components**: `booking-<flow>-client.tsx`
- **Shared access / guard logic**: `booking-access.ts`

## Prop Conventions (Server → Client)

- Pass only what the client needs to bootstrap:
  - `bookingId` as a string is the default.
- Avoid passing booking data unless it prevents a refetch or is required for
  a specific optimization.

## Reuse Strategy

- Add new flow guards in `booking-access.ts`.
- Server pages must call these helpers rather than reimplementing logic.
- Client components should only handle UI/interaction logic and API calls.

