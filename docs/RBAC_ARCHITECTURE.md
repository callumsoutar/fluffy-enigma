# Role-Based Access Control (RBAC) Architecture

## Executive Summary

This document outlines a production-ready, multi-layered RBAC system for Aero Safety using Supabase Auth, Row Level Security (RLS), and Next.js App Router. The architecture ensures security at every layer while optimizing for performance and maintainability.

---

## High-Level Architecture Overview

### Design Philosophy

**Defense in Depth**: Authorization is enforced at multiple layers:
1. **Database Layer (RLS)**: The ultimate source of truth - no data access without proper permissions
2. **API/Server Layer**: Validates requests before processing
3. **Frontend Layer**: Provides UX by hiding unauthorized content (never trusted for security)

**Hybrid Role Storage Strategy**:
- **Primary Source**: `user_roles` table in PostgreSQL (authoritative, queryable, auditable)
- **Performance Cache**: JWT custom claims (fast access, auto-refreshed on token renewal)
- **Rationale**: Database table provides flexibility, auditability, and complex queries. JWT claims eliminate repeated database lookups while maintaining security through RLS.

### Role Hierarchy

```
owner (highest privilege)
  └─ admin
      └─ instructor
          └─ member
              └─ student (lowest privilege)
```

**Note**: This is a flat role model (not hierarchical permissions). Each role has explicit permissions defined. Hierarchical relationships shown above are for reference only.

---

## Database Schema Design

### 1. User Roles Table

```sql
-- Create enum for roles
CREATE TYPE user_role AS ENUM (
  'owner',
  'admin',
  'instructor',
  'member',
  'student'
);

-- User roles table (one-to-one with auth.users)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure referential integrity
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles table
-- Users can read their own role
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
  );
```

### 2. Helper Functions

```sql
-- Function to get user role (used in RLS policies)
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

-- Function to check role hierarchy (for future use)
CREATE OR REPLACE FUNCTION public.user_has_minimum_role(
  minimum_role user_role,
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  role_hierarchy INT;
  user_role_value user_role;
BEGIN
  -- Define hierarchy: owner=5, admin=4, instructor=3, member=2, student=1
  SELECT 
    CASE 
      WHEN role = 'owner' THEN 5
      WHEN role = 'admin' THEN 4
      WHEN role = 'instructor' THEN 3
      WHEN role = 'member' THEN 2
      WHEN role = 'student' THEN 1
    END
  INTO role_hierarchy
  FROM public.user_roles
  WHERE user_id = user_uuid;
  
  IF role_hierarchy IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT 
    CASE 
      WHEN minimum_role = 'owner' THEN 5
      WHEN minimum_role = 'admin' THEN 4
      WHEN minimum_role = 'instructor' THEN 3
      WHEN minimum_role = 'member' THEN 2
      WHEN minimum_role = 'student' THEN 1
    END
  INTO user_role_value;
  
  RETURN role_hierarchy >= user_role_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 3. Trigger to Sync Role to JWT Claims

```sql
-- Function to update JWT custom claims when role changes
CREATE OR REPLACE FUNCTION public.handle_user_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user metadata in auth.users (this will be reflected in JWT on next token refresh)
  -- Note: This requires a database webhook or Edge Function in production
  -- For now, we'll use a database trigger that logs the change
  -- The actual JWT update happens via Edge Function (see implementation section)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on role updates
CREATE TRIGGER on_user_role_updated
  AFTER UPDATE OF role ON public.user_roles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.handle_user_role_change();
```

---

## Row Level Security (RLS) Policy Examples

### Example: Aircraft Management Table

```sql
-- Example: aircraft table
CREATE TABLE public.aircraft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tail_number TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view aircraft
CREATE POLICY "Authenticated users can view aircraft"
  ON public.aircraft
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only owners, admins, and instructors can create aircraft
CREATE POLICY "Authorized roles can create aircraft"
  ON public.aircraft
  FOR INSERT
  WITH CHECK (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );

-- Only owners, admins, and instructors can update aircraft
CREATE POLICY "Authorized roles can update aircraft"
  ON public.aircraft
  FOR UPDATE
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );

