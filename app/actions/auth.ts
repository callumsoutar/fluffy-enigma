"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message, success: false }
  }

  // Revalidate to ensure the new auth state is recognized
  revalidatePath("/", "layout")

  return { error: null, success: true, user: data.user }
}

export async function signOut() {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath("/", "layout")
  
  return { error: null, success: true }
}
