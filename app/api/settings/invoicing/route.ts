import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

type InvoicingSettingsResponse = {
  schoolName: string
  billingAddress: string
  gstNumber: string
  contactPhone: string
  contactEmail: string
  invoiceFooter: string
  paymentTerms: string
}

function coerceSettingValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') {
    // Some settings may be stored as JSON-encoded strings (e.g. "\"Line 1\\nLine 2\"")
    try {
      const parsed = JSON.parse(v)
      if (typeof parsed === 'string') return parsed
      return String(parsed)
    } catch {
      return v
    }
  }
  return String(v)
}

/**
 * GET /api/settings/invoicing
 *
 * Fetch commonly-used settings for invoice rendering (billing header + terms/footer).
 * Requires authentication and tenant membership.
 */
export async function GET() {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  try {
    await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: 'Forbidden: No tenant membership' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 })
  }

  // NOTE: we keep this intentionally narrow (only what invoice rendering needs)
  const keys = [
    'school_name',
    'billing_address',
    'gst_number',
    'contact_phone',
    'contact_email',
    'invoice_footer_message',
    'payment_terms_message',
  ]

  const { data: settings, error } = await supabase
    .from('settings')
    .select('category, setting_key, setting_value, data_type')
    .in('category', ['general', 'invoicing'])
    .in('setting_key', keys)

  if (error) {
    console.error('Error fetching invoice settings:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice settings' }, { status: 500 })
  }

  const map: Record<string, string> = {}
  for (const row of settings || []) {
    const r = row as unknown as { setting_key?: string; setting_value?: unknown }
    if (!r.setting_key) continue
    map[r.setting_key] = coerceSettingValue(r.setting_value)
  }

  const response: InvoicingSettingsResponse = {
    schoolName: map.school_name || 'Flight School',
    billingAddress: map.billing_address || '',
    gstNumber: map.gst_number || '',
    contactPhone: map.contact_phone || '',
    contactEmail: map.contact_email || '',
    invoiceFooter: map.invoice_footer_message || 'Thank you for your business.',
    paymentTerms: map.payment_terms_message || 'Payment terms: Net 30 days.',
  }

  return NextResponse.json({ settings: response })
}

