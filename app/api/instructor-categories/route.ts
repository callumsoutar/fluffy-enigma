import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireStaffAccess } from "@/lib/api/require-staff-access"

export async function GET(request: NextRequest) {
  const unauthorized = await requireStaffAccess(request)
  if (unauthorized) {
    return unauthorized
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("instructor_categories")
    .select("id, name")
    .order("name", { ascending: true })

  if (error) {
    console.error("Failed to load instructor categories:", error)
    return NextResponse.json(
      { error: "Failed to load instructor categories" },
      { status: 500 }
    )
  }

  return NextResponse.json({ categories: data ?? [] })
}

