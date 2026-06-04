'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signUpForEvent, cancelEventSignup } from '@/app/actions/events'
import type { Event, EventSignup, EventMatch, Profiel } from '@/types'
import { eloColor, eloToPlaytomic, tierCfg } from '@/lib/tier'

type OrganizerProfile = { id: string; naam: string; email: string; phone: string | null }
type LocationData = { booking_deadline_hours: number | null; name: string; address: string | null; maps_url: string | null }

type FullEvent = Event & {
  event_signups: (EventSignup & { profielen: Profiel | null })[]
  event_matches: (EventMatch & {
    a1p: Profiel | null; a2p: Profiel | null; b1p: Profiel | null; b2p: Profiel | null
  })[]
  organizer_profile: OrganizerProfile | null
  location_data: LocationData | null
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(8,20,38,0.50)',
  border: '0.5px solid rgba(255,255,255,0.18)',
  borderRadius: '14px',
  backdropFilter: 'blur(12px)',
}

const innerPanel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '0.5px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  padding: '10px 14px',
}

function matchTypeCfg(mt: string): React.CSSProperties {
  if (mt === 'Men only')   return { background: 'rgba(59,130,246,0.15)',  border: '0.5px solid rgba(59,130,246,0.35)',  color: '#60a5fa' }
  if (mt === 'Women only') return { background: 'rgba(244,114,182,0.15)', border: '0.5px solid rgba(244,114,182,0.35)', color: '#f472b6' }
  return                          { background: 'rgba(245,166,35,0.15)',  border: '0.5px solid rgba(245,166,35,0.35)',  color: '#f5a623' }
}

function levelPickerLabel(val: number): string {
  if (val >= 6.0) return 'Expert'
  if (val >= 4.0) return 'Advanced'
  if (val >= 2.0) return 'Intermediate'
  return 'Beginner'
}

function levelCfgByDisplay(val: number) {
  if (val >= 6.0) return { color: '#f9d070', bg: 'rgba(245,166,35,0.16)',  border: 'rgba(245,166,35,0.35)'  }
  if (val >= 4.0) return { color: '#ef9a9a', bg: 'rgba(239,83,80,0.14)',   border: 'rgba(239,83,80,0.32)'   }
  if (val >= 2.0) return { color: '#6dd0e8', bg: 'rgba(42,135,168,0.14)',  border: 'rgba(42,135,168,0.30)'  }
  return               { color: '#81c784', bg: 'rgba(76,175,80,0.12)',   border: 'rgba(76,175,80,0.28)'   }
}

