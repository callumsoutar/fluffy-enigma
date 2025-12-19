import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { invoicesQuerySchema, invoiceCreateSchema } from '@/lib/validation/invoices'
import type { InvoiceStatus, InvoicesFilter, InvoiceWithRelations } from '@/lib/types/invoices'

/**
 * GET /api/invoices
 * 
 * Fetch invoices with optional filters
 * Requires authentication
 * 
 * Security:
 * - All authenticated users can access (invoices are user-owned)
 * - Users can only filter by their own user_id unless admin/instructor
 * - RLS policies enforce final data access
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

  // Get and validate query parameters
  const searchParams = request.nextUrl.searchParams
  
  // Build query object from URL params
  const queryParams: Record<string, string | undefined> = {}
  for (const [key, value] of searchParams.entries()) {
    queryParams[key] = value
  }

  // Validate query parameters
  const validationResult = invoicesQuerySchema.safeParse(queryParams)
  
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: validationResult.error.issues },
      { status: 400 }
    )
  }

  const filters: InvoicesFilter = {
    status: validationResult.data.status as InvoiceStatus[] | undefined,
    user_id: validationResult.data.user_id,
    search: validationResult.data.search,
    start_date: validationResult.data.start_date,
    end_date: validationResult.data.end_date,
  }

  // Security: Validate filter parameters to prevent unauthorized data access
  // Check if user is admin/instructor (can query any user's invoices)
  const isAdminOrInstructor = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])

  // Validate user_id filter - users can only filter by their own user_id unless admin/instructor
  if (filters.user_id) {
    if (!isAdminOrInstructor && filters.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot query other users\' invoices' },
        { status: 403 }
      )
    }
  } else {
    // If no user_id filter specified:
    // - Regular users (students/members) default to own invoices only
    // - Instructors/admins can see all invoices (no filter applied)
    if (!isAdminOrInstructor) {
      filters.user_id = user.id
    }
  }

  // Build query
  let query = supabase
    .from('invoices')
    .select(`
      *,
      user:user_id (
        id,
        first_name,
        last_name,
        email
      ),
      booking:booking_id (
        id,
        start_time,
        end_time,
        status
      )
    `)
    .is('deleted_at', null) // Only non-deleted invoices
    .order('issue_date', { ascending: false })

  // Apply filters
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }

  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id)
  }

  if (filters.start_date) {
    query = query.gte('issue_date', filters.start_date)
  }

  if (filters.end_date) {
    query = query.lte('issue_date', filters.end_date)
  }

  // Execute query (RLS will filter based on user permissions)
  const { data: invoices, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }

  // Apply search filter in memory (since we need to search across joined relations)
  let filteredInvoices = (invoices || []) as InvoiceWithRelations[]

  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredInvoices = filteredInvoices.filter((invoice) => {
      const invoiceNumberMatch = invoice.invoice_number?.toLowerCase().includes(searchLower)
      const referenceMatch = invoice.reference?.toLowerCase().includes(searchLower)
      const userNameMatch = invoice.user?.first_name?.toLowerCase().includes(searchLower) ||
                           invoice.user?.last_name?.toLowerCase().includes(searchLower) ||
                           invoice.user?.email?.toLowerCase().includes(searchLower)

      return invoiceNumberMatch || referenceMatch || userNameMatch
    })
  }

  return NextResponse.json({
    invoices: filteredInvoices,
    total: filteredInvoices.length,
  })
}

/**
 * POST /api/invoices
 * 
 * Create a new invoice
 * Requires authentication and instructor/admin/owner role
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

  // Check authorization - only instructors, admins, and owners can create invoices
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
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

  const bodyValidation = invoiceCreateSchema.safeParse(body)
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: bodyValidation.error.issues },
      { status: 400 }
    )
  }

  const validatedData = bodyValidation.data

  // Atomic create (invoice + items + transaction/ledger) via Postgres RPC
  const createStatus = validatedData.status || 'draft'
  if (createStatus !== 'draft' && createStatus !== 'pending') {
    return NextResponse.json(
      { error: 'Invalid status: only draft or pending allowed at creation time' },
      { status: 400 }
    )
  }

  const { data: createResult, error: createError } = await supabase.rpc('create_invoice_atomic', {
    p_user_id: validatedData.user_id,
    p_booking_id: validatedData.booking_id || null,
    p_status: createStatus,
    p_invoice_number: validatedData.invoice_number || null,
    p_tax_rate: validatedData.tax_rate ?? null,
    p_issue_date: validatedData.issue_date || new Date().toISOString(),
    p_due_date: validatedData.due_date || null,
    p_reference: validatedData.reference || null,
    p_notes: validatedData.notes || null,
    p_items: validatedData.items,
  })

  if (createError) {
    console.error('Error creating invoice atomically:', createError)
    return NextResponse.json(
      { error: 'Failed to create invoice', details: createError.message },
      { status: 500 }
    )
  }

  const result = createResult as unknown as { success?: boolean; invoice_id?: string; error?: string }
  if (!result?.success || !result.invoice_id) {
    return NextResponse.json(
      { error: result?.error || 'Failed to create invoice' },
      { status: 500 }
    )
  }

  // Fetch the created invoice with relations
  const { data: createdInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select(`
      *,
      user:user_id (
        id,
        first_name,
        last_name,
        email
      ),
      booking:booking_id (
        id,
        start_time,
        end_time,
        status
      )
    `)
    .eq('id', result.invoice_id)
    .single()

  if (fetchError || !createdInvoice) {
    return NextResponse.json(
      { error: 'Failed to fetch created invoice' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    id: createdInvoice.id,
    invoice: createdInvoice as InvoiceWithRelations,
  }, { status: 201 })
}
