# Payment Duplicate Bug Fix - December 27, 2025

## Executive Summary

**Issue:** Account statement was showing duplicate payment entries for the same payment transaction.

**Root Cause:** Missing `transaction_id` field in the account statement API query, causing the deduplication logic to fail.

**Status:** ✅ **FIXED**

---

## Problem Description

### User Report

When using the Record Payment Modal to record a payment against invoice `INV-2025-12-0006` (ID: `3f66bfb6-95f4-4410-8704-4c42eeca3651`), the following occurred:

1. ✅ Transaction was created successfully in `transactions` table
2. ✅ Payment was recorded successfully in `invoice_payments` table  
3. ✅ Invoice was marked as paid correctly
4. ❌ Account statement showed **TWO** payment entries instead of one

### Screenshot Evidence

The account statement showed:
```
27/12/2025  PAY · INV INV-2025-12-0006 · invoice_payment    Payment received (credit_card)    $
27/12/2025  PAY · INV INV-2025-12-0006 · invoice_payment    Invoice payment received: INV-2025-12-0006    $
```

Both entries were for the same $356.65 payment.

---

## Investigation Findings

### Database Architecture

The system has **THREE** payment-related tables:

1. **`transactions`** - General ledger for all financial events (debits, credits, adjustments)
2. **`invoice_payments`** - Specific payment records linked to invoices (introduced in migration 005)
3. **`payments`** - Legacy/standalone payment table (separate from invoice payments)

### Payment Recording Flow

When recording a payment via `record_invoice_payment_atomic` RPC:

```sql
-- 1. Create transaction (audit trail)
INSERT INTO transactions (type='adjustment', amount=356.65, ...)
RETURNING id INTO v_transaction_id;

-- 2. Create invoice_payment record (linked to transaction)
INSERT INTO invoice_payments (transaction_id=v_transaction_id, ...)
RETURNING id INTO v_payment_id;

-- 3. Update invoice totals/status
UPDATE invoices SET total_paid=..., status='paid', ...
```

**Key Point:** The transaction and invoice_payment are **linked** via `transaction_id` to prevent double-counting.

### Account Statement Logic

The account statement API (`app/api/account-statement/route.ts`) intentionally queries **two sources**:

1. **Primary:** `invoice_payments` table (lines 80-104)
2. **Legacy Support:** `transactions` table with `type IN ('credit', 'adjustment')` and `metadata.transaction_type IN ('payment_credit', 'invoice_payment')` (lines 123-139)

The legacy support exists because:
> "Some historical payment flows recorded a credit row in `transactions` but did not create a corresponding `invoice_payments` row"

### Deduplication Logic

To prevent double-counting, the code has deduplication logic (lines 117-121):

```typescript
const paymentTransactionIds = new Set(
  (payments ?? [])
    .map((p) => (p as PaymentWithTransactionId)?.transaction_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
)

// Later, when processing legacy credits:
for (const tx of legacyCredits ?? []) {
  // Skip credits already represented by invoice_payments.
  if (paymentTransactionIds.has(tx.id)) continue
  // ... add to statement
}
```

**This logic depends on having `transaction_id` available in the `invoice_payments` query results.**

---

## Root Cause

### The Bug

The `invoice_payments` query was **missing** the `transaction_id` field:

```typescript
// ❌ BEFORE (BROKEN)
let paymentsQuery = supabase
  .from('invoice_payments')
  .select(`
    id,
    invoice_id,
    amount,
    paid_at,
    payment_method,
    payment_reference,
    notes,
    invoice:invoice_id (
      invoice_number
    )
  `)
```

Without `transaction_id` in the SELECT, the deduplication logic couldn't build the `paymentTransactionIds` Set, so it remained **empty**.

### Why This Caused Duplicates

1. Payment recorded → creates both `invoice_payments` row AND `transactions` row
2. Account statement query fetches `invoice_payments` (but without `transaction_id`)
3. Deduplication Set is empty (no transaction IDs to filter)
4. Account statement also fetches matching `transactions` rows
5. **Both sources return the same payment** → duplicate entries

### Database Verification

Query confirmed the issue:

```sql
SELECT 
  'invoice_payment' as source,
  ip.id,
  ip.transaction_id
FROM invoice_payments ip
WHERE ip.user_id = '26e3d66f-7f71-4bde-ad4e-aba588fb096b'

UNION ALL

SELECT 
  'legacy_transaction' as source,
  t.id,
  t.id as transaction_id
FROM transactions t
WHERE t.user_id = '26e3d66f-7f71-4bde-ad4e-aba588fb096b'
  AND t.type IN ('credit', 'adjustment')
  AND t.metadata->>'transaction_type' IN ('payment_credit', 'invoice_payment')
```

**Result:** Both queries returned the same `transaction_id` (`1c3e98bb-b4f6-49a0-8cc7-3ea4b2964dfa`), confirming they represent the same payment.

---

## The Fix

### Code Change

**File:** `app/api/account-statement/route.ts`

**Change:** Added `transaction_id` to the SELECT clause:

```typescript
// ✅ AFTER (FIXED)
let paymentsQuery = supabase
  .from('invoice_payments')
  .select(`
    id,
    invoice_id,
    amount,
    paid_at,
    payment_method,
    payment_reference,
    notes,
    transaction_id,          // ← ADDED THIS LINE
    invoice:invoice_id (
      invoice_number
    )
  `)
```

