import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { invoiceItemCreateSchema, invoiceItemUpdateSchema } from '@/lib/validation/invoices'
import { invoiceIdSchema } from '@/lib/validation/invoices'
import type { InvoiceItemWithRelations } from '@/lib/types/invoice_items'
import { calculateItemAmounts, calculateInvoiceTotals, roundToTwoDecimals } from '@/lib/invoice-calculations'

/**
 * GET /api/invoice_items
 * 
 * List invoice items (filtered by invoice_id query param)
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Get invoice_id from query params
  const searchParams = request.nextUrl.searchParams
  const invoiceId = searchParams.get('invoice_id')

  if (!invoiceId) {
    return NextResponse.json(
      { error: 'invoice_id query parameter is required' },
      { status: 400 }
    )
  }

  // Validate invoice_id format
  const idValidation = invoiceIdSchema.safeParse(invoiceId)
  if (!idValidation.success) {
    return NextResponse.json(
      { error: 'Invalid invoice_id format' },
      { status: 400 }
    )
  }

  // Check if user has access to the parent invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('user_id, status')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single()

  if (!invoice) {
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 }
    )
  }

  // Check permissions
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  const canAccess = isAdminOrInstructor || invoice.user_id === user.id

  if (!canAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot access this invoice' },
      { status: 403 }
    )
  }

  // Fetch invoice items
  const { data: items, error } = await supabase
    .from('invoice_items')
    .select(`
      *,
      chargeable:chargeable_id (
        id,
        name,
        description,
        rate,
        is_taxable
      )
    `)
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching invoice items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice items' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    invoice_items: (items || []) as InvoiceItemWithRelations[],
  })
}

/**
 * POST /api/invoice_items
 * 
 * Create an invoice item
 * Requires authentication and permission to edit the parent invoice
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    )
  }

  const bodyValidation = invoiceItemCreateSchema.safeParse(body)
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: bodyValidation.error.issues },
      { status: 400 }
    )
  }

  const validatedData = bodyValidation.data

  // Check if user has edit access to the parent invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('user_id, status, tax_rate, total_paid')
    .eq('id', validatedData.invoice_id)
    .is('deleted_at', null)
    .single()

  if (!invoice) {
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 }
    )
  }

  // Check permissions
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  const canEdit = isAdminOrInstructor || invoice.user_id === user.id

  if (!canEdit) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot edit this invoice' },
      { status: 403 }
    )
  }

  // Only allow adding items to draft invoices
  if (invoice.status !== 'draft') {
    return NextResponse.json(
      { error: 'Cannot add items: Only draft invoices can be modified' },
      { status: 400 }
    )
  }

  // Calculate item amounts
  const taxRate = validatedData.tax_rate ?? invoice.tax_rate ?? 0.15
  const unitPrice = validatedData.unit_price ?? 0
  const calculated = calculateItemAmounts({
    quantity: validatedData.quantity,
    unit_price: unitPrice,
    tax_rate: taxRate,
  })

  // Create invoice item
  const itemData = {
    invoice_id: validatedData.invoice_id,
    chargeable_id: validatedData.chargeable_id || null,
    description: validatedData.description,
    quantity: validatedData.quantity,
    unit_price: unitPrice,
    amount: calculated.amount,
    tax_rate: taxRate,
    tax_amount: calculated.tax_amount,
    rate_inclusive: calculated.rate_inclusive,
    line_total: calculated.line_total,
    notes: validatedData.notes || null,
  }

  const { data: item, error: itemError } = await supabase
    .from('invoice_items')
    .insert(itemData)
    .select(`
      *,
      chargeable:chargeable_id (
        id,
        name,
        description,
        rate,
        is_taxable
      )
    `)
    .single()

  if (itemError) {
    console.error('Error creating invoice item:', itemError)
    return NextResponse.json(
      { error: 'Failed to create invoice item' },
      { status: 500 }
    )
  }

  // Recalculate and update parent invoice totals
  const { data: allItems } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', validatedData.invoice_id)
    .is('deleted_at', null)

  if (allItems && allItems.length > 0) {
    const totals = calculateInvoiceTotals(allItems)
    await supabase
      .from('invoices')
      .update({
        subtotal: totals.subtotal,
        tax_total: totals.tax_total,
        total_amount: totals.total_amount,
        balance_due: roundToTwoDecimals(totals.total_amount - (invoice.total_paid || 0)),
      })
      .eq('id', validatedData.invoice_id)
  }

  return NextResponse.json({
    invoice_item: item as InvoiceItemWithRelations,
  }, { status: 201 })
}

/**
 * PATCH /api/invoice_items
 * 
 * Update an invoice item
 * Requires authentication and permission to edit the parent invoice
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    )
  }

  // Validate that id is provided
  if (!body.id) {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400 }
    )
  }

  const bodyValidation = invoiceItemUpdateSchema.safeParse(body)
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: bodyValidation.error.issues },
      { status: 400 }
    )
  }

  const validatedData = bodyValidation.data

  // Get the existing item to check parent invoice
  const { data: existingItem, error: itemError } = await supabase
    .from('invoice_items')
    .select('invoice_id, unit_price, quantity, tax_rate')
    .eq('id', body.id)
    .is('deleted_at', null)
    .single()

  if (itemError || !existingItem) {
    return NextResponse.json(
      { error: 'Invoice item not found' },
      { status: 404 }
    )
  }

  // Check if user has edit access to the parent invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('user_id, status, tax_rate, total_paid')
    .eq('id', existingItem.invoice_id)
    .is('deleted_at', null)
    .single()

  if (!invoice) {
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 }
    )
  }

  // Check permissions
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  const canEdit = isAdminOrInstructor || invoice.user_id === user.id

  if (!canEdit) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot edit this invoice' },
      { status: 403 }
    )
  }

  // Only allow updating items in draft invoices
  if (invoice.status !== 'draft') {
    return NextResponse.json(
      { error: 'Cannot update items: Only draft invoices can be modified' },
      { status: 400 }
    )
  }

  // Prepare update data
  const updateData: Record<string, unknown> = {}
  if (validatedData.description !== undefined) updateData.description = validatedData.description
  if (validatedData.quantity !== undefined) updateData.quantity = validatedData.quantity
  if (validatedData.unit_price !== undefined) updateData.unit_price = validatedData.unit_price
  if (validatedData.tax_rate !== undefined) updateData.tax_rate = validatedData.tax_rate
  if (validatedData.notes !== undefined) updateData.notes = validatedData.notes

  // If quantity, unit_price, or tax_rate changed, recalculate amounts
  const needsRecalculation = 
    validatedData.quantity !== undefined ||
    validatedData.unit_price !== undefined ||
    validatedData.tax_rate !== undefined

  if (needsRecalculation) {
    const finalQuantity = validatedData.quantity ?? existingItem.quantity
    const finalUnitPrice = validatedData.unit_price ?? existingItem.unit_price
    const finalTaxRate = validatedData.tax_rate ?? existingItem.tax_rate ?? invoice.tax_rate ?? 0.15

    const calculated = calculateItemAmounts({
      quantity: finalQuantity,
      unit_price: finalUnitPrice,
      tax_rate: finalTaxRate,
    })

    updateData.quantity = finalQuantity
    updateData.unit_price = finalUnitPrice
    updateData.tax_rate = finalTaxRate
    updateData.amount = calculated.amount
    updateData.tax_amount = calculated.tax_amount
    updateData.rate_inclusive = calculated.rate_inclusive
    updateData.line_total = calculated.line_total
  }

  // Update invoice item
  const { data: updatedItem, error: updateError } = await supabase
    .from('invoice_items')
    .update(updateData)
    .eq('id', body.id)
    .select(`
      *,
      chargeable:chargeable_id (
        id,
        name,
        description,
        rate,
        is_taxable
      )
    `)
    .single()

  if (updateError) {
    console.error('Error updating invoice item:', updateError)
    return NextResponse.json(
      { error: 'Failed to update invoice item' },
      { status: 500 }
    )
  }

  // Recalculate and update parent invoice totals
  const { data: allItems } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', existingItem.invoice_id)
    .is('deleted_at', null)

  if (allItems && allItems.length > 0) {
    const totals = calculateInvoiceTotals(allItems)
    await supabase
      .from('invoices')
      .update({
        subtotal: totals.subtotal,
        tax_total: totals.tax_total,
        total_amount: totals.total_amount,
        balance_due: roundToTwoDecimals(totals.total_amount - (invoice.total_paid || 0)),
      })
      .eq('id', existingItem.invoice_id)
  }

  return NextResponse.json({
    invoice_item: updatedItem as InvoiceItemWithRelations,
  })
}

/**
 * DELETE /api/invoice_items
 * 
 * Delete an invoice item (soft delete)
 * Requires authentication and permission to edit the parent invoice
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check authentication
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    )
  }

  if (!body.id) {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400 }
    )
  }

  // Get the existing item to check parent invoice
  const { data: existingItem, error: itemError } = await supabase
    .from('invoice_items')
    .select('invoice_id')
    .eq('id', body.id)
    .is('deleted_at', null)
    .single()

  if (itemError || !existingItem) {
    return NextResponse.json(
      { error: 'Invoice item not found' },
      { status: 404 }
    )
  }

  // Check if user has edit access to the parent invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('user_id, status, total_paid')
    .eq('id', existingItem.invoice_id)
    .is('deleted_at', null)
    .single()

  if (!invoice) {
    return NextResponse.json(
      { error: 'Invoice not found' },
      { status: 404 }
    )
  }

  // Check permissions
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  const canEdit = isAdminOrInstructor || invoice.user_id === user.id

  if (!canEdit) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot edit this invoice' },
      { status: 403 }
    )
  }

  // Only allow deleting items from draft invoices
  if (invoice.status !== 'draft') {
    return NextResponse.json(
      { error: 'Cannot delete items: Only draft invoices can be modified' },
      { status: 400 }
    )
  }

  // Soft delete invoice item
  const { error: deleteError } = await supabase
    .from('invoice_items')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq('id', body.id)

  if (deleteError) {
    console.error('Error deleting invoice item:', deleteError)
    return NextResponse.json(
      { error: 'Failed to delete invoice item' },
      { status: 500 }
    )
  }

  // Recalculate and update parent invoice totals
  const { data: allItems } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', existingItem.invoice_id)
    .is('deleted_at', null)

  if (allItems && allItems.length > 0) {
    const totals = calculateInvoiceTotals(allItems)
    await supabase
      .from('invoices')
      .update({
        subtotal: totals.subtotal,
        tax_total: totals.tax_total,
        total_amount: totals.total_amount,
        balance_due: roundToTwoDecimals(totals.total_amount - (invoice.total_paid || 0)),
      })
      .eq('id', existingItem.invoice_id)
  } else {
    // No items left, set totals to zero
    await supabase
      .from('invoices')
      .update({
        subtotal: 0,
        tax_total: 0,
        total_amount: 0,
        balance_due: 0,
      })
      .eq('id', existingItem.invoice_id)
  }

  return NextResponse.json({ success: true })
}
