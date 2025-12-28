import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role authorization check
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin'])
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Insufficient permissions' 
    }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { lesson_orders } = body

    if (!Array.isArray(lesson_orders)) {
      return NextResponse.json({ error: 'lesson_orders must be an array' }, { status: 400 })
    }

    // Perform updates in a loop (Supabase doesn't support batch updates with different values easily in a single call without a RPC)
    // For a small number of lessons, this is generally fine.
    for (const item of lesson_orders) {
      const { error } = await supabase
        .from('lessons')
        .update({ order: item.order, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An error occurred during reordering' 
    }, { status: 500 })
  }
}

