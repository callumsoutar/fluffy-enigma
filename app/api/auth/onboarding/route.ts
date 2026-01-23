import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

// Validation schema for onboarding request
const onboardingSchema = z.object({
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
  organizationSlug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug must be less than 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  userId: z.string().uuid("Invalid user ID"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email"),
})

type OnboardingRequest = z.infer<typeof onboardingSchema>

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
    // Verify the user is authenticated
    const serverSupabase = await createClient()
    const { data: claimsData } = await serverSupabase.auth.getClaims()
    const claims = claimsData?.claims

    const {
      data: { session },
    } = await serverSupabase.auth.getSession()
    const currentUser = claims?.sub && session?.user?.id === claims.sub ? session.user : null
    
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    
    // Validate input
    const validationResult = onboardingSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Validation failed", 
          details: validationResult.error.flatten().fieldErrors 
        },
        { status: 400 }
      )
    }
    
    const data: OnboardingRequest = validationResult.data
    
    // Ensure the user is setting up their own account
    if (data.userId !== currentUser.id) {
      return NextResponse.json(
        { error: "Cannot create organization for another user" },
        { status: 403 }
      )
    }
    
    const adminSupabase = createAdminClient()
    
    // Check if user already has a tenant membership
    const { data: existingMembership } = await adminSupabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', data.userId)
      .limit(1)
      .single()
    
    if (existingMembership) {
      return NextResponse.json(
        { error: "You already belong to an organization" },
        { status: 409 }
      )
    }
    
    // Step 1: Generate and ensure unique slug
    const baseSlug = data.organizationSlug || generateSlug(data.organizationName)
    const uniqueSlug = await ensureUniqueSlug(adminSupabase, baseSlug)
    
    // Step 2: Create the tenant
    const { data: tenant, error: tenantError } = await adminSupabase
      .from('tenants')
      .insert({
        name: data.organizationName,
        slug: uniqueSlug,
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          created_by_oauth_onboarding: true,
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
    
    // Step 3: Get the 'owner' role ID
    const { data: ownerRole, error: roleError } = await adminSupabase
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .single()
    
    if (roleError || !ownerRole) {
      // Rollback: Delete tenant
      await adminSupabase.from('tenants').delete().eq('id', tenant.id)
      
      console.error('Could not find owner role:', roleError)
      return NextResponse.json(
        { error: "System configuration error. Please contact support." },
        { status: 500 }
      )
    }
    
    // Step 4: Create tenant_users record
    const { error: tenantUserError } = await adminSupabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        user_id: data.userId,
        role_id: ownerRole.id,
        is_active: true,
        granted_at: new Date().toISOString(),
      })
    
    if (tenantUserError) {
      // Rollback: Delete tenant
      await adminSupabase.from('tenants').delete().eq('id', tenant.id)
      
      console.error('Failed to create tenant_users:', tenantUserError)
      return NextResponse.json(
        { error: "Failed to set up organization. Please try again." },
        { status: 500 }
      )
    }
    
    // Step 5: Create or update user record
    // Note: tenant_id is NOT on users table - relationship is via tenant_users
    const { error: userRecordError } = await adminSupabase
      .from('users')
      .upsert({
        id: data.userId,
        email: data.email,
        first_name: data.firstName || '',
        last_name: data.lastName || '',
        is_active: true,
      }, {
        onConflict: 'id',
      })
    
    if (userRecordError) {
      // Rollback: Delete tenant_users and tenant
      await adminSupabase.from('tenant_users').delete().eq('user_id', data.userId).eq('tenant_id', tenant.id)
      await adminSupabase.from('tenants').delete().eq('id', tenant.id)
      
      console.error('Failed to create/update user record:', userRecordError)
      return NextResponse.json(
        { error: "Failed to set up your profile. Please try again." },
        { status: 500 }
      )
    }
    
    // Step 8: Update user metadata with tenant_id
    await adminSupabase.auth.admin.updateUserById(data.userId, {
      user_metadata: {
        ...currentUser.user_metadata,
        tenant_id: tenant.id,
        is_tenant_owner: true,
      }
    })
    
    return NextResponse.json({
      success: true,
      message: "Organization created successfully",
      data: {
        tenantId: tenant.id,
        tenantSlug: uniqueSlug,
        tenantName: data.organizationName,
      }
    }, { status: 201 })
    
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    )
  }
}
