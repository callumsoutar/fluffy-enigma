# Invoice Rounding Fix

**Date:** December 27, 2025  
**Issue:** Invoice totals were off by $0.01 for certain rates  
**Status:** ✅ FIXED

---

## Problem Description

When creating invoices for aircraft with rate `269.5652173913044` at 15% tax, the system calculated:
- Expected total: **$310.00**
- Actual total: **$310.01** ❌

This $0.01 discrepancy was caused by the order of rounding operations.

---

## Root Cause

### Old Calculation Method (Incorrect)

The original logic calculated the tax-exclusive amount first, then added tax:

```
Step 1: amount = round(269.5652173913044 × 1.0, 2) = 269.57 (rounds UP)
Step 2: tax = round(269.57 × 0.15, 2) = 40.44
Step 3: total = 269.57 + 40.44 = 310.01 ❌
```

**Problem:** The rate `269.5652173913044` is right on the edge of rounding. When rounded to 269.57, the subsequent tax calculation compounds the rounding error.

### Why This Matters

The tax-inclusive rate that users see is:
```
rate_inclusive = round(269.5652173913044 × 1.15, 2) = 310.00
```

Users expect to pay **$310.00** (the displayed rate), but the system was charging **$310.01** due to the calculation order.

---

## Solution

### New Calculation Method (Correct)

Calculate from the tax-inclusive rate first, then back-calculate the components:

```
Step 1: rate_inclusive = round(269.5652173913044 × 1.15, 2) = 310.00
Step 2: line_total = round(1.0 × 310.00, 2) = 310.00
Step 3: amount = round(310.00 / 1.15, 2) = 269.57
Step 4: tax_amount = round(310.00 - 269.57, 2) = 40.43
Step 5: verification = 269.57 + 40.43 = 310.00 ✅
```

**Key insight:** By calculating `line_total` from the rounded `rate_inclusive`, we ensure the final total always matches what users see.

---

## Changes Made

### 1. Client-Side Calculation (`lib/invoice-calculations.ts`)

Updated `calculateItemAmounts()` function:

```typescript
// OLD METHOD
const amount = roundToTwoDecimals(quantity * unit_price)
const taxAmount = roundToTwoDecimals(amount * tax_rate)
const lineTotal = roundToTwoDecimals(amount + taxAmount)

// NEW METHOD
const rateInclusive = roundToTwoDecimals(unit_price * (1 + tax_rate))
const lineTotal = roundToTwoDecimals(quantity * rateInclusive)
const amount = roundToTwoDecimals(lineTotal / (1 + tax_rate))
const taxAmount = roundToTwoDecimals(lineTotal - amount)
```

### 2. Server-Side Calculation (Database RPC)

Updated `create_invoice_atomic()` function in migration `015_fix_invoice_rounding_logic.sql`:

```sql
-- OLD METHOD
round((r.quantity * r.unit_price)::numeric, 2) AS amount,
round(round((r.quantity * r.unit_price)::numeric, 2) * tax_rate, 2) AS tax_amount,
round(amount + tax_amount, 2) AS line_total

-- NEW METHOD
round((r.unit_price * (1 + tax_rate))::numeric, 2) AS rate_inclusive,
round((r.quantity * rate_inclusive)::numeric, 2) AS line_total,
round((line_total / (1 + tax_rate))::numeric, 2) AS amount,
round((line_total - amount)::numeric, 2) AS tax_amount
```

---

## Test Results

All test cases pass with the new logic:

| Test Case | Rate | Qty | Tax | Rate Incl | Line Total | Amount | Tax | Valid |
|-----------|------|-----|-----|-----------|------------|--------|-----|-------|
| Problematic rate | 269.57 | 1.0 | 15% | $310.00 | $310.00 | $269.57 | $40.43 | ✅ |
| Simple rate | 100.00 | 1.0 | 15% | $115.00 | $115.00 | $100.00 | $15.00 | ✅ |
| High precision | 123.46 | 1.0 | 15% | $141.98 | $141.98 | $123.46 | $18.52 | ✅ |
| Multiple quantity | 269.57 | 2.5 | 15% | $310.00 | $775.00 | $673.91 | $101.09 | ✅ |
| Zero tax | 100.00 | 1.0 | 0% | $100.00 | $100.00 | $100.00 | $0.00 | ✅ |
| High tax | 100.00 | 1.0 | 20% | $120.00 | $120.00 | $100.00 | $20.00 | ✅ |