### How This Fixes It

1. Query now returns `transaction_id` for each `invoice_payments` row
2. Deduplication Set is properly populated with transaction IDs
3. When processing legacy `transactions`, the code skips any with matching IDs
4. **Result:** Each payment appears only once in the account statement

---

## Testing & Verification

### Pre-Fix Behavior

```sql
-- Simulated account statement query showed BOTH:
{source: 'invoice_payment', id: 'af73...', transaction_id: '1c3e...'}
{source: 'legacy_transaction', id: '1c3e...', transaction_id: '1c3e...'}
```

### Post-Fix Expected Behavior

```sql
-- After fix, deduplication should filter out the duplicate:
{source: 'invoice_payment', id: 'af73...', transaction_id: '1c3e...'}
-- (legacy_transaction with id='1c3e...' is skipped because it's in the Set)
```

### Verification Steps

1. ✅ Confirmed `invoice_payments` table has `transaction_id` field populated
2. ✅ Confirmed `transactions` table has matching record with same ID
3. ✅ Confirmed deduplication logic exists and is correct
4. ✅ Identified missing field in SELECT query
5. ✅ Applied fix to include `transaction_id` in query
6. ⏳ User should test account statement to confirm single payment entry

---

## Related Files

### Modified
- `app/api/account-statement/route.ts` - Added `transaction_id` to SELECT query

### Reviewed (No Changes Needed)
- `supabase/migrations/005_atomic_invoice_payments.sql` - Payment recording RPC (working correctly)
- `supabase/migrations/006_fix_record_payment_payment_method_enum.sql` - Updated RPC (working correctly)
- `app/api/invoices/[id]/payments/route.ts` - Payment API endpoint (working correctly)
- `components/invoices/RecordPaymentModal.tsx` - UI component (working correctly)

---

## Architecture Notes

### Why Two Tables?

**Historical Context:**
- `transactions` table is the general ledger (all financial events)
- `invoice_payments` table was added later for better invoice-specific tracking
- Both exist for backward compatibility and comprehensive audit trails

### Why Query Both?

The account statement intentionally queries both tables to support:
1. **New payments:** Recorded in both `invoice_payments` and `transactions`
2. **Legacy payments:** May only exist in `transactions` (pre-migration data)

The deduplication logic ensures modern payments (in both tables) only appear once.

### Design Decision

This is **correct architecture** - the bug was simply a missing field in the query, not a flaw in the design.

---

## Lessons Learned

### 1. Always Include Foreign Keys in Queries
When implementing deduplication logic based on foreign keys, ensure those keys are included in the SELECT clause.

### 2. Test Deduplication Logic
When working with overlapping data sources, verify that:
- The deduplication Set is populated correctly
- The filtering logic has access to the required fields

### 3. Database Schema Documentation
Document the relationship between tables (e.g., `invoice_payments.transaction_id → transactions.id`) to help future developers understand the data model.

---

## Recommendations

### Immediate Actions
1. ✅ Apply the fix (done)
2. ⏳ User to verify account statement shows single payment entry
3. ⏳ Consider adding integration test for account statement deduplication

### Future Improvements

#### 1. Add Database Constraint
Consider adding a unique constraint to prevent accidental duplicate payments:

```sql
-- Ensure one payment per transaction
CREATE UNIQUE INDEX invoice_payments_transaction_id_unique 
ON invoice_payments(transaction_id);
```

#### 2. Add TypeScript Type Safety
Update the type definition to ensure `transaction_id` is always included:

```typescript
// lib/types/account-statement.ts
export interface InvoicePaymentRow {
  id: string
  invoice_id: string
  amount: number
  paid_at: string
  payment_method: string
  payment_reference: string | null
  notes: string | null
  transaction_id: string  // ← Make this required in type
  invoice?: Array<{ invoice_number: string | null }> | null
}
```

#### 3. Add Unit Test
Create a test to verify deduplication logic:

```typescript
describe('Account Statement Deduplication', () => {
  it('should not show duplicate payments when transaction exists in both tables', () => {
    // Test setup: create payment in both invoice_payments and transactions
    // Assert: account statement shows only one entry
  })
})
```

#### 4. Consider Migration to Single Source
**Long-term consideration:** Evaluate whether to:
- Migrate all legacy `transactions` payments to `invoice_payments`
- Remove the legacy support code once migration is complete
- Simplify the account statement query to single table

**Trade-offs:**
- ✅ Simpler code, fewer edge cases
- ❌ Requires data migration
- ❌ May lose historical audit trail structure

---

## Conclusion

The payment recording system is **working correctly** - the RPC function creates both the transaction and invoice_payment records as designed, and they are properly linked via `transaction_id`.

The bug was a **simple query omission** - the account statement wasn't fetching the `transaction_id` field needed for deduplication, causing the same payment to appear twice (once from each table).

The fix is **minimal and safe** - adding one field to a SELECT query with no changes to business logic or database structure.

**Status:** ✅ **RESOLVED** - One-line fix applied, ready for testing.

---

## Contact

**Investigated by:** AI Assistant (Claude Sonnet 4.5)  
**Date:** December 27, 2025  
**Project:** Aero Safety - Flight School Management System  
**Supabase Project ID:** fergmobsjyucucxeumvb

