-- ============================================================
-- Americano event system
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- 1. Drop old trigger-based approach if it was applied previously
DROP TRIGGER IF EXISTS set_player_number ON profielen;
DROP FUNCTION IF EXISTS public.assign_player_number();

-- 2. Create sequence in the public schema
CREATE SEQUENCE IF NOT EXISTS public.player_number_seq START 1;

-- 3. Add nullable column (no default yet, so existing handle_new_user inserts still work)
ALTER TABLE profielen ADD COLUMN IF NOT EXISTS player_number INT;

-- 4. Backfill existing players in signup order
UPDATE profielen SET player_number = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY aangemaakt_op ASC) AS rn
  FROM profielen
  WHERE player_number IS NULL
) sub
WHERE profielen.id = sub.id;

-- 5. Advance sequence past all assigned numbers so the next new user
--    gets a number that doesn't clash with backfilled ones
SELECT setval('public.player_number_seq', COALESCE(MAX(player_number), 0) + 1, false)
FROM profielen;

-- 6. Attach DEFAULT so new rows get the next value automatically —
--    no trigger needed, no search_path issues
ALTER TABLE profielen
  ALTER COLUMN player_number SET DEFAULT nextval('public.player_number_seq'::regclass);

-- 7. Unique index (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS profielen_player_number_key ON profielen (player_number);

-- ============================================================
-- Update handle_new_user to accept starting ELO from metadata
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profielen (id, naam, email, elo_rating)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'naam', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'elo_rating')::int, 1000)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Events table
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  datetime     TIMESTAMPTZ NOT NULL,
  location     TEXT NOT NULL,
  organizer    TEXT,
  court_count  INT NOT NULL DEFAULT 2 CHECK (court_count >= 1),
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID REFERENCES profielen(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent: add organizer column if table already exists from a previous run
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer TEXT;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_all"   ON events;
DROP POLICY IF EXISTS "events_insert_admin" ON events;
DROP POLICY IF EXISTS "events_update_admin" ON events;
DROP POLICY IF EXISTS "events_delete_admin" ON events;

CREATE POLICY "events_select_all"   ON events FOR SELECT USING (true);
CREATE POLICY "events_insert_admin" ON events FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true));
CREATE POLICY "events_update_admin" ON events FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true));
CREATE POLICY "events_delete_admin" ON events FOR DELETE
  USING (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true));

-- ============================================================
-- Event signups table
-- ============================================================
CREATE TABLE IF NOT EXISTS event_signups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id     UUID NOT NULL REFERENCES profielen(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'waitlisted')),
  elo_at_signup INT NOT NULL DEFAULT 1000,
  signed_up_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, player_id)
);

ALTER TABLE event_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_signups_select_all"   ON event_signups;
DROP POLICY IF EXISTS "event_signups_insert_own"   ON event_signups;
DROP POLICY IF EXISTS "event_signups_delete_own"   ON event_signups;
DROP POLICY IF EXISTS "event_signups_update_admin" ON event_signups;

CREATE POLICY "event_signups_select_all"   ON event_signups FOR SELECT USING (true);
CREATE POLICY "event_signups_insert_own"   ON event_signups FOR INSERT
  WITH CHECK (auth.uid() = player_id);
CREATE POLICY "event_signups_delete_own"   ON event_signups FOR DELETE
  USING (auth.uid() = player_id);
CREATE POLICY "event_signups_update_admin" ON event_signups FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true));

-- ============================================================
-- Event matches table
-- ============================================================
CREATE TABLE IF NOT EXISTS event_matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  court_number INT NOT NULL,
  round_number INT NOT NULL,
  player_a1    UUID REFERENCES profielen(id) ON DELETE SET NULL,
  player_a2    UUID REFERENCES profielen(id) ON DELETE SET NULL,
  player_b1    UUID REFERENCES profielen(id) ON DELETE SET NULL,
  player_b2    UUID REFERENCES profielen(id) ON DELETE SET NULL,
  team_a_score INT CHECK (team_a_score >= 0),
  team_b_score INT CHECK (team_b_score >= 0),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, court_number, round_number)
);

ALTER TABLE event_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_matches_select_all"   ON event_matches;
DROP POLICY IF EXISTS "event_matches_insert_admin" ON event_matches;
DROP POLICY IF EXISTS "event_matches_update_admin" ON event_matches;
DROP POLICY IF EXISTS "event_matches_delete_admin" ON event_matches;

CREATE POLICY "event_matches_select_all"   ON event_matches FOR SELECT USING (true);
CREATE POLICY "event_matches_insert_admin" ON event_matches FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true));
CREATE POLICY "event_matches_update_admin" ON event_matches FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true));
CREATE POLICY "event_matches_delete_admin" ON event_matches FOR DELETE
  USING (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true));