-- Only owners and admins can delete aircraft
CREATE POLICY "Owners and admins can delete aircraft"
  ON public.aircraft
  FOR DELETE
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin']::user_role[],
      auth.uid()
    )
  );
```

### Example: Occurrence Reports Table

```sql
-- Example: occurrence_reports table
CREATE TABLE public.occurrence_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.occurrence_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
  ON public.occurrence_reports
  FOR SELECT
  USING (auth.uid() = reported_by);

-- Owners, admins, and instructors can view all reports
CREATE POLICY "Authorized roles can view all reports"
  ON public.occurrence_reports
  FOR SELECT
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );

-- All authenticated users can create reports
CREATE POLICY "Authenticated users can create reports"
  ON public.occurrence_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

-- Users can update their own draft reports
CREATE POLICY "Users can update their own draft reports"
  ON public.occurrence_reports
  FOR UPDATE
  USING (
    auth.uid() = reported_by 
    AND status = 'draft'
  );

-- Owners, admins, and instructors can update any report
CREATE POLICY "Authorized roles can update any report"
  ON public.occurrence_reports
  FOR UPDATE
  USING (
    public.user_has_any_role(
      ARRAY['owner', 'admin', 'instructor']::user_role[],
      auth.uid()
    )
  );
```

---

## Implementation Plan

### Phase 1: Database Setup

1. **Create user_roles table and functions**
   - Run migration to create enum, table, indexes
   - Create helper functions for role checking
   - Set up RLS policies

2. **Create Edge Function for JWT claim updates**
   - Function to sync role from database to JWT custom claims
   - Triggered on role changes or user creation

3. **Seed initial data**
   - Create owner role for first user
   - Set up default roles for existing users

### Phase 2: Backend/Server Layer

1. **Create role utilities**
   - Server-side role checking functions
   - Type-safe role definitions

2. **Update middleware**
   - Add role-based route protection
   - Redirect unauthorized users

3. **Create API route helpers**
   - Reusable authorization checks
   - Error handling for unauthorized access

### Phase 3: Frontend Layer

1. **Extend auth context**
   - Add role to auth state
   - Create role checking hooks

2. **Create route protection components**
   - Server component wrapper for role-based pages
   - Client component for conditional rendering

3. **Update sidebar**
   - Filter navigation items by role
   - Show/hide sections dynamically

### Phase 4: Testing & Documentation

1. **Test all authorization layers**
2. **Document role permissions matrix**
3. **Create admin UI for role management**

---

## Code Implementation

### 1. TypeScript Types

```typescript
// lib/types/roles.ts
export type UserRole = 'owner' | 'admin' | 'instructor' | 'member' | 'student';

export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  MEMBER: 'member',
  STUDENT: 'student',
} as const;

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  admin: 4,
  instructor: 3,
  member: 2,
  student: 1,
};

export interface UserWithRole {
  id: string;
  email?: string;
  role: UserRole;
  user_metadata?: Record<string, any>;
}
```

### 2. Server-Side Role Utilities

```typescript
// lib/auth/roles.ts
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types/roles';

/**
 * Get the user's role from the database
 * This is the authoritative source of truth
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data.role as UserRole;
}

/**
 * Get user role from JWT custom claims (fast, cached)
 * Falls back to database lookup if not in claims
 */
export async function getUserRoleCached(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check JWT custom claims first (fast)
  const roleFromClaims = user?.user_metadata?.role as UserRole | undefined;
  if (roleFromClaims && isValidRole(roleFromClaims)) {
    return roleFromClaims;
  }
  
  // Fallback to database lookup
  return getUserRole(userId);
}

/**
 * Check if user has a specific role
 */
export async function userHasRole(
  userId: string,
  requiredRole: UserRole
): Promise<boolean> {
  const userRole = await getUserRoleCached(userId);
  if (!userRole) return false;
  
  return userRole === requiredRole;
}

/**
 * Check if user has any of the provided roles
 */
export async function userHasAnyRole(
  userId: string,
  requiredRoles: UserRole[]
): Promise<boolean> {
  const userRole = await getUserRoleCached(userId);
  if (!userRole) return false;
  
  return requiredRoles.includes(userRole);
}

/**
 * Check if user has minimum role level
 */
