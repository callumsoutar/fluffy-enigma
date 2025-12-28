-- Migration: Secure RLS policies for landing_fee_rates
-- Update policies to restrict mutations to admin/owner only
-- Allow instructors to read for booking purposes

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to read landing fee
  rates" ON landing_fee_rates;
DROP POLICY IF EXISTS "Allow authenticated users to insert landing fee
  rates" ON landing_fee_rates;
DROP POLICY IF EXISTS "Allow authenticated users to update landing fee
  rates" ON landing_fee_rates;
DROP POLICY IF EXISTS "Allow authenticated users to delete landing fee
  rates" ON landing_fee_rates;

-- Create secure role-based policies

-- Policy: Allow instructor/admin/owner to view landing fee rates
CREATE POLICY "Instructor and above can view landing fee rates"
  ON landing_fee_rates
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT ur.user_id 
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name IN ('owner', 'admin', 'instructor')
        AND ur.is_active = true
        AND r.is_active = true
    )
  );

-- Policy: Allow admin/owner to insert landing fee rates
CREATE POLICY "Admin and owner can insert landing fee rates"
  ON landing_fee_rates
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT ur.user_id 
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name IN ('owner', 'admin')
        AND ur.is_active = true
        AND r.is_active = true
    )
  );

-- Policy: Allow admin/owner to update landing fee rates
CREATE POLICY "Admin and owner can update landing fee rates"
  ON landing_fee_rates
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT ur.user_id 
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name IN ('owner', 'admin')
        AND ur.is_active = true
        AND r.is_active = true
    )
  );

-- Policy: Allow admin/owner to delete landing fee rates
CREATE POLICY "Admin and owner can delete landing fee rates"
  ON landing_fee_rates
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT ur.user_id 
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name IN ('owner', 'admin')
        AND ur.is_active = true
        AND r.is_active = true
    )
  );

-- Add helpful comment
COMMENT ON TABLE landing_fee_rates IS 'Stores aircraft-type-specific rates for landing fees. Protected by RLS - instructors can view, only admins/owners can modify.';

