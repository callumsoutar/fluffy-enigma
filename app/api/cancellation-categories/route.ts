import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

/**
 * GET /api/cancellation-categories
 * 
 * Fetch all active cancellation categories
 * Requires authentication and tenant membership
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

  // Fetch active cancellation categories (not voided)
  const { data: categories, error } = await supabase
    .from('cancellation_categories')
    .select('id, name, description')
    .is('voided_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching cancellation categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cancellation categories' },
      { status: 500 }
    )
  }

  return NextResponse.json({ categories: categories ?? [] })
}

