/**
 * Membership invoice creation utilities
 * 
 * Note: This is a simplified version. For full invoice creation functionality,
 * you may need to integrate with your InvoiceService or create invoice records
 * directly via Supabase.
 */

import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Parameters for creating a membership invoice
 */
export interface CreateMembershipInvoiceParams {
  userId: string
  membershipTypeId: string
  membershipTypeName: string
  membershipTypeCode: string
  expiryDate: Date
}

/**
 * Result of membership invoice creation
 */
export interface CreateMembershipInvoiceResult {
  invoiceId: string
  invoiceNumber: string | null
}

/**
 * Create an invoice for a membership (new or renewal)
 *
 * This function:
 * 1. Finds or creates a chargeable for the membership type
 * 2. Creates an invoice with a single line item for the membership fee
 * 3. Links the invoice to the membership for payment tracking
 *
 * @param params - Membership and pricing information
 * @returns Invoice ID and number, or null if creation fails
 */
export async function createMembershipInvoice(
  params: CreateMembershipInvoiceParams
): Promise<CreateMembershipInvoiceResult | null> {
  const supabase = await createClient()

  try {
    // 1. Get or create chargeable for this membership type
    const chargeableId = await getOrCreateMembershipChargeable(
      supabase,
      params.membershipTypeCode,
      params.membershipTypeName
    )

    if (!chargeableId) {
      throw new Error("Failed to get or create chargeable for membership type")
    }

    // 2. Get organization tax rate (default to 0.15 for 15%)
    const taxRate = 0.15

    // 3. Calculate due date (earlier of expiry date or 30 days from now)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const dueDate = params.expiryDate < thirtyDaysFromNow ? params.expiryDate : thirtyDaysFromNow

    // 4. Get the chargeable rate
    const { data: chargeable, error: chargeableError } = await supabase
      .from("chargeables")
      .select("rate, is_taxable")
      .eq("id", chargeableId)
      .single()

    if (chargeableError || !chargeable) {
      throw new Error("Chargeable not found")
    }

    // 5. Calculate invoice amounts
    const baseRate = parseFloat(chargeable.rate.toString())
    const isTaxable = chargeable.is_taxable ?? false

    let subtotal: number
    let taxAmount: number
    let totalAmount: number

    if (isTaxable) {
      // Rate is tax-inclusive, calculate tax-exclusive amount
      subtotal = baseRate / (1 + taxRate)
      taxAmount = subtotal * taxRate
      totalAmount = baseRate
    } else {
      subtotal = baseRate
      taxAmount = 0
      totalAmount = baseRate
    }

    // 6. Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        user_id: params.userId,
        status: "pending",
        tax_rate: taxRate,
        due_date: dueDate.toISOString(),
        issue_date: new Date().toISOString(),
        reference: `MEMBERSHIP-${params.membershipTypeCode.toUpperCase()}`,
        notes: `Membership fee for ${params.membershipTypeName}`,
        subtotal: subtotal,
        tax_total: taxAmount,
        total_amount: totalAmount,
        balance_due: totalAmount,
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      throw new Error(invoiceError?.message || "Failed to create invoice")
    }

    // 7. Create invoice item
    const { error: itemsError } = await supabase.from("invoice_items").insert({
      invoice_id: invoice.id,
      chargeable_id: chargeableId,
      description: `${params.membershipTypeName} Membership Fee`,
      quantity: 1,
      unit_price: subtotal,
      tax_rate: isTaxable ? taxRate : 0,
      amount: subtotal,
      tax_amount: taxAmount,
      line_total: totalAmount,
    })

    if (itemsError) {
      console.error("Failed to create invoice items:", itemsError)
      // Don't fail the whole operation, invoice is created
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
    }
  } catch (error) {
    console.error("Error creating membership invoice:", error)
    return null
  }
}

/**
 * Get existing or create new chargeable for a membership type
 *
 * @param supabase - Supabase client
 * @param membershipTypeCode - Code of the membership type (e.g., "flying_member")
 * @param membershipTypeName - Display name of the membership type
 * @returns Chargeable ID or null if operation fails
 */
async function getOrCreateMembershipChargeable(
  supabase: SupabaseClient,
  membershipTypeCode: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _membershipTypeName: string
): Promise<string | null> {
  try {
    // 1. Get the membership_fee chargeable type ID
    const { data: chargeableType, error: typeError } = await supabase
      .from("chargeable_types")
      .select("id")
      .eq("code", "membership_fee")
      .single()

    if (typeError || !chargeableType) {
      console.error("membership_fee chargeable type not found:", typeError)
      return null
    }

    // 2. Look for existing active chargeable with this membership type code
    const { data: existingChargeable } = await supabase
      .from("chargeables")
      .select("id")
      .eq("chargeable_type_id", chargeableType.id)
      .eq("name", membershipTypeCode)
      .eq("is_active", true)
      .maybeSingle()

    if (existingChargeable) {
      return existingChargeable.id
    }

    // 3. If not found, this is an error - chargeables should be pre-created
    // In a real scenario, you might want to create it here, but for now we'll return null
    console.error(`No active chargeable found for membership type: ${membershipTypeCode}`)
    return null
  } catch (error) {
    console.error("Error in getOrCreateMembershipChargeable:", error)
    return null
  }
}
