import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/auth/tenant'

/**
 * POST /api/settings/logo
 * 
 * Upload a company logo to Supabase Storage
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

  const { userId: currentUserId, userRole } = tenantContext

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

    // Generate unique filename: {user_id}/logo-{timestamp}.{ext}
    const fileExt = file.name.split('.').pop() || 'png'
    const timestamp = Date.now()
    const fileName = `${currentUserId}/logo-${timestamp}.${fileExt}`

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
    // Since the bucket is private, we must use signed URLs
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

    // Store the signed URL in settings
    // Note: Signed URLs expire after 1 year, so they may need to be refreshed
    // For production, consider storing the file path and generating signed URLs on-demand
    const logoUrl = signedUrlData.signedUrl

    // Update or create the logo_url setting
    const { data: existingSetting } = await supabase
      .from('settings')
      .select('*')
      .eq('category', 'general')
      .eq('setting_key', 'logo_url')
      .single()

    if (existingSetting) {
      // Update existing setting
      const { error: updateError } = await supabase
        .from('settings')
        .update({
          setting_value: logoUrl,
          updated_by: currentUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSetting.id)

      if (updateError) {
        console.error('Error updating logo_url setting:', updateError)
        // Don't fail the request, the file is already uploaded
      }
    } else {
      // Create new setting
      const { error: insertError } = await supabase
        .from('settings')
        .insert({
          category: 'general',
          setting_key: 'logo_url',
          setting_value: logoUrl,
          data_type: 'string',
          description: 'Company logo URL',
          is_public: false,
          is_required: false,
          created_by: currentUserId,
          updated_by: currentUserId,
        })

      if (insertError) {
        console.error('Error creating logo_url setting:', insertError)
        // Don't fail the request, the file is already uploaded
      }
    }

    // If there was a previous logo, delete it (optional cleanup)
    // This is handled by the upsert: true option above

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

  const { userId: currentUserId, userRole } = tenantContext

  // Check authorization - only owners and admins can delete logos
  const hasAccess = ['owner', 'admin'].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    )
  }

  try {
    // Get current logo URL from settings
    const { data: setting } = await supabase
      .from('settings')
      .select('*')
      .eq('category', 'general')
      .eq('setting_key', 'logo_url')
      .single()

    if (setting && setting.setting_value) {
      // Extract file path from URL
      const logoUrl = setting.setting_value as string
      // The URL format is: https://...supabase.co/storage/v1/object/public/company-logos/{user_id}/logo-{timestamp}.{ext}
      // Or signed URL format
      const pathMatch = logoUrl.match(/company-logos\/(.+)$/)
      
      if (pathMatch) {
        const fileName = pathMatch[1]
        
        // Delete from storage
        const { error: deleteError } = await supabase.storage
          .from('company-logos')
          .remove([fileName])

        if (deleteError) {
          console.error('Error deleting file:', deleteError)
          // Continue to delete the setting even if file deletion fails
        }
      }
    }

    // Delete or clear the setting
    if (setting) {
      const { error: updateError } = await supabase
        .from('settings')
        .update({
          setting_value: null,
          updated_by: currentUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', setting.id)

      if (updateError) {
        console.error('Error clearing logo_url setting:', updateError)
        return NextResponse.json(
          { error: 'Failed to clear logo setting' },
          { status: 500 }
        )
      }
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
