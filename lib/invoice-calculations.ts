/**
 * Invoice calculation utilities
 * 
 * Centralized, secure calculation logic for invoice items and totals.
 * All calculations use proper rounding to 2 decimal places for currency precision.
 */

import type { InvoiceItem } from '@/lib/types/invoice_items'

/**
 * Round a number to 2 decimal places (for currency)
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Calculate amounts for a single invoice item
 * 
 * @param params - Item calculation parameters
 * @returns Calculated amounts for the item
 */
export interface CalculateItemAmountsParams {
  quantity: number
  unit_price: number // Tax-exclusive unit price
  tax_rate: number // Tax rate as decimal (e.g., 0.15 for 15%)
}

export interface CalculateItemAmountsResult {
  amount: number // Quantity × unit_price (tax-exclusive subtotal)
  tax_amount: number // amount × tax_rate
  rate_inclusive: number // unit_price × (1 + tax_rate) - tax-inclusive rate
  line_total: number // amount + tax_amount (tax-inclusive total)
}

export function calculateItemAmounts(params: CalculateItemAmountsParams): CalculateItemAmountsResult {
  const { quantity, unit_price, tax_rate } = params

  // Validate inputs
  if (quantity <= 0) {
    throw new Error('Quantity must be positive')
  }
  if (unit_price < 0) {
    throw new Error('Unit price cannot be negative')
  }
  if (tax_rate < 0 || tax_rate > 1) {
    throw new Error('Tax rate must be between 0 and 1')
  }

  // Calculate tax-inclusive rate (display rate)
  const rateInclusive = roundToTwoDecimals(unit_price * (1 + tax_rate))

  // Calculate tax-exclusive amount (quantity × unit_price)
  const amount = roundToTwoDecimals(quantity * unit_price)

  // Calculate tax amount
  const taxAmount = roundToTwoDecimals(amount * tax_rate)

  // Calculate line total (tax-inclusive)
  const lineTotal = roundToTwoDecimals(amount + taxAmount)

  return {
    amount,
    tax_amount: taxAmount,
    rate_inclusive: rateInclusive,
    line_total: lineTotal,
  }
}

/**
 * Calculate totals for an invoice from its items
 * 
 * @param items - Array of invoice items
 * @returns Calculated invoice totals
 */
export interface CalculateInvoiceTotalsResult {
  subtotal: number // Sum of all item amounts (tax-exclusive)
  tax_total: number // Sum of all item tax amounts
  total_amount: number // subtotal + tax_total (tax-inclusive)
}

export function calculateInvoiceTotals(items: InvoiceItem[]): CalculateInvoiceTotalsResult {
  // Filter out deleted items
  const activeItems = items.filter(item => !item.deleted_at)

  if (activeItems.length === 0) {
    return {
      subtotal: 0,
      tax_total: 0,
      total_amount: 0,
    }
  }

  // Sum all amounts and tax amounts
  let subtotal = 0
  let taxTotal = 0

  for (const item of activeItems) {
    // Use stored amount if available, otherwise calculate from quantity × unit_price
    const amount = item.amount ?? roundToTwoDecimals(item.quantity * item.unit_price)
    const taxAmount = item.tax_amount ?? roundToTwoDecimals(amount * (item.tax_rate ?? 0))

    subtotal = roundToTwoDecimals(subtotal + amount)
    taxTotal = roundToTwoDecimals(taxTotal + taxAmount)
  }

  // Calculate total (subtotal + tax)
  const totalAmount = roundToTwoDecimals(subtotal + taxTotal)

  return {
    subtotal,
    tax_total: taxTotal,
    total_amount: totalAmount,
  }
}

/**
 * Recalculate an invoice item's calculated fields
 * Updates the item object with recalculated values
 */
export function recalculateInvoiceItem(item: InvoiceItem): InvoiceItem {
  const taxRate = item.tax_rate ?? 0
  const calculated = calculateItemAmounts({
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: taxRate,
  })

  return {
    ...item,
    amount: calculated.amount,
    tax_amount: calculated.tax_amount,
    rate_inclusive: calculated.rate_inclusive,
    line_total: calculated.line_total,
  }
}

/**
 * InvoiceCalculations - Namespace for all calculation functions
 * Provides a consistent API for invoice calculations
 */
export const InvoiceCalculations = {
  roundToTwoDecimals,
  calculateItemAmounts,
  calculateInvoiceTotals,
  recalculateInvoiceItem,
}
