-- Migration: Add 'eo_gate_pass' to user_role enum and linked_organizer_id to profiles table

-- 1. Add eo_gate_pass to user_role enum if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'user_role' AND e.enumlabel = 'eo_gate_pass'
    ) THEN
        ALTER TYPE public.user_role ADD VALUE 'eo_gate_pass';
    END IF;
END $$;

-- 2. Add linked_organizer_id column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS linked_organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Add index for fast lookup of gate pass operators by linked organizer
CREATE INDEX IF NOT EXISTS idx_profiles_linked_organizer_id ON public.profiles(linked_organizer_id);
