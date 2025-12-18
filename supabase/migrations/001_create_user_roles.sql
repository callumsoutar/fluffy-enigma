-- Migration: Create user roles system
-- This migration sets up the RBAC infrastructure

-- Step 1: Create user_role enum
CREATE TYPE user_role AS ENUM (
  'owner',
  'admin',
  'instructor',
  'member',
  'student'
);

-- Step 2: Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Step 4: Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for user_roles table

-- Users can view their own role
CREATE POLICY "Users can view their own role"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Owners and admins can view all roles
CREATE POLICY "Owners and admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Only owners and admins can update roles
CREATE POLICY "Owners and admins can update roles"
  ON public.user_roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Only owners can insert new roles (or system during user creation)
CREATE POLICY "Owners can insert roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
    OR auth.uid() = user_id  -- Allow users to create their own role on signup
  );

-- Step 6: Create helper functions for role checking

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS user_role AS $$
  SELECT role FROM public.user_roles WHERE user_id = user_uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if user has role
CREATE OR REPLACE FUNCTION public.user_has_role(
  required_role user_role,
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid
    AND role = required_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if user has any of the provided roles
CREATE OR REPLACE FUNCTION public.user_has_any_role(
  required_roles user_role[],
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid
    AND role = ANY(required_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check role hierarchy
CREATE OR REPLACE FUNCTION public.user_has_minimum_role(
  minimum_role user_role,
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  role_hierarchy INT;
  minimum_hierarchy INT;
BEGIN
  -- Get user's role hierarchy value
  SELECT 
    CASE 
      WHEN role = 'owner' THEN 5
      WHEN role = 'admin' THEN 4
      WHEN role = 'instructor' THEN 3
      WHEN role = 'member' THEN 2
      WHEN role = 'student' THEN 1
      ELSE 0
    END
  INTO role_hierarchy
  FROM public.user_roles
  WHERE user_id = user_uuid;
  
  IF role_hierarchy IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get minimum required hierarchy value
  SELECT 
    CASE 
      WHEN minimum_role = 'owner' THEN 5
      WHEN minimum_role = 'admin' THEN 4
      WHEN minimum_role = 'instructor' THEN 3
      WHEN minimum_role = 'member' THEN 2
      WHEN minimum_role = 'student' THEN 1
      ELSE 0
    END
  INTO minimum_hierarchy;
  
  RETURN role_hierarchy >= minimum_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 7: Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Step 8: Create function to automatically assign 'student' role to new users
-- This can be called from a database webhook or Edge Function
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger for assign_default_role should be set up via Supabase Dashboard
-- or Edge Function, as we can't directly create triggers on auth.users table
-- See implementation guide for setting up the webhook/Edge Function
