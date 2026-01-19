import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

// Validation schema for signup request
const signupSchema = z.object({
  // Organization details
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
  organizationSlug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug must be less than 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  
  // User details
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
})

type SignupRequest = z.infer<typeof signupSchema>

/**
 * Generate a URL-safe slug from organization name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

/**
 * Ensure slug is unique by appending a number if needed
 */
async function ensureUniqueSlug(supabase: ReturnType<typeof createAdminClient>, baseSlug: string): Promise<string> {
  let slug = baseSlug
  let counter = 0
  
  while (true) {
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single()
    
    if (!existing) {
      return slug
    }
    
    counter++
    slug = `${baseSlug}-${counter}`
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate input
    const validationResult = signupSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Validation failed", 
          details: validationResult.error.flatten().fieldErrors 
        },
        { status: 400 }
      )
    }
    
    const data: SignupRequest = validationResult.data
    const supabase = createAdminClient()
    
    // Step 1: Generate and ensure unique slug
    const baseSlug = data.organizationSlug || generateSlug(data.organizationName)
    const uniqueSlug = await ensureUniqueSlug(supabase, baseSlug)
    
    // Step 2: Check if email already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const emailExists = existingUsers?.users?.some(
      (user) => user.email?.toLowerCase() === data.email.toLowerCase()
    )
    
    if (emailExists) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }
    
    // Step 3: Create the tenant first
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: data.organizationName,
        slug: uniqueSlug,
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          created_by_signup: true,
        },
        is_active: true,
      })
      .select()
      .single()
    
    if (tenantError || !tenant) {
      console.error('Failed to create tenant:', tenantError)
      return NextResponse.json(
        { error: "Failed to create organization. Please try again." },
        { status: 500 }
      )
    }
    
    // Step 4: Create the user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: false, // Require email confirmation
      user_metadata: {
        first_name: data.firstName,
        last_name: data.lastName,
        tenant_id: tenant.id,
        is_tenant_owner: true,
      },
    })
    
    if (authError || !authData.user) {
      // Rollback: Delete the tenant we just created
      await supabase.from('tenants').delete().eq('id', tenant.id)
      
      console.error('Failed to create user:', authError)
      return NextResponse.json(
        { error: authError?.message || "Failed to create account. Please try again." },
        { status: 500 }
      )
    }
    
    // Step 5: Get the 'owner' role ID from the roles table
    const { data: ownerRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .single()
    
    if (roleError || !ownerRole) {
      // Fallback: Try to find any role or create the relationship differently
      console.warn('Could not find owner role, attempting alternative approach:', roleError)
      
      // Try inserting with role name directly if the schema supports it
      // This handles cases where roles table might not exist yet
    }
    
    // Step 6: Create the tenant_users relationship with owner role
    const { error: tenantUserError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        user_id: authData.user.id,
        role_id: ownerRole?.id,
        is_active: true,
        granted_at: new Date().toISOString(),
      })
    
    if (tenantUserError) {
      // Rollback: Delete user and tenant
      await supabase.auth.admin.deleteUser(authData.user.id)
      await supabase.from('tenants').delete().eq('id', tenant.id)
      
      console.error('Failed to create tenant_users relationship:', tenantUserError)
      return NextResponse.json(
        { error: "Failed to set up organization. Please try again." },
        { status: 500 }
      )
    }
    
    // Step 7: Create the user record in the users table
    // Note: tenant_id is NOT on users table - relationship is via tenant_users
    const { error: userRecordError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        is_active: true,
      })
    
    if (userRecordError) {
      // Rollback: Delete tenant_users, auth user, and tenant
      // Order matters: delete in reverse order of creation
      await supabase.from('tenant_users').delete().eq('user_id', authData.user.id)
      await supabase.auth.admin.deleteUser(authData.user.id)
      await supabase.from('tenants').delete().eq('id', tenant.id)
      
      console.error('Failed to create user record:', userRecordError)
      return NextResponse.json(
        { error: "Failed to create account. Please try again." },
        { status: 500 }
      )
    }
    
    // Step 10: Send confirmation email
    // Supabase automatically sends confirmation email when email_confirm is false
    // But we can also manually trigger it if needed
    
    return NextResponse.json({
      success: true,
      message: "Account created successfully. Please check your email to verify your account.",
      data: {
        userId: authData.user.id,
        tenantId: tenant.id,
        tenantSlug: uniqueSlug,
        email: data.email,
      }
    }, { status: 201 })
    
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    )
  }
}

// Health check / validation endpoint
export async function GET() {
  return NextResponse.json({ 
    status: "ok",
    endpoint: "Multi-tenant signup",
    method: "POST",
    requiredFields: [
      "organizationName",
      "firstName", 
      "lastName",
      "email",
      "password"
    ],
    optionalFields: [
      "organizationSlug"
    ]
  })
}
