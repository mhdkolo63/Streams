-- Single Admin Role Migration
-- Ensures haskedolo@gmail.com is the admin with is_admin = true
-- Removes any super admin concept

-- Update the admin user to have is_admin = true
UPDATE public.profiles
SET is_admin = true
WHERE email = 'haskedolo@gmail.com';

-- If the user doesn't exist yet, this will be handled when they sign up
-- through a trigger or manually

-- Drop is_super_admin column if it exists (safe migration)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'is_super_admin'
    ) THEN
        ALTER TABLE public.profiles DROP COLUMN is_super_admin;
    END IF;
END $$;