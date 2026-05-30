-- paleta Database Schema
-- Run this in your Supabase SQL editor

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profielen (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  naam TEXT NOT NULL,
  email TEXT NOT NULL,
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  wedstrijden_gespeeld INTEGER NOT NULL DEFAULT 0,
  gewonnen INTEGER NOT NULL DEFAULT 0,
  verloren INTEGER NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  aangemaakt_op TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bijgewerkt_op TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matches table
CREATE TABLE IF NOT EXISTS public.wedstrijden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gepland_op TIMESTAMPTZ NOT NULL,
  locatie TEXT NOT NULL DEFAULT 'Javea',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'vol', 'bezig', 'voltooid', 'geannuleerd')),
  max_spelers INTEGER NOT NULL DEFAULT 4,
  aangemaakt_door UUID REFERENCES public.profielen(id) ON DELETE SET NULL,
  aangemaakt_op TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Match signups table
CREATE TABLE IF NOT EXISTS public.aanmeldingen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedstrijd_id UUID NOT NULL REFERENCES public.wedstrijden(id) ON DELETE CASCADE,
  speler_id UUID NOT NULL REFERENCES public.profielen(id) ON DELETE CASCADE,
  team INTEGER CHECK (team IN (1, 2)),
  aangemeld_op TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wedstrijd_id, speler_id)
);

-- Match results table
CREATE TABLE IF NOT EXISTS public.resultaten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedstrijd_id UUID NOT NULL REFERENCES public.wedstrijden(id) ON DELETE CASCADE UNIQUE,
  team1_score INTEGER NOT NULL,
  team2_score INTEGER NOT NULL,
  vastgelegd_door UUID REFERENCES public.profielen(id) ON DELETE SET NULL,
  vastgelegd_op TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update bijgewerkt_op on profielen
CREATE OR REPLACE FUNCTION update_bijgewerkt_op()
RETURNS TRIGGER AS $$
BEGIN
  NEW.bijgewerkt_op = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profielen_bijgewerkt_op
  BEFORE UPDATE ON public.profielen
  FOR EACH ROW EXECUTE FUNCTION update_bijgewerkt_op();

-- Row Level Security
ALTER TABLE public.profielen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedstrijden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aanmeldingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultaten ENABLE ROW LEVEL SECURITY;

-- Profielen policies
CREATE POLICY "Iedereen kan profielen lezen" ON public.profielen
  FOR SELECT USING (true);

CREATE POLICY "Gebruikers kunnen eigen profiel aanmaken" ON public.profielen
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Gebruikers kunnen eigen profiel bijwerken" ON public.profielen
  FOR UPDATE USING (auth.uid() = id);

-- Wedstrijden policies
CREATE POLICY "Iedereen kan wedstrijden lezen" ON public.wedstrijden
  FOR SELECT USING (true);

CREATE POLICY "Admins kunnen wedstrijden aanmaken" ON public.wedstrijden
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profielen WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins kunnen wedstrijden bijwerken" ON public.wedstrijden
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profielen WHERE id = auth.uid() AND is_admin = true)
  );

-- Aanmeldingen policies
CREATE POLICY "Iedereen kan aanmeldingen lezen" ON public.aanmeldingen
  FOR SELECT USING (true);

CREATE POLICY "Ingelogde gebruikers kunnen zich aanmelden" ON public.aanmeldingen
  FOR INSERT WITH CHECK (auth.uid() = speler_id);

CREATE POLICY "Gebruikers kunnen eigen aanmelding verwijderen" ON public.aanmeldingen
  FOR DELETE USING (auth.uid() = speler_id);

CREATE POLICY "Admins kunnen aanmeldingen bijwerken (teams)" ON public.aanmeldingen
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profielen WHERE id = auth.uid() AND is_admin = true)
  );

-- Resultaten policies
CREATE POLICY "Iedereen kan resultaten lezen" ON public.resultaten
  FOR SELECT USING (true);

CREATE POLICY "Admins kunnen resultaten invoeren" ON public.resultaten
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profielen WHERE id = auth.uid() AND is_admin = true)
  );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profielen (id, naam, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'naam', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
