import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { accountStatementQuerySchema } from '@/lib/validation/account-statement'
import type { AccountStatementEntry, AccountStatementResponse } from '@/lib/types/account-statement'
import { roundToTwoDecimals } from '@/lib/invoice-calculations'

function toNumber(v: unknown): number {
  // Supabase can return numeric columns as string depending on config.
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/**
 * GET /api/account-statement?user_id=...&start_date=...&end_date=...
 *
 * Returns a merged “account statement” (invoices + payments) with a running balance.
 *
 * Notes:
 * - There is no stored account_balance; closing/outstanding balances are calculated dynamically.
 * - We intentionally do NOT use `transactions` here, because invoice creation creates audit transactions
 *   that would double-count financial debits.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const queryParams: Record<string, string | undefined> = {}
  for (const [key, value] of searchParams.entries()) {
    queryParams[key] = value
  }

  const validation = accountStatementQuerySchema.safeParse(queryParams)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: validation.error.issues },
      { status: 400 }
    )
  }

  const { user_id: memberId, start_date: startDate, end_date: endDate } = validation.data

  const isStaff = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!isStaff && memberId !== user.id) {
    return NextResponse.json({ error: 'Forbidden: Cannot query other users' }, { status: 403 })
  }

  // --- Fetch invoices (debits) ---
  // We exclude draft invoices from the statement by default (not yet “issued”).
  // Cancelled invoices should not affect balance. Refunded invoices are still shown for audit but
  // are excluded from outstanding.
  let invoicesQuery = supabase
    .from('invoices')
    .select('id, invoice_number, issue_date, status, total_amount, deleted_at, reference')
    .eq('user_id', memberId)
    .is('deleted_at', null)
    .in('status', ['pending', 'overdue', 'paid', 'refunded'])
    .order('issue_date', { ascending: true })

  if (startDate) invoicesQuery = invoicesQuery.gte('issue_date', startDate)
  if (endDate) invoicesQuery = invoicesQuery.lte('issue_date', endDate)

  const { data: invoices, error: invoicesError } = await invoicesQuery
  if (invoicesError) {
    console.error('Error fetching invoices for account statement:', invoicesError)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }

  // --- Fetch payments (credits) ---
  // NOTE: invoice_payments has user_id, so we can filter by member directly.
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
      transaction_id,
      invoice:invoice_id (
        invoice_number
      )
    `)
    .eq('user_id', memberId)
    .order('paid_at', { ascending: true })

  if (startDate) paymentsQuery = paymentsQuery.gte('paid_at', startDate)
  if (endDate) paymentsQuery = paymentsQuery.lte('paid_at', endDate)

  const { data: payments, error: paymentsError } = await paymentsQuery
  if (paymentsError) {
    console.error('Error fetching payments for account statement:', paymentsError)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }

  /**
   * Legacy support:
   * Some historical payment flows recorded a credit row in `transactions` but did not create
   * a corresponding `invoice_payments` row (e.g. `metadata.transaction_type = payment_credit`).
   *
   * To ensure the statement reflects reality, we include those transaction credits *only when*
   * they are not already linked from invoice_payments.transaction_id (to avoid double counting).
   */
  type PaymentWithTransactionId = {
    transaction_id?: string | null
  }
  const paymentTransactionIds = new Set(
    (payments ?? [])
      .map((p) => (p as PaymentWithTransactionId)?.transaction_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  )

  let legacyCreditsQuery = supabase
    .from('transactions')
    .select('id, amount, completed_at, description, metadata, type, status')
    .eq('user_id', memberId)
    .eq('status', 'completed')
    .in('type', ['credit', 'adjustment'])
    .in('metadata->>transaction_type', ['payment_credit', 'invoice_payment'])
    .order('completed_at', { ascending: true })

  if (startDate) legacyCreditsQuery = legacyCreditsQuery.gte('completed_at', startDate)
  if (endDate) legacyCreditsQuery = legacyCreditsQuery.lte('completed_at', endDate)

  const { data: legacyCredits, error: legacyCreditsError } = await legacyCreditsQuery
  if (legacyCreditsError) {
    console.error('Error fetching legacy payment credits for account statement:', legacyCreditsError)
    return NextResponse.json({ error: 'Failed to fetch legacy payment credits' }, { status: 500 })
  }

  const statementEntries: AccountStatementEntry[] = []

  for (const inv of invoices ?? []) {
    const totalAmount = toNumber(inv.total_amount)
    const invoiceNumber = inv.invoice_number ?? inv.id.slice(0, 8)
    const reference = inv.reference ? `${invoiceNumber} · ${inv.reference}` : invoiceNumber
    statementEntries.push({
      date: inv.issue_date,
      reference,
      description: 'Invoice issued',
      amount: totalAmount,
      balance: 0,
      entry_type: 'invoice',
      entry_id: inv.id,
    })
  }

  type PaymentWithInvoice = {
    invoice?: Array<{
      invoice_number: string | null
    }> | null
  }
  for (const pay of payments ?? []) {
    const amount = toNumber(pay.amount)
    const invoiceNumber = (pay as PaymentWithInvoice)?.invoice?.[0]?.invoice_number ?? null
    const paymentReference = pay.payment_reference ?? null
    const refBits = [
      'PAY',
      invoiceNumber ? `INV ${invoiceNumber}` : null,
      paymentReference ? `REF ${paymentReference}` : null,
    ].filter(Boolean)

    statementEntries.push({
      date: pay.paid_at,
      reference: refBits.join(' · '),
      description: `Payment received (${pay.payment_method})`,
      amount: -Math.abs(amount),
      balance: 0,
      entry_type: 'payment',
      entry_id: pay.id,
    })
  }

  type TransactionWithMetadata = {
    metadata?: Record<string, unknown> | null
  }
  for (const tx of legacyCredits ?? []) {
    // Skip credits already represented by invoice_payments.
    if (paymentTransactionIds.has(tx.id)) continue

    const meta = (tx as TransactionWithMetadata)?.metadata ?? null
    const invoiceNumber = typeof meta?.invoice_number === 'string' ? meta.invoice_number : null
    const paymentNumber = typeof meta?.payment_number === 'string' ? meta.payment_number : null
    const txKind = typeof meta?.transaction_type === 'string' ? meta.transaction_type : null

    const refBits = [
      'PAY',
      paymentNumber ? paymentNumber : null,
      invoiceNumber ? `INV ${invoiceNumber}` : null,
      txKind ? txKind : null,
    ].filter(Boolean)

    statementEntries.push({
      date: tx.completed_at ?? new Date().toISOString(),
      reference: refBits.join(' · ') || `PAY · ${tx.id.slice(0, 8)}`,
      description: typeof tx.description === 'string' && tx.description.length > 0 ? tx.description : 'Payment received',
      amount: -Math.abs(toNumber(tx.amount)),
      balance: 0,
      entry_type: 'payment',
      entry_id: tx.id,
    })
  }

  // Sort by date, and within same timestamp put invoices before payments (debits then credits).
  statementEntries.sort((a, b) => {
    const da = new Date(a.date).getTime()
    const db = new Date(b.date).getTime()
    if (da !== db) return da - db
    if (a.entry_type === b.entry_type) return 0
    if (a.entry_type === 'invoice') return -1
    if (b.entry_type === 'invoice') return 1
    return 0
  })

  // Opening balance:
  // - If date filtering is used, we can later compute an opening balance from all transactions before start_date.
  // - For now, we keep it at 0 and insert an opening row for UI clarity when there are entries.
  const openingBalance = 0
  let running = openingBalance

  const statement: AccountStatementEntry[] = []
  if (statementEntries.length > 0) {
    statement.push({
      date: statementEntries[0]!.date,
      reference: 'OPEN',
      description: 'Opening balance',
      amount: 0,
      balance: openingBalance,
      entry_type: 'opening_balance',
      entry_id: 'opening_balance',
    })
  }

  for (const entry of statementEntries) {
    running = roundToTwoDecimals(running + entry.amount)
    statement.push({ ...entry, balance: running })
  }

  const closingBalance = roundToTwoDecimals(running)

  // Outstanding balance = sum of balance_due for open invoices.
  const { data: outstandingRows, error: outstandingError } = await supabase
    .from('invoices')
    .select('balance_due, status')
    .eq('user_id', memberId)
    .is('deleted_at', null)
    .in('status', ['pending', 'overdue'])

  if (outstandingError) {
    console.error('Error fetching outstanding balance:', outstandingError)
    return NextResponse.json({ error: 'Failed to compute outstanding balance' }, { status: 500 })
  }

  type InvoiceRow = {
    balance_due: number | null
    status: string
  }
  const outstandingBalance = (outstandingRows ?? []).reduce((acc, row) => acc + toNumber((row as InvoiceRow).balance_due), 0)

  const payload: AccountStatementResponse = {
    statement,
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    outstanding_balance: roundToTwoDecimals(outstandingBalance),
  }

  return NextResponse.json(payload)
}


