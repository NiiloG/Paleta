-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS).

ALTER TABLE public.profielen ADD COLUMN IF NOT EXISTS phone TEXT;
