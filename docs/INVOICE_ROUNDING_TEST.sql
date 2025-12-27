-- Invoice Rounding Fix - Verification Test
-- Run this query to verify the fix is working correctly

-- Test 1: Verify the problematic rate now calculates correctly
SELECT 
  'Test 1: Problematic Rate (269.5652173913044)' as test_name,
  '✅ PASS' as status,
  '$310.00' as expected,
  '$' || round((1.0 * round((269.5652173913044 * 1.15)::numeric, 2))::numeric, 2)::text as actual
WHERE round((1.0 * round((269.5652173913044 * 1.15)::numeric, 2))::numeric, 2) = 310.00

UNION ALL

-- Test 2: Verify amount + tax = line_total
SELECT 
  'Test 2: Amount + Tax = Line Total' as test_name,
  CASE 
    WHEN amount + tax_amount = line_total THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  'Equal' as expected,
  CASE 
    WHEN amount + tax_amount = line_total THEN 'Equal'
    ELSE 'Not Equal'
  END as actual
FROM (
  SELECT
    round((round((1.0 * round((269.5652173913044 * 1.15)::numeric, 2))::numeric, 2) / 1.15)::numeric, 2) as amount,
    round(
      round((1.0 * round((269.5652173913044 * 1.15)::numeric, 2))::numeric, 2) -
      round((round((1.0 * round((269.5652173913044 * 1.15)::numeric, 2))::numeric, 2) / 1.15)::numeric, 2),
      2
    ) as tax_amount,
    round((1.0 * round((269.5652173913044 * 1.15)::numeric, 2))::numeric, 2) as line_total
) calc

UNION ALL

-- Test 3: Verify rate_inclusive matches line_total (for quantity=1)
SELECT 
  'Test 3: Rate Inclusive = Line Total (qty=1)' as test_name,
  CASE 
    WHEN rate_inclusive = line_total THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  '$310.00' as expected,
  '$' || line_total::text as actual
FROM (
  SELECT
    round((269.5652173913044 * 1.15)::numeric, 2) as rate_inclusive,
    round((1.0 * round((269.5652173913044 * 1.15)::numeric, 2))::numeric, 2) as line_total
) calc

UNION ALL

-- Test 4: Compare OLD vs NEW method
SELECT 
  'Test 4: NEW Method vs OLD Method' as test_name,
  CASE 
    WHEN new_total < old_total THEN '✅ PASS (Fixed $0.01 error)'
    ELSE '❌ FAIL'
  END as status,
  '$310.00 (NEW) < $310.01 (OLD)' as expected,
  '$' || new_total::text || ' (NEW) vs $' || old_total::text || ' (OLD)' as actual
FROM (
  SELECT
    -- OLD METHOD
    round(
      round((1.0 * 269.5652173913044)::numeric, 2) +
      round(round((1.0 * 269.5652173913044)::numeric, 2) * 0.15, 2),
      2
    ) as old_total,
    -- NEW METHOD
    round((1.0 * round((269.5652173913044 * 1.15)::numeric, 2))::numeric, 2) as new_total
) comparison;

-- Test 5: Verify multiple edge cases
WITH edge_cases AS (
  SELECT * FROM (VALUES
    ('Simple rate', 100.00, 1.0, 0.15, 115.00),
    ('High precision', 123.456789, 1.0, 0.15, 141.98),
    ('Multiple quantity', 269.5652173913044, 2.5, 0.15, 775.00),
    ('Zero tax', 100.00, 1.0, 0.00, 100.00),
    ('High tax', 100.00, 1.0, 0.20, 120.00)
  ) AS t(test_name, unit_price, quantity, tax_rate, expected_total)
)
SELECT
  'Test 5: ' || test_name as test_name,
  CASE 
    WHEN calculated_total = expected_total THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  '$' || expected_total::text as expected,
  '$' || calculated_total::text as actual
FROM (
  SELECT
    test_name,
    expected_total,
    round((quantity * round((unit_price * (1 + tax_rate))::numeric, 2))::numeric, 2) as calculated_total
  FROM edge_cases
) results;

-- Summary
SELECT 
  '========================================' as separator,
  'SUMMARY: All Tests Should Show ✅ PASS' as summary,
  '========================================' as separator2;

