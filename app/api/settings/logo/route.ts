import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

/**
 * POST /api/settings/logo
 * 
 * Upload a company logo to Supabase Storage
 * Stores the logo URL on the tenants table
 * Requires authentication and owner/admin role
 * 
 * Body (FormData):
 * - file: File - The logo image file
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
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

  const { tenantId, userRole } = tenantContext

  // Check authorization - only owners and admins can upload logos
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPG, GIF, and WEBP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    // Generate unique filename: {tenant_id}/logo-{timestamp}.{ext}
    const fileExt = file.name.split('.').pop() || 'png'
    const timestamp = Date.now()
    const fileName = `${tenantId}/logo-${timestamp}.${fileExt}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true, // Replace existing file if it exists
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      )
    }

    // Get signed URL for private access (valid for 1 year)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('company-logos')
      .createSignedUrl(fileName, 31536000) // 1 year in seconds

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to generate file URL', details: signedUrlError.message },
        { status: 500 }
      )
    }

    if (!signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: 'Failed to generate file URL' },
        { status: 500 }
      )
    }

    const logoUrl = signedUrlData.signedUrl

    // Update the logo_url on the tenants table
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (updateError) {
      console.error('Error updating tenant logo_url:', updateError)
      // Don't fail the request, the file is already uploaded
    }

    return NextResponse.json({
      success: true,
      url: logoUrl,
      path: fileName,
    })
  } catch (error) {
    console.error('Error in logo upload:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/logo
 * 
 * Delete the company logo
 * Clears the logo_url from the tenants table
 * Requires authentication and owner/admin role
 */
export async function DELETE() {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
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

  const { tenantId, userRole } = tenantContext

  // Check authorization - only owners and admins can delete logos
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    // Get current tenant to check for existing logo
    const { data: tenant } = await supabase
      .from('tenants')
      .select('logo_url')
      .eq('id', tenantId)
      .single()

    if (tenant?.logo_url) {
      // Extract file path from URL
      const logoUrl = tenant.logo_url as string
      const pathMatch = logoUrl.match(/company-logos\/(.+?)(?:\?|$)/)
      
      if (pathMatch) {
        const fileName = pathMatch[1]
        
        // Delete from storage
        const { error: deleteError } = await supabase.storage
          .from('company-logos')
          .remove([fileName])

        if (deleteError) {
          console.error('Error deleting file:', deleteError)
          // Continue to clear the setting even if file deletion fails
        }
      }
    }

    // Clear the logo_url on the tenants table
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        logo_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (updateError) {
      console.error('Error clearing tenant logo_url:', updateError)
      return NextResponse.json(
        { error: 'Failed to clear logo' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Logo deleted successfully',
    })
  } catch (error) {
    console.error('Error in logo deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