**Verification:** For all cases, `amount + tax_amount = line_total` (no rounding errors).

---

## Impact Analysis

### ✅ Positive Impacts

1. **User Trust:** Invoices now match displayed rates exactly
2. **Audit Compliance:** Calculations are consistent between preview and final invoice
3. **Edge Case Handling:** Rates near rounding boundaries now calculate correctly
4. **Maintainability:** Logic is clearer and more intuitive

### ⚠️ Potential Concerns

1. **Tax Amount Adjustment:** In some cases, the tax amount may be adjusted by $0.01 to ensure the total is correct
   - Example: Old method gave tax=$40.44, new method gives tax=$40.43
   - This is **intentional** and ensures the total matches the displayed rate

2. **Historical Invoices:** Existing invoices are not affected (they remain as-is for audit purposes)

3. **Accounting Systems:** External systems should use `line_total` as the source of truth, not recalculate from `amount + tax_amount`

---

## Verification Queries

### Check for Rounding Errors in Existing Invoices

```sql
-- Find any invoice items where amount + tax_amount ≠ line_total
SELECT 
  id,
  description,
  quantity,
  unit_price,
  amount,
  tax_amount,
  line_total,
  (amount + tax_amount) AS calculated_total,
  ABS(line_total - (amount + tax_amount)) AS discrepancy
FROM invoice_items
WHERE deleted_at IS NULL
  AND ABS(line_total - (amount + tax_amount)) > 0.01
ORDER BY discrepancy DESC;
```

### Verify New Calculations

```sql
-- Test the new RPC function with problematic rate
SELECT public.create_invoice_atomic(
  p_user_id := auth.uid(),
  p_status := 'draft',
  p_tax_rate := 0.15,
  p_items := jsonb_build_array(
    jsonb_build_object(
      'description', 'Test Aircraft Hire',
      'quantity', 1.0,
      'unit_price', 269.5652173913044,
      'tax_rate', 0.15
    )
  )
);

-- Check the created invoice item
SELECT 
  description,
  quantity,
  unit_price,
  rate_inclusive,
  amount,
  tax_amount,
  line_total,
  (amount + tax_amount) AS verification
FROM invoice_items
WHERE invoice_id = (SELECT id FROM invoices ORDER BY created_at DESC LIMIT 1);
```

---

## Recommendations

### For Developers

1. **Always use `calculateItemAmounts()`** from `lib/invoice-calculations.ts` for client-side calculations
2. **Never send calculated totals** from client to server (server recalculates)
3. **Test edge cases** when adding new rate types or tax calculations

### For Accountants

1. **Use `line_total` as the source of truth** for invoice totals
2. **Tax amounts may vary by $0.01** from simple multiplication due to rounding
3. **This is intentional** and ensures totals match displayed rates

### For External Integrations

1. **Import `line_total` field** directly (don't recalculate)
2. **Verify totals** by summing `line_total` values, not `amount + tax_amount`
3. **Audit trail** is preserved in `notes` field with full calculation metadata

---

## Related Documentation

- [INVOICING_SECURITY_REVIEW.md](./INVOICING_SECURITY_REVIEW.md) - Comprehensive security review of invoicing system
- [RLS_POLICY_PATTERNS.md](./RLS_POLICY_PATTERNS.md) - Row-level security for invoices
- [RBAC_ARCHITECTURE.md](./RBAC_ARCHITECTURE.md) - Role-based access control

---

## Migration Applied

- **Migration:** `015_fix_invoice_rounding_logic.sql`
- **Applied:** December 27, 2025
- **Project:** fergmobsjyucucxeumvb (Aero Manager)

---

**Status:** ✅ RESOLVED - Invoice rounding now matches user expectations