function levelRangeDesc(min: number | null, max: number | null): string {
  const lo = levelPickerLabel(min ?? 0)
  const hi = levelPickerLabel(max ?? 7)
  const parts = [...new Set([lo, hi].filter(Boolean))]
  return parts.length > 0 ? ` · ${parts.join(' – ')}` : ''
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const [event, setEvent]     = useState<FullEvent | null>(null)
  const [me, setMe]           = useState<Profiel | null>(null)
  const [loading, setLoading] = useState(true)
  const [bezig, setBezig]           = useState(false)
  const [bericht, setBericht]       = useState<{ type: 'ok' | 'err'; tekst: string } | null>(null)
  const [showCancelWarn, setShowCancelWarn]     = useState(false)
  const [showDeadlineWarn, setShowDeadlineWarn] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profielen').select('*').eq('id', user.id).single()
      setMe(data)
    }

    const { data: eventData } = await supabase
      .from('events')
      .select(`
        *,
        location_data:locations(booking_deadline_hours, name, address, maps_url),
        event_signups(*, profielen(*)),
        event_matches(
          *,
          a1p:player_a1(id,naam,elo_rating,player_number),
          a2p:player_a2(id,naam,elo_rating,player_number),
          b1p:player_b1(id,naam,elo_rating,player_number),
          b2p:player_b2(id,naam,elo_rating,player_number)
        )
      `)
      .eq('id', params.id)
      .single()

    let organizer_profile: OrganizerProfile | null = null
    if (eventData) {
      if (eventData.created_by) {
        const { data: op } = await supabase
          .from('profielen').select('id, naam, email, phone')
          .eq('id', eventData.created_by).maybeSingle()
        organizer_profile = op ?? null
      }
      if (!organizer_profile) {
        const { data: admins } = await supabase
          .from('profielen').select('id, naam, email, phone')
          .eq('is_admin', true).limit(1)
        organizer_profile = admins?.[0] ?? null
      }
    }

    setEvent(eventData ? { ...eventData, organizer_profile } as unknown as FullEvent : null)
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignup() {
    if (!me) return
    // If this location has a booking deadline, show the warning first
    if (event?.location_data?.booking_deadline_hours != null && !showDeadlineWarn) {
      setShowDeadlineWarn(true)
      return
    }
    setShowDeadlineWarn(false)
    setBezig(true)
    setBericht(null)
    const result = await signUpForEvent(params.id)
    if (result?.fout) {
      setBericht({ type: 'err', tekst: result.fout })
    } else {
      setBericht({
        type: 'ok',
        tekst: result.status === 'waitlisted'
          ? "You're on the waitlist! You'll be confirmed automatically once enough players join to fill another court."
          : 'Signed up! See you on the court.',
      })
      await load()
    }
    setBezig(false)
  }

  async function handleCancel() {
    if (!me) return
    setBezig(true)
    setBericht(null)
    setShowCancelWarn(false)
    const result = await cancelEventSignup(params.id)
    if (result?.fout) {
      setBericht({ type: 'err', tekst: result.fout })
    } else {
      setBericht({ type: 'ok', tekst: 'Signup cancelled.' })
      await load()
    }
    setBezig(false)
  }

  function requestCancel() {
    if (!event) return
    if (signupClosed) { setShowCancelWarn(true) } else { handleCancel() }
  }

  if (loading) return <div style={{ minHeight: 'calc(100vh - 4rem)' }} />

  if (!event) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-white/50">Event not found.</p>
        <Link href="/events" className="text-sm mt-3 inline-block" style={{ color: '#f5a623' }}>← Events</Link>
      </div>
    )
  }

  const d          = new Date(event.datetime)
  const maxPlayers = event.court_count * 4
  const confirmed  = event.event_signups.filter(s => s.status === 'confirmed')
  const waitlisted = event.event_signups.filter(s => s.status === 'waitlisted')
  const mySignup   = me ? event.event_signups.find(s => s.player_id === me.id) : null
  const cutoffHours  = event.location_data?.booking_deadline_hours ?? 2
  const signupClosed = Date.now() >= d.getTime() - cutoffHours * 60 * 60 * 1000
  const canSignUp    = !event.is_finalized && !signupClosed && !mySignup && confirmed.length < maxPlayers
  const canWaitlist  = !event.is_finalized && !signupClosed && !mySignup && confirmed.length >= maxPlayers

  const myDisplayScore  = me ? parseFloat(eloToPlaytomic(me.elo_rating)) : null
  const levelWarning    = myDisplayScore !== null && (
    (event.min_level != null && myDisplayScore < event.min_level) ||
    (event.max_level != null && myDisplayScore > event.max_level)
  )

  // Booking deadline for this event's location
  const bookingDeadline = event.location_data?.booking_deadline_hours != null
    ? new Date(new Date(event.datetime).getTime() - event.location_data.booking_deadline_hours * 60 * 60 * 1000)
    : null

  // Round 1 court assignment for the logged-in player
  const myRound1 = me && mySignup?.status === 'confirmed'
    ? event.event_matches.find(m =>
        m.round_number === 1 && m.player_a1 !== null &&
        (m.player_a1 === me.id || m.player_a2 === me.id || m.player_b1 === me.id || m.player_b2 === me.id)
      ) ?? null
    : null
  const myTeamA   = myRound1 ? (myRound1.player_a1 === me?.id || myRound1.player_a2 === me?.id) : false
  const myPartner = myRound1 && me
    ? myTeamA
      ? (myRound1.player_a1 === me.id ? myRound1.a2p : myRound1.a1p)
      : (myRound1.player_b1 === me.id ? myRound1.b2p : myRound1.b1p)
    : null
  const myOpp1 = myRound1 ? (myTeamA ? myRound1.b1p : myRound1.a1p) : null
  const myOpp2 = myRound1 ? (myTeamA ? myRound1.b2p : myRound1.a2p) : null

  // Group matches by round
  const rounds: Record<number, typeof event.event_matches> = {}
  event.event_matches.forEach(m => {
    if (!rounds[m.round_number]) rounds[m.round_number] = []
    rounds[m.round_number].push(m)
  })
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b)

  // W/L per player from scored matches
  const wlMap: Record<string, { w: number; l: number }> = {}
  event.event_matches.forEach(m => {
    if (m.team_a_score === null || m.team_b_score === null) return
    const aWon = m.team_a_score > m.team_b_score
    ;[m.player_a1, m.player_a2].forEach(id => {
      if (!id) return
      if (!wlMap[id]) wlMap[id] = { w: 0, l: 0 }
      if (aWon) wlMap[id].w++; else wlMap[id].l++
    })
    ;[m.player_b1, m.player_b2].forEach(id => {
      if (!id) return
      if (!wlMap[id]) wlMap[id] = { w: 0, l: 0 }
      if (!aWon) wlMap[id].w++; else wlMap[id].l++
    })
  })

  // Rating ranking for finalized events — sorted by ELO impact desc
  const ratingRanking = event.is_finalized
    ? [...confirmed].sort((a, b) => {
        const da = a.elo_after != null ? a.elo_after - a.elo_at_signup : null
        const db = b.elo_after != null ? b.elo_after - b.elo_at_signup : null
        if (da != null && db != null) return db - da
        if (da != null) return -1
        if (db != null) return 1
        const wpa = (wlMap[a.player_id]?.w ?? 0) / Math.max(1, (wlMap[a.player_id]?.w ?? 0) + (wlMap[a.player_id]?.l ?? 0))
        const wpb = (wlMap[b.player_id]?.w ?? 0) / Math.max(1, (wlMap[b.player_id]?.w ?? 0) + (wlMap[b.player_id]?.l ?? 0))
        return wpb - wpa
      })
    : []

  const RANK_COLOR = ['#f5a623', 'rgba(255,255,255,0.70)', 'rgba(205,127,50,0.85)']

  const hasLevelReq    = event.min_level != null || event.max_level != null
  const levelBadgeCfg = hasLevelReq ? levelCfgByDisplay(event.min_level ?? event.max_level ?? 0) : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

      {/* Booking deadline warning modal */}
      {showDeadlineWarn && bookingDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop — separate so HC mode doesn't bleed into modal text */}
          <div className="absolute inset-0" aria-hidden="true"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} />
          <div className="relative w-full max-w-md rounded-2xl p-6"
            style={{ background: '#0a1828', border: '1px solid rgba(245,166,35,0.35)' }}>
            <div className="flex items-center gap-2 mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-sm font-bold uppercase tracking-widest" style={{ color: '#f5a623' }}>Court booking notice</p>
            </div>
            <p className="text-white font-semibold text-base mb-3">Before you sign up</p>
            <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>
              This venue requires the court to be booked{' '}
              <strong className="text-white">{event.location_data!.booking_deadline_hours} hour{event.location_data!.booking_deadline_hours !== 1 ? 's' : ''}</strong>{' '}
              in advance. Sign-up for this event closes at:
            </p>
            <div className="rounded-xl px-4 py-3 mb-3 text-sm font-semibold text-white"
              style={{ background: 'rgba(245,166,35,0.12)', border: '0.5px solid rgba(245,166,35,0.35)' }}>
              {bookingDeadline.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {bookingDeadline.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="rounded-xl px-4 py-3 mb-5" style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.60)' }}>
                Please note that if you cancel after this deadline, you will be responsible for the court booking cost unless you find a replacement player by contacting the organiser.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeadlineWarn(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.70)' }}>
                Go back
              </button>
              <button onClick={handleSignup} disabled={bezig}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: bezig ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
                {bezig ? 'Signing up…' : 'I understand — sign me up'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-2">
        <Link href="/events" className="text-xs text-white/40 hover:text-white/70 transition-colors">← Events</Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-2" style={{ color: '#f5a623' }}>King of the Court</p>
        <h1 className="font-serif text-3xl font-bold text-white mb-1">{event.title}</h1>
        <p className="text-white/45 text-sm">
          {d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          {event.end_time && ` – ${event.end_time.slice(0, 5)}`}
        </p>
        <p className="text-xl font-semibold mt-1" style={{ color: '#f5a623' }}>
          {event.location_data?.maps_url ? (
            <a href={event.location_data.maps_url} target="_blank" rel="noopener noreferrer"
              className="hover:opacity-75 transition-opacity underline decoration-dotted underline-offset-4">
              {event.location}
            </a>
          ) : event.location}
          <span className="mx-2" style={{ color: 'rgba(245,166,35,0.35)' }}>·</span>
          <span className="text-sm font-normal">
            {event.court_count} court{event.court_count !== 1 ? 's' : ''}
            {event.court_numbers && event.court_numbers.length > 0 && (
              <span style={{ color: 'rgba(245,166,35,0.50)' }}> ({event.court_numbers.map(n => `#${n}`).join(', ')})</span>
            )}
          </span>
        </p>

        {/* Badges */}
        {(event.match_type || hasLevelReq) && (
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {event.match_type && (
              <span className="inline-block text-xs px-2.5 py-1 rounded-full font-medium"
                style={matchTypeCfg(event.match_type)}>
                {event.match_type === 'Mixed' ? 'Mixed · Men & Women' : event.match_type}
              </span>
            )}
            {hasLevelReq && levelBadgeCfg && (
              (event.min_level ?? 0) === 0 && (event.max_level ?? 7) === 7 ? (
                <span className="inline-block text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.55)' }}>
                  All levels
                </span>
              ) : (
                <span className="inline-block text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: levelBadgeCfg.bg, border: `0.5px solid ${levelBadgeCfg.border}`, color: levelBadgeCfg.color }}>
                  Level {(event.min_level ?? 0).toFixed(1)} – {(event.max_level ?? 7).toFixed(1)}
                  {levelRangeDesc(event.min_level, event.max_level)}
                </span>
              )
            )}
          </div>
        )}

        {/* Organizer */}
        {event.organizer_profile && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-white/40">Organized by</span>
            <span className="text-xs font-semibold" style={{ color: '#f5a623' }}>{event.organizer_profile.naam}</span>
            <a href={`mailto:${event.organizer_profile.email}`}
              className="flex items-center gap-1 transition-opacity hover:opacity-80"
              style={{ color: '#f5a623' }} title={event.organizer_profile.email}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <span className="text-xs hidden sm:inline">{event.organizer_profile.email}</span>
            </a>
            {event.organizer_profile.phone && (
              <a href={`tel:${event.organizer_profile.phone}`}
                className="flex items-center gap-1 transition-opacity hover:opacity-80"
                style={{ color: '#f5a623' }} title={event.organizer_profile.phone}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.32a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span className="text-xs hidden sm:inline">{event.organizer_profile.phone}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Late-cancel warning modal */}
      {showCancelWarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* backdrop — kept separate so hc CSS doesn't bleed into modal text */}
          <div className="absolute inset-0" aria-hidden="true"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} />
          <div className="relative w-full max-w-md rounded-2xl p-6"
            style={{ background: '#0a1828', border: '1px solid rgba(239,68,68,0.45)' }}>
            <div className="flex items-center gap-2 mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p className="text-sm font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>Warning — sign-up is closed</p>
            </div>
            <p className="text-white font-semibold text-base mb-3">You are about to cancel after the deadline.</p>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Sign-up has closed and the court has been booked. Cancelling now will directly affect the 3 other players on your court.
            </p>
            <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(239,68,68,0.10)', border: '0.5px solid rgba(239,68,68,0.30)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#f87171' }}>What happens when you cancel</p>
              <ul className="text-sm space-y-1" style={{ color: 'rgba(255,255,255,0.70)' }}>
                <li>· You'll be removed from the event immediately</li>
                <li>· Up to 3 confirmed players may be moved back to the waitlist</li>
                <li>· The event organiser will be notified</li>
              </ul>
            </div>
            <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.60)' }}>
                As the court is already booked, you will be responsible for the <strong className="text-white">full court fee</strong> if no replacement is found. If you have someone in mind, contact the organiser immediately — they can transfer your spot and resolve the cost.
              </p>
            </div>
            {event.organizer_profile && (
              <div className="rounded-xl px-4 py-3 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.30)' }}>Organiser contact</p>
                <p className="text-sm font-medium text-white mb-1">{event.organizer_profile.naam}</p>
                <a href={`mailto:${event.organizer_profile.email}`}
                  className="text-xs block hover:opacity-80 transition-opacity"
                  style={{ color: '#f5a623' }}>
                  {event.organizer_profile.email}
                </a>
                {event.organizer_profile.phone && (
                  <a href={`tel:${event.organizer_profile.phone}`}
                    className="text-xs block mt-0.5 hover:opacity-80 transition-opacity"
                    style={{ color: '#f5a623' }}>
                    {event.organizer_profile.phone}
                  </a>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowCancelWarn(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.70)' }}>
                Go back
              </button>
              <button onClick={handleCancel} disabled={bezig}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: bezig ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.85)', color: '#fff', cursor: bezig ? 'not-allowed' : 'pointer' }}>
                {bezig ? 'Cancelling…' : 'Yes, cancel anyway'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">

        {/* Rating ranking — finalized events only */}
        {event.is_finalized && ratingRanking.length > 0 && (
          <div style={cardStyle} className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">Rating ranking</p>
            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.10)' }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '0.5px solid rgba(255,255,255,0.10)' }}>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 w-12">Rank</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">Player</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 hidden sm:table-cell">Rating</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">Impact</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 hidden sm:table-cell">W / L</th>
                  </tr>
                </thead>
                <tbody>
                  {ratingRanking.map((s, i) => {
                    const tier = tierCfg(s.elo_at_signup)
                    const impact = s.elo_after != null
                      ? (parseFloat(eloToPlaytomic(s.elo_after)) - parseFloat(eloToPlaytomic(s.elo_at_signup))).toFixed(2)
                      : null
                    const pos = impact != null ? parseFloat(impact) >= 0 : null
                    return (
                      <tr key={s.id} className="hover:bg-white/[0.03] transition-colors"
                        style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold tabular-nums"
                            style={{ color: i < 3 ? RANK_COLOR[i] : 'rgba(255,255,255,0.25)' }}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white/85 font-medium text-sm">{s.profielen?.naam ?? '—'}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: tier.bg, border: `0.5px solid ${tier.border}`, color: tier.color }}>
                            {tier.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <span className="font-bold font-mono tabular-nums text-sm" style={{ color: tier.color }}>
                            {eloToPlaytomic(s.elo_at_signup)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {impact != null ? (
                            <span className="font-bold font-mono tabular-nums text-sm"
                              style={{ color: pos ? '#6fcf97' : '#ef9a9a' }}>
                              {pos ? '+' : ''}{impact}
                            </span>
                          ) : (
                            <span className="text-white/25 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <span className="font-mono tabular-nums text-sm">
                            <span style={{ color: '#6fcf97' }}>{wlMap[s.player_id]?.w ?? 0}</span>
                            <span className="text-white/25 mx-1">/</span>
                            <span style={{ color: '#ef9a9a' }}>{wlMap[s.player_id]?.l ?? 0}</span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Signup card */}
        {!event.is_finalized && (
          <div style={cardStyle} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Registration</p>
                <p className="text-sm text-white">{confirmed.length}/{maxPlayers} confirmed
                  {waitlisted.length > 0 && <span className="text-white/35 ml-2">+ {waitlisted.length} on waitlist</span>}
                </p>
              </div>
              {mySignup ? (
                <span className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{
                    background: mySignup.status === 'confirmed' ? 'rgba(76,175,80,0.14)' : 'rgba(245,166,35,0.12)',
                    border: `0.5px solid ${mySignup.status === 'confirmed' ? 'rgba(76,175,80,0.32)' : 'rgba(245,166,35,0.30)'}`,
                    color: mySignup.status === 'confirmed' ? '#6fcf97' : '#f5a623',
                  }}>
                  {mySignup.status === 'confirmed' ? 'Signed up' : 'Waitlisted'}
                </span>
              ) : null}
            </div>

            {/* Progress bar */}
            <div className="w-full h-0.5 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div className="h-0.5 rounded-full transition-all"
                style={{ width: `${Math.min((confirmed.length / maxPlayers) * 100, 100)}%`, background: '#f5a623' }} />
            </div>

            {bericht && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs"
                style={{
                  background: bericht.type === 'ok' ? 'rgba(76,175,80,0.12)' : 'rgba(232,131,74,0.15)',
                  border: `0.5px solid ${bericht.type === 'ok' ? 'rgba(76,175,80,0.32)' : 'rgba(232,131,74,0.35)'}`,
                  color: bericht.type === 'ok' ? '#6fcf97' : '#f0a070',
                }}>
                {bericht.tekst}
              </div>
            )}

            {/* Level warning */}
            {levelWarning && !mySignup && !signupClosed && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs leading-relaxed"
                style={{ background: 'rgba(245,166,35,0.10)', border: '0.5px solid rgba(245,166,35,0.22)', color: 'rgba(255,255,255,0.65)' }}>
                <span style={{ color: '#f5a623', fontWeight: 600 }}>Level notice: </span>
                Your rating ({eloToPlaytomic(me!.elo_rating)}) is outside the recommended range for this event ({(event.min_level ?? 0).toFixed(1)} – {(event.max_level ?? 7).toFixed(1)}). You can still sign up.
              </div>
            )}

            {signupClosed && !mySignup ? (
              <p className="text-center text-xs py-1 rounded-lg"
                style={{ background: 'rgba(42,135,168,0.10)', border: '0.5px solid rgba(42,135,168,0.22)', color: '#6dd0e8' }}>
                Sign-up closed — {cutoffHours} hour{cutoffHours !== 1 ? 's' : ''} before the event
              </p>
            ) : me ? (
              mySignup ? (
                <button onClick={requestCancel} disabled={bezig}
                  className="w-full py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)', cursor: bezig ? 'not-allowed' : 'pointer' }}>
                  {bezig ? '…' : 'Cancel sign-up'}
                </button>
              ) : canSignUp ? (
                <button onClick={handleSignup} disabled={bezig}
                  className="w-full py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: bezig ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
                  {bezig ? '…' : 'Sign up'}
                </button>
              ) : canWaitlist ? (
                <button onClick={handleSignup} disabled={bezig}
                  className="w-full py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(245,166,35,0.12)', border: '0.5px solid rgba(245,166,35,0.30)', color: '#f5a623', cursor: bezig ? 'not-allowed' : 'pointer' }}>
                  {bezig ? '…' : 'Join waitlist'}
                </button>
              ) : null
            ) : (
              <p className="text-center text-xs text-white/40">
                <Link href="/" style={{ color: '#f5a623' }}>Sign in</Link> to register
              </p>
            )}
          </div>
        )}

        {/* Your court — shown to confirmed players once the draw is generated */}
        {myRound1 && (
          <div style={{ ...cardStyle, border: '0.5px solid rgba(245,166,35,0.38)' }} className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-4"
              style={{ color: 'rgba(245,166,35,0.55)' }}>Your starting position</p>

            {/* Big court number */}
            <div className="text-center mb-5 py-5 rounded-xl"
              style={{ background: 'rgba(245,166,35,0.08)', border: '0.5px solid rgba(245,166,35,0.22)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(245,166,35,0.50)' }}>Court</p>
              <p className="font-black" style={{ fontSize: '88px', lineHeight: 1, color: '#f5a623' }}>
                {myRound1.court_number}
              </p>
            </div>

            {/* Round 1 match */}
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: '12px', overflow: 'hidden' }}>
              <p className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.28)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                Round 1
              </p>
              {/* Your team */}
              <div className="px-4 py-3.5" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[9px] font-semibold uppercase tracking-widest mb-2.5"
                  style={{ color: 'rgba(111,207,151,0.70)' }}>Your team</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#6fcf97' }} />
                    <span className="text-sm font-bold text-white">You</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#6fcf97' }} />
                    <span className="text-sm font-bold text-white">{myPartner?.naam ?? '—'}</span>
                  </div>
                </div>
              </div>
              {/* VS */}
              <div className="py-2.5 text-center"
                style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs font-black tracking-[0.24em]"
                  style={{ color: 'rgba(255,255,255,0.18)' }}>VS</span>
              </div>
              {/* Opponents */}
              <div className="px-4 py-3.5">
                <p className="text-[9px] font-semibold uppercase tracking-widest mb-2.5"
                  style={{ color: 'rgba(239,154,154,0.70)' }}>Opponents</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef9a9a' }} />
                    <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.80)' }}>{myOpp1?.naam ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef9a9a' }} />
                    <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.80)' }}>{myOpp2?.naam ?? '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Players */}
        <div style={cardStyle} className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">Players</p>
          {confirmed.length === 0 ? (
            <p className="text-white/35 text-sm">No players yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2">
              {confirmed.map(s => (
                <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {s.profielen?.player_number && (
                    <span className="text-[10px] font-mono w-5 text-center rounded"
                      style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}>
                      {s.profielen.player_number}
                    </span>
                  )}
                  <span className="text-sm text-white/80 truncate flex-1">{s.profielen?.naam ?? '—'}</span>
                  {s.profielen?.elo_rating != null && (
                    <span className="text-xs font-mono" style={{ color: eloColor(s.profielen.elo_rating), opacity: 0.8 }}>
                      {eloToPlaytomic(s.profielen.elo_rating)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {waitlisted.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mt-3 mb-2">Waitlist</p>
              <div className="space-y-0.5">
                {waitlisted.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 py-1 px-2">
                    <span className="text-xs text-white/25 w-4">{i + 1}.</span>
                    <span className="text-sm text-white/45 flex-1">{s.profielen?.naam ?? '—'}</span>
                    {s.profielen?.elo_rating != null && (
                      <span className="text-xs font-mono" style={{ color: eloColor(s.profielen.elo_rating), opacity: 0.55 }}>
                        {eloToPlaytomic(s.profielen.elo_rating)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Draw / Rounds */}
        {roundNumbers.length > 0 && (
          <div style={cardStyle} className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">Draw</p>
            <div className="space-y-6">
              {roundNumbers.map(round => (
                <div key={round}>
                  <p className="text-xs font-semibold text-white/45 mb-3">Round {round}</p>
                  <div className="space-y-2">
                    {rounds[round].sort((a, b) => a.court_number - b.court_number).map(m => (
                      <div key={m.id} style={innerPanel}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">
                          Court {m.court_number}
                        </p>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <div>
                            {[m.a1p, m.a2p].map((p, i) => (
                              <p key={i} className="text-sm text-white/80">{p?.naam ?? '—'}</p>
                            ))}
                          </div>
                          <div className="text-center">
                            {m.team_a_score !== null && m.team_b_score !== null ? (
                              <p className="text-lg font-bold font-mono">
                                <span style={{ color: m.team_a_score > m.team_b_score ? '#6fcf97' : m.team_b_score > m.team_a_score ? '#ef9a9a' : '#fff' }}>
                                  {m.team_a_score}
                                </span>
                                <span className="text-white/25 mx-1">–</span>
                                <span style={{ color: m.team_b_score > m.team_a_score ? '#6fcf97' : m.team_a_score > m.team_b_score ? '#ef9a9a' : '#fff' }}>
                                  {m.team_b_score}
                                </span>
                              </p>
                            ) : (
                              <span className="text-white/20 font-bold text-lg">vs</span>
                            )}
                          </div>
                          <div className="text-right">
                            {[m.b1p, m.b2p].map((p, i) => (
                              <p key={i} className="text-sm text-white/80">{p?.naam ?? '—'}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin link */}
        {me?.is_admin && (
          <div className="text-right">
            <Link href={`/events/${event.id}/admin`} className="text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: '#f5a623' }}>
              Admin panel →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
