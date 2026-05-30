-- ============================================================
-- Expansion: multi-sport / multi-club data model
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- ── Sports ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sports_select_all"   ON sports;
DROP POLICY IF EXISTS "sports_write_admin"  ON sports;

CREATE POLICY "sports_select_all"  ON sports FOR SELECT USING (true);
CREATE POLICY "sports_write_admin" ON sports FOR ALL
  USING      (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true))
  WITH CHECK (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true));

-- ── Clubs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  location   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs_select_all"   ON clubs;
DROP POLICY IF EXISTS "clubs_write_admin"  ON clubs;

CREATE POLICY "clubs_select_all"  ON clubs FOR SELECT USING (true);
CREATE POLICY "clubs_write_admin" ON clubs FOR ALL
  USING      (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true))
  WITH CHECK (auth.uid() IN (SELECT id FROM profielen WHERE is_admin = true));

-- ── FK columns ────────────────────────────────────────────────────────────
-- Nullable on all tables so existing rows are not broken; backfill below.

-- Core match/event tables
ALTER TABLE events          ADD COLUMN IF NOT EXISTS sport_id UUID REFERENCES sports(id) ON DELETE SET NULL;
ALTER TABLE events          ADD COLUMN IF NOT EXISTS club_id  UUID REFERENCES clubs(id)  ON DELETE SET NULL;
ALTER TABLE wedstrijden     ADD COLUMN IF NOT EXISTS sport_id UUID REFERENCES sports(id) ON DELETE SET NULL;
ALTER TABLE wedstrijden     ADD COLUMN IF NOT EXISTS club_id  UUID REFERENCES clubs(id)  ON DELETE SET NULL;

-- Event sub-tables — same club as their parent event
ALTER TABLE event_signups   ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;
ALTER TABLE event_matches   ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- Player profiles — home club for the player
ALTER TABLE profielen       ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- ── Seed: Padel sport + Javea club ────────────────────────────────────────
DO $$
DECLARE
  padel_id UUID;
  javea_id UUID;
BEGIN
  INSERT INTO sports (name, slug) VALUES ('Padel', 'padel')
    ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO padel_id FROM sports WHERE slug = 'padel';

  INSERT INTO clubs (name, slug, location) VALUES ('Javea', 'javea', 'Javea, Costa Blanca, Spain')
    ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO javea_id FROM clubs WHERE slug = 'javea';

  -- Backfill all existing rows to the Javea / Padel club
  UPDATE events         SET sport_id = padel_id, club_id = javea_id WHERE club_id IS NULL;
  UPDATE wedstrijden    SET sport_id = padel_id, club_id = javea_id WHERE club_id IS NULL;
  UPDATE event_signups  SET club_id  = javea_id                       WHERE club_id IS NULL;
  UPDATE event_matches  SET club_id  = javea_id                       WHERE club_id IS NULL;
  UPDATE profielen      SET club_id  = javea_id                       WHERE club_id IS NULL;
END $$;
