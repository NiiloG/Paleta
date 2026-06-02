-- Run this in the Supabase SQL editor before deploying the updated match system.
-- All statements use IF NOT EXISTS / OR REPLACE so it is safe to re-run.

-- 0. Global app settings table (single row)
CREATE TABLE IF NOT EXISTS public.instellingen (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  matches_enabled BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO public.instellingen (id, matches_enabled) VALUES (1, true)
  ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.instellingen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read settings" ON public.instellingen;
CREATE POLICY "Anyone can read settings" ON public.instellingen FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can update settings" ON public.instellingen;
CREATE POLICY "Admins can update settings" ON public.instellingen FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profielen WHERE id = auth.uid() AND is_admin = true)
);

-- 1. Add court booking confirmation field
ALTER TABLE public.wedstrijden
  ADD COLUMN IF NOT EXISTS court_booking_confirmed BOOLEAN NOT NULL DEFAULT false;

-- 2. Add gender / level requirement fields (mirrors the events table)
ALTER TABLE public.wedstrijden ADD COLUMN IF NOT EXISTS match_type TEXT;
ALTER TABLE public.wedstrijden ADD COLUMN IF NOT EXISTS min_level  NUMERIC;
ALTER TABLE public.wedstrijden ADD COLUMN IF NOT EXISTS max_level  NUMERIC;

-- 3. Allow any logged-in user to create a match (previously admin-only)
DROP POLICY IF EXISTS "Admins kunnen wedstrijden aanmaken" ON public.wedstrijden;
CREATE POLICY "Ingelogde gebruikers kunnen wedstrijden aanmaken" ON public.wedstrijden
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Creator or admin can update their match
DROP POLICY IF EXISTS "Admins kunnen wedstrijden bijwerken" ON public.wedstrijden;
CREATE POLICY "Aanmaker of admin kan wedstrijd bijwerken" ON public.wedstrijden
  FOR UPDATE USING (
    aangemaakt_door = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profielen WHERE id = auth.uid() AND is_admin = true)
  );
