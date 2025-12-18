import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/settings
 * 
 * Fetch settings from the settings table
 * Requires authentication
 * 
 * Query parameters:
 * - category: string - Filter by category
 * - key: string - Filter by setting key
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

  // Get query parameters
  const searchParams = request.nextUrl.searchParams
  const category = searchParams.get('category')
  const key = searchParams.get('key')

  // Build query
  let query = supabase
    .from('settings')
    .select('*')

  // Apply filters
  if (category) {
    query = query.eq('category', category)
  }

  if (key) {
    query = query.eq('setting_key', key)
  }

  // Execute query
  const { data: settings, error } = await query

  if (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }

  // If both category and key are provided, return single setting
  if (category && key && settings && settings.length > 0) {
    return NextResponse.json({
      setting: settings[0],
    })
  }

  return NextResponse.json({
    settings: settings || [],
  })
}
