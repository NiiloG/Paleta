// ── Expansion: multi-sport / multi-club ───────────────────────────────────
export interface Sport {
  id:   string
  name: string
  slug: string
}

export interface Club {
  id:       string
  name:     string
  slug:     string
  location: string | null
}

// ── Admin ─────────────────────────────────────────────────────────────────

export interface Location {
  id: string
  name: string
  address: string | null
  maps_url: string | null
  extra_info: string | null
  booking_deadline_hours: number | null
  created_at: string
}

export interface Cost {
  id: string
  description: string
  amount: number
  date: string
  is_monthly: boolean
  created_at: string
}

export interface AdminUserRow {
  id: string
  naam: string
  email: string
  phone: string | null
  player_number: number | null
  is_admin: boolean
  email_confirmed: boolean
  aangemaakt_op: string
}

// ── App ───────────────────────────────────────────────────────────────────
export type WedstrijdStatus = 'open' | 'vol' | 'bezig' | 'voltooid' | 'geannuleerd'

export interface Profiel {
  id: string
  naam: string
  email: string
  elo_rating: number
  wedstrijden_gespeeld: number
  gewonnen: number
  verloren: number
  is_admin: boolean
  aangemaakt_op: string
  player_number: number | null
  phone: string | null
  club_id: string | null
  email_notifications: boolean
  blur_name: boolean
  blur_number: boolean
}

export interface Event {
  id: string
  title: string
  datetime: string
  end_time: string | null       // "HH:MM:SS" from PostgreSQL TIME
  location: string
  location_id: string | null
  organizer: string | null
  court_count: number
  court_numbers: number[] | null
  match_type: string | null     // 'Mixed' | 'Men only' | 'Women only'
  min_level: number | null
  max_level: number | null
  is_finalized: boolean
  created_by: string | null
  created_at: string
  sport_id: string | null
  club_id: string | null
}

export interface EventSignup {
  id: string
  event_id: string
  player_id: string
  status: 'confirmed' | 'waitlisted'
  elo_at_signup: number
  elo_after: number | null
  signed_up_at: string
  club_id: string | null
  profiel?: Profiel
}

export interface EventMatch {
  id: string
  event_id: string
  court_number: number
  round_number: number
  player_a1: string | null
  player_a2: string | null
  player_b1: string | null
  player_b2: string | null
  team_a_score: number | null
  team_b_score: number | null
  created_at: string
  club_id: string | null
  a1?: Profiel | null
  a2?: Profiel | null
  b1?: Profiel | null
  b2?: Profiel | null
}

export interface Wedstrijd {
  id: string
  gepland_op: string
  locatie: string
  status: WedstrijdStatus
  max_spelers: number
  court_booking_confirmed?: boolean
  match_type: string | null
  min_level: number | null
  max_level: number | null
  aangemaakt_door: string | null
  aangemaakt_op: string
  aanmeldingen?: Aanmelding[]
  resultaat?: Resultaat | null
  sport_id: string | null
  club_id: string | null
}

export interface Aanmelding {
  id: string
  wedstrijd_id: string
  speler_id: string
  team: 1 | 2 | null
  aangemeld_op: string
  profiel?: Profiel
}

export interface Resultaat {
  id: string
  wedstrijd_id: string
  team1_score: number
  team2_score: number
  vastgelegd_door: string | null
  vastgelegd_op: string
}

export interface WedstrijdMetDetails extends Wedstrijd {
  aanmeldingen: (Aanmelding & { profiel: Profiel })[]
  resultaat: Resultaat | null
  aanmaker: { id: string; naam: string; player_number: number | null } | null
}
