import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'
import { getEffectiveSettings } from '@/lib/settings'

type InvoicingSettingsResponse = {
  schoolName: string
  billingAddress: string
  gstNumber: string
  contactPhone: string
  contactEmail: string
  invoiceFooter: string
  paymentTerms: string
}

/**
 * GET /api/settings/invoicing
 *
 * Fetch commonly-used settings for invoice rendering (billing header + terms/footer).
 * Combines tenant profile data (name, address, etc.) with invoice-specific settings.
 * Requires authentication and tenant membership.
 */
export async function GET() {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check and tenant_id)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
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

  const { tenantId } = tenantContext

  // Fetch tenant profile (contains school name, billing address, GST number, contact info)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('name, billing_address, gst_number, contact_phone, contact_email')
    .eq('id', tenantId)
    .single()

  if (tenantError) {
    console.error('Error fetching tenant profile:', tenantError)
    return NextResponse.json({ error: 'Failed to fetch tenant profile' }, { status: 500 })
  }

  // Fetch tenant settings (contains invoice footer and payment terms messages)
  const { data: tenantSettings } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .single()

  // Get effective settings (defaults + overrides)
  const settings = getEffectiveSettings(tenantSettings?.settings)

  // Combine tenant profile + settings for invoice rendering
  const response: InvoicingSettingsResponse = {
    schoolName: tenant?.name || 'Flight School',
    billingAddress: tenant?.billing_address || '',
    gstNumber: tenant?.gst_number || '',
    contactPhone: tenant?.contact_phone || '',
    contactEmail: tenant?.contact_email || '',
    invoiceFooter: settings.invoice_footer_message || 'Thank you for your business.',
    paymentTerms: settings.payment_terms_message || 'Payment is due within 7 days of receipt.',
  }

  return NextResponse.json({ settings: response })
}

