import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { userRole } = tenantContext
  const hasAccess = ['owner', 'admin', 'instructor'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Insufficient permissions' 
    }, { status: 403 })
  }

  const searchParams = req.nextUrl.searchParams
  const isDefault = searchParams.get('is_default')

  let query = supabase.from('tax_rates').select('*')

  if (isDefault === 'true') {
    query = query.eq('is_default', true)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tax_rates: data || [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { userRole } = tenantContext
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Insufficient permissions' 
    }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, is_default, ...rest } = body

    if (!id) {
      return NextResponse.json({ error: "Tax rate ID is required" }, { status: 400 })
    }

    // If setting a new default, unset all others first
    if (is_default === true) {
      await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .neq('id', id)
    }

    const { data, error } = await supabase
      .from('tax_rates')
      .update({ is_default, ...rest })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tax_rate: data })
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
