# Supabase Authentication Setup Guide

This guide will help you set up Supabase Authentication for Flight Desk Pro.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js and npm installed
- PowerShell (for Windows)

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in your project details:
   - Name: `flight-desk-pro` (or your preferred name)
   - Database Password: Create a strong password (save this!)
   - Region: Choose the closest region to your users
4. Click "Create new project" and wait for it to be set up (2-3 minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll need two values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")

## Step 3: Create Environment Variables File

1. In the root of your project, create a file named `.env.local`
2. Add the following content:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Replace `your-project-url-here` with your Project URL
4. Replace `your-anon-key-here` with your anon/public key

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI4MCwiZXhwIjoxOTU0NTQzMjgwfQ.example
```

## Step 4: Configure Supabase Authentication

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider (should be enabled by default)
3. Configure email settings:
   - **Enable email confirmations**: Optional (recommended for production)
   - **Enable email change confirmations**: Optional
4. (Optional) Enable other providers like Google, GitHub, etc. if needed

## Step 5: Create Your First User

### Option A: Via Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. Enter email and password
4. Click "Create user"

### Option B: Via Sign Up (if you add a sign-up page)

Users can sign up directly through the application if you implement a sign-up form.

## Step 6: Install Supabase CLI (Optional but Recommended)

The Supabase CLI is useful for local development and database migrations.

### For Windows (PowerShell):

```powershell
# Using Scoop (recommended)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or using npm
npm install -g supabase
```

### Verify Installation:

```powershell
supabase --version
```

## Step 7: Test the Setup

1. Start your development server:
   ```powershell
   npm run dev
   ```

2. Navigate to `http://localhost:3000/login`
3. Try logging in with the user you created
4. You should be redirected to `/dashboard` upon successful login

## Troubleshooting

### Error: "Invalid API key"
- Double-check your `.env.local` file
- Ensure there are no extra spaces or quotes around the values
- Restart your development server after changing `.env.local`

### Error: "Email not confirmed"
- Go to Supabase Dashboard → Authentication → Users
- Find your user and click "Confirm email" or disable email confirmation in settings

### Error: "User not found"
- Make sure you've created a user in Supabase
- Check that the email matches exactly (case-sensitive)

### Session not persisting
- Ensure middleware is properly set up (already configured in this project)
- Check browser console for errors
- Verify cookies are being set

## Next Steps

- Set up Row Level Security (RLS) policies for your database tables
- Configure email templates in Supabase Dashboard
- Add password reset functionality
- Implement role-based access control (Admin, Instructor, Student)

## Security Notes

- Never commit `.env.local` to version control (it's already in `.gitignore`)
- The `anon` key is safe to use in client-side code
- For server-side operations requiring elevated permissions, use the `service_role` key (keep this secret!)

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)

