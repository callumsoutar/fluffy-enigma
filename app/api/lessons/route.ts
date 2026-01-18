import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role authorization check
  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) {
    return NextResponse.json({ 
      error: 'Forbidden: Insufficient permissions' 
    }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const syllabusId = searchParams.get('syllabus_id')

  let query = supabase
    .from('lessons')
    .select('*')
    .order('order', { ascending: true })

  if (syllabusId) {
    query = query.eq('syllabus_id', syllabusId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lessons: data || [] })
}

export async function POST(request: NextRequest) {
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
    const { syllabus_id, name, description, is_required, syllabus_stage } = body

    if (!syllabus_id || !name) {
      return NextResponse.json({ error: 'Syllabus ID and name are required' }, { status: 400 })
    }

    // Get the current max order for this syllabus
    const { data: currentLessons, error: fetchError } = await supabase
      .from('lessons')
      .select('order')
      .eq('syllabus_id', syllabus_id)
      .order('order', { ascending: false })
      .limit(1)

    if (fetchError) throw fetchError

    const nextOrder = currentLessons && currentLessons.length > 0 ? (currentLessons[0].order || 0) + 1 : 1

    const { data, error } = await supabase
      .from('lessons')
      .insert({
        syllabus_id,
        name: name.trim(),
        description: description?.trim() || null,
        is_required: is_required !== undefined ? is_required : true,
        syllabus_stage: syllabus_stage || null,
        order: nextOrder,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ lesson: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Invalid request body' 
    }, { status: 400 })
  }
}

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
    const { id, name, description, is_required, syllabus_stage, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('lessons')
      .update({
        name: name?.trim(),
        description: description?.trim() || null,
        is_required: is_required !== undefined ? is_required : undefined,
        syllabus_stage: syllabus_stage || null,
        is_active: is_active !== undefined ? is_active : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ lesson: data })
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Invalid request body' 
    }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  try {
    // First, get the lesson's order and syllabus_id before deletion
    const { data: lessonToDelete, error: fetchError } = await supabase
      .from('lessons')
      .select('"order", syllabus_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!lessonToDelete) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const deletedOrder = lessonToDelete.order
    const syllabusId = lessonToDelete.syllabus_id

    // Delete the lesson
    const { error: deleteError } = await supabase
      .from('lessons')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Get all lessons with order greater than the deleted lesson's order
    const { data: subsequentLessons, error: subsequentError } = await supabase
      .from('lessons')
      .select('id, "order"')
      .eq('syllabus_id', syllabusId)
      .gt('"order"', deletedOrder)
      .order('"order"', { ascending: true })

    if (subsequentError) {
      return NextResponse.json({ error: subsequentError.message }, { status: 500 })
    }

    // Reorder all subsequent lessons by decrementing their order by 1
    if (subsequentLessons && subsequentLessons.length > 0) {
      for (const lesson of subsequentLessons) {
        const { error: updateError } = await supabase
          .from('lessons')
          .update({ 
            order: lesson.order - 1,
            updated_at: new Date().toISOString() 
          })
          .eq('id', lesson.id)
        
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An error occurred during deletion' 
    }, { status: 500 })
  }
}