export async function userHasMinimumRole(
  userId: string,
  minimumRole: UserRole
): Promise<boolean> {
  const userRole = await getUserRoleCached(userId);
  if (!userRole) return false;
  
  const ROLE_HIERARCHY: Record<UserRole, number> = {
    owner: 5,
    admin: 4,
    instructor: 3,
    member: 2,
    student: 1,
  };
  
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

function isValidRole(role: string): role is UserRole {
  return ['owner', 'admin', 'instructor', 'member', 'student'].includes(role);
}
```

### 3. Middleware Enhancement

```typescript
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { getUserRoleCached } from '@/lib/auth/roles';

// Route permissions matrix
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard': ['owner', 'admin', 'instructor', 'member', 'student'],
  '/admin': ['owner', 'admin'],
  '/instructor': ['owner', 'admin', 'instructor'],
  '/reports': ['owner', 'admin', 'instructor'],
  '/settings': ['owner', 'admin'],
  '/aircraft': ['owner', 'admin', 'instructor'],
  '/members': ['owner', 'admin', 'instructor'],
  '/staff': ['owner', 'admin'],
};

export async function middleware(request: NextRequest) {
  // First, update session (handles authentication)
  const response = await updateSession(request);
  
  // Get the pathname
  const pathname = request.nextUrl.pathname;
  
  // Check if route requires specific role
  const requiredRoles = Object.entries(ROUTE_PERMISSIONS).find(([path]) =>
    pathname.startsWith(path)
  )?.[1];
  
  if (requiredRoles) {
    // Get user from session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {}, // Handled by updateSession
        },
      }
    );
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    
    // Check role
    const userRole = await getUserRoleCached(user.id);
    
    if (!userRole || !requiredRoles.includes(userRole)) {
      // Unauthorized - redirect to dashboard or show error
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 4. API Route Protection

```typescript
// app/api/aircraft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { userHasAnyRole } from '@/lib/auth/roles';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check role authorization
  const hasAccess = await userHasAnyRole(user.id, [
    'owner',
    'admin',
    'instructor',
  ]);
  
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }
  
  // Proceed with authorized request
  const { data, error } = await supabase
    .from('aircraft')
    .select('*');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ data });
}
```

### 5. Frontend Auth Context Enhancement

```typescript
// contexts/auth-context.tsx
"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { UserRole } from "@/lib/types/roles"
import { useRouter } from "next/navigation"

interface AuthContextType {
  user: User | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [role, setRole] = React.useState<UserRole | null>(null)
  const [loading, setLoading] = React.useState(true)
  const router = useRouter()
  const supabase = createClient()

  const fetchUserRole = React.useCallback(async (userId: string) => {
    try {
      // First check JWT claims (fast)
      const { data: { user } } = await supabase.auth.getUser()
      const roleFromClaims = user?.user_metadata?.role as UserRole | undefined
      
      if (roleFromClaims && ['owner', 'admin', 'instructor', 'member', 'student'].includes(roleFromClaims)) {
        setRole(roleFromClaims)
        return
      }
      
      // Fallback to database lookup
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()
      
      if (!error && data) {
        setRole(data.role as UserRole)
      } else {
        setRole(null)
      }
    } catch (error) {
      console.error("Error fetching user role:", error)
      setRole(null)
    }
  }, [supabase])

  const refreshUser = React.useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        await fetchUserRole(user.id)
      } else {
        setRole(null)
      }
    } catch (error) {
      console.error("Error refreshing user:", error)
      setUser(null)
      setRole(null)
    } finally {
      setLoading(false)
    }
  }, [supabase, fetchUserRole])

  React.useEffect(() => {
    refreshUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchUserRole(session.user.id)
      } else {
        setRole(null)
      }
      
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, refreshUser, fetchUserRole])

  const signOut = React.useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setRole(null)
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Error signing out:", error)
      throw error
    }
  }, [supabase, router])

  const hasRole = React.useCallback((requiredRole: UserRole): boolean => {
    return role === requiredRole
  }, [role])

  const hasAnyRole = React.useCallback((requiredRoles: UserRole[]): boolean => {
    if (!role) return false
    return requiredRoles.includes(role)
  }, [role])

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signOut,
        refreshUser,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
```

### 6. Route Protection Component

```typescript
// components/auth/role-guard.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRoleCached } from '@/lib/auth/roles'
import type { UserRole } from '@/lib/types/roles'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
}

export async function RoleGuard({
  children,
  allowedRoles,
  fallback,
}: RoleGuardProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const userRole = await getUserRoleCached(user.id)

  if (!userRole || !allowedRoles.includes(userRole)) {
    if (fallback) {
      return <>{fallback}</>
    }
    redirect('/dashboard?error=unauthorized')
  }

  return <>{children}</>
}
```

### 7. Sidebar Role-Based Filtering

```typescript
// components/app-sidebar.tsx (updated)
"use client"

import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types/roles"

// Define navigation items with required roles
const navigationConfig = {
  main: [
    {
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: IconHome,
          roles: ['owner', 'admin', 'instructor', 'member', 'student'] as UserRole[],
        },
        {
          title: "Scheduler",
          url: "/scheduler",
          icon: IconCalendar,
          roles: ['owner', 'admin', 'instructor', 'member'] as UserRole[],
        },
        {
          title: "Bookings",
          url: "/bookings",
          icon: IconBook,
          roles: ['owner', 'admin', 'instructor', 'member', 'student'] as UserRole[],
        },
      ],
    },
    {
      label: "Resources",
      items: [
        {
          title: "Aircraft",
          url: "/aircraft",
          icon: IconPlane,
          roles: ['owner', 'admin', 'instructor'] as UserRole[],
        },
        {
          title: "Members",
          url: "/members",
          icon: IconUsers,
          roles: ['owner', 'admin', 'instructor'] as UserRole[],
        },
        {
          title: "Staff",
          url: "/staff",
          icon: IconUserCog,
          roles: ['owner', 'admin'] as UserRole[],
        },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          title: "Invoicing",
          url: "/invoicing",
          icon: IconFileInvoice,
          roles: ['owner', 'admin', 'instructor'] as UserRole[],
        },
        {
          title: "Training",
          url: "/training",
          icon: IconSchool,
          roles: ['owner', 'admin', 'instructor'] as UserRole[],
        },
        {
          title: "Equipment",
          url: "/equipment",
          icon: IconTool,
          roles: ['owner', 'admin', 'instructor'] as UserRole[],
        },
      ],
    },
    {
      label: "Management",
      items: [
        {
          title: "Tasks",
          url: "/tasks",
          icon: IconCheckbox,
          roles: ['owner', 'admin', 'instructor'] as UserRole[],
        },
        {
          title: "Reports",
          url: "/reports",
          icon: IconReport,
          roles: ['owner', 'admin', 'instructor'] as UserRole[],
        },
      ],
    },
  ],
  secondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
      roles: ['owner', 'admin'] as UserRole[],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, role, loading } = useAuth()

  // Filter navigation items based on user role
  const filteredNavMain = React.useMemo(() => {
    if (!role) return []
    
    return navigationConfig.main.map(section => ({
      ...section,
      items: section.items.filter(item => 
        item.roles.includes(role)
      ),
    })).filter(section => section.items.length > 0)
  }, [role])

  const filteredNavSecondary = React.useMemo(() => {
    if (!role) return []
    
    return navigationConfig.secondary.filter(item =>
      item.roles.includes(role)
    )
  }, [role])

  // ... rest of component
}
```

### 8. Edge Function for JWT Claim Updates

```typescript
// supabase/functions/update-user-role/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { userId, role } = await req.json()

    if (!userId || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update user metadata (this will be reflected in JWT on next token refresh)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: { role }
      }
    )

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### 9. Database Trigger to Call Edge Function

```sql
-- Create a function to call the Edge Function when role changes
CREATE OR REPLACE FUNCTION public.sync_role_to_jwt()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'https://fergmobsjyucucxeumvb.supabase.co/functions/v1/update-user-role';
  service_role_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Call Edge Function to update JWT claims
  PERFORM
    net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'role', NEW.role
      )
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger
DROP TRIGGER IF EXISTS on_user_role_updated ON public.user_roles;
CREATE TRIGGER on_user_role_updated
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_to_jwt();
```

---

## Role Change Propagation

### How Role Changes Work

1. **Database Update**: Admin/owner updates role in `user_roles` table
2. **Trigger Fires**: Database trigger calls Edge Function
3. **JWT Update**: Edge Function updates `user_metadata.role` in `auth.users`
4. **Token Refresh**: On next token refresh (automatic or manual), new JWT includes updated role
5. **Frontend Sync**: Auth context detects role change and updates UI

### Manual Token Refresh

```typescript
// Force token refresh to get updated role
const { data: { session } } = await supabase.auth.refreshSession()
```

### Immediate UI Update

When a role is changed:
1. Frontend can call `refreshUser()` from auth context
2. This fetches the latest role from database
3. UI updates immediately (no need to wait for token refresh)

---

## Security Considerations

### 1. Never Trust Frontend-Only Checks

- Frontend role checks are for UX only (hiding/showing UI)
- All security must be enforced at the database (RLS) and API layers
- Users can bypass frontend checks by directly calling APIs

### 2. RLS is the Ultimate Authority

- Even if middleware/API checks pass, RLS will block unauthorized queries
- This provides defense in depth
- RLS policies should be tested thoroughly

### 3. JWT Claims are Cached, Not Authoritative

- JWT claims provide performance optimization
- Always validate against database for critical operations
- Use database functions in RLS policies (not JWT claims)

### 4. Service Role Key Security

- Never expose service role key to client
- Only use in server-side code or Edge Functions
- Store securely in environment variables

### 5. Role Assignment Security

- Only owners/admins can assign roles
- Enforce this in both application logic and RLS policies
- Audit role changes (add audit log table)

---

## Performance Optimizations

### 1. JWT Claims Caching

- Role stored in JWT custom claims eliminates database lookups
- Token automatically refreshes, keeping claims up-to-date
- Fallback to database if claims missing

### 2. Database Indexes

- Index on `user_roles.user_id` for fast lookups
- Index on `user_roles.role` for role-based queries

### 3. RLS Function Optimization

- Use `SECURITY DEFINER` functions for RLS (bypasses RLS on function execution)
- Mark functions as `STABLE` for query optimization
- Cache role lookups within transaction

### 4. Frontend Caching

- Role stored in React context (no repeated lookups)
- Only refetch on auth state changes
- Use React Query for additional caching if needed

---

## Testing Strategy

### 1. Unit Tests

- Test role checking functions
- Test RLS policy functions
- Test role hierarchy logic

### 2. Integration Tests

- Test API routes with different roles
- Test middleware redirects
- Test database queries with RLS

### 3. E2E Tests

- Test login flow for each role
- Test sidebar filtering
- Test route protection
- Test role change propagation

---

## Migration Checklist

- [ ] Create `user_role` enum
- [ ] Create `user_roles` table
- [ ] Create helper functions (`get_user_role`, `user_has_role`, etc.)
- [ ] Set up RLS policies for `user_roles` table
- [ ] Create Edge Function for JWT claim updates
- [ ] Set up database trigger
- [ ] Create TypeScript types
- [ ] Implement server-side role utilities
- [ ] Update middleware with role checks
- [ ] Update auth context with role
- [ ] Create role guard component
- [ ] Update sidebar with role filtering
- [ ] Add RLS policies to all application tables
- [ ] Test role changes and propagation
- [ ] Document role permissions matrix
- [ ] Create admin UI for role management

---

## Role Permissions Matrix

| Feature | Owner | Admin | Instructor | Member | Student |
|---------|-------|-------|------------|--------|---------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Scheduler | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create Bookings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Aircraft | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Members | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage Staff | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Reports | ✅ | ✅ | ✅ | ✅ | ✅ |
| View All Reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign Roles | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Conclusion

This RBAC architecture provides:

✅ **Security**: Multi-layer enforcement (RLS, API, Frontend)  
✅ **Performance**: JWT claims caching, optimized queries  
✅ **Maintainability**: Clear separation of concerns, type safety  
✅ **Scalability**: Database-driven, easily extensible  
✅ **User Experience**: Fast, responsive UI with proper access control  

The system is production-ready and follows Supabase and Next.js best practices.
