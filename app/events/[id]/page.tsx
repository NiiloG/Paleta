'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signUpForEvent, cancelEventSignup } from '@/app/actions/events'
import type { Event, EventSignup, EventMatch, Profiel } from '@/types'
import { eloColor, eloToPlaytomic } from '@/lib/tier'

type FullEvent = Event & {
  event_signups: (EventSignup & { profielen: Profiel | null })[]
  event_matches: (EventMatch & {
    a1p: Profiel | null; a2p: Profiel | null; b1p: Profiel | null; b2p: Profiel | null
  })[]
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
  const [bezig, setBezig]     = useState(false)
  const [bericht, setBericht] = useState<{ type: 'ok' | 'err'; tekst: string } | null>(null)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profielen').select('*').eq('id', user.id).single()
      setMe(data)
    }

    const { data } = await supabase
      .from('events')
      .select(`
        *,
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

    setEvent(data as unknown as FullEvent)
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignup() {
    if (!me) return
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
    const result = await cancelEventSignup(params.id)
    if (result?.fout) {
      setBericht({ type: 'err', tekst: result.fout })
    } else {
      setBericht({ type: 'ok', tekst: 'Signup cancelled.' })
      await load()
    }
    setBezig(false)
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
  const signupClosed = Date.now() >= d.getTime() - 2 * 60 * 60 * 1000
  const canSignUp    = !event.is_finalized && !signupClosed && !mySignup && confirmed.length < maxPlayers
  const canWaitlist  = !event.is_finalized && !signupClosed && !mySignup && confirmed.length >= maxPlayers

  const myDisplayScore  = me ? parseFloat(eloToPlaytomic(me.elo_rating)) : null
  const levelWarning    = myDisplayScore !== null && (
    (event.min_level != null && myDisplayScore < event.min_level) ||
    (event.max_level != null && myDisplayScore > event.max_level)
  )

  // Group matches by round
  const rounds: Record<number, typeof event.event_matches> = {}
  event.event_matches.forEach(m => {
    if (!rounds[m.round_number]) rounds[m.round_number] = []
    rounds[m.round_number].push(m)
  })
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b)

  // Final standings
  const standings: Record<string, { naam: string; playerNumber: number | null; points: number; wins: number; games: number; eloAtSignup: number }> = {}
  if (event.is_finalized) {
    confirmed.forEach(s => {
      const p = s.profielen
      if (!p) return
      standings[s.player_id] = { naam: p.naam, playerNumber: p.player_number ?? null, points: 0, wins: 0, games: 0, eloAtSignup: s.elo_at_signup }
    })
    event.event_matches.forEach(m => {
      if (m.team_a_score === null || m.team_b_score === null) return
      const sa = m.team_a_score, sb = m.team_b_score
      ;[m.player_a1, m.player_a2].forEach(id => {
        if (id && standings[id]) { standings[id].points += sa; standings[id].games++; if (sa > sb) standings[id].wins++ }
      })
      ;[m.player_b1, m.player_b2].forEach(id => {
        if (id && standings[id]) { standings[id].points += sb; standings[id].games++; if (sb > sa) standings[id].wins++ }
      })
    })
  }
  const sortedStandings = Object.entries(standings).sort((a, b) => b[1].points - a[1].points)

  const hasLevelReq    = event.min_level != null || event.max_level != null
  const levelBadgeCfg = hasLevelReq ? levelCfgByDisplay(event.min_level ?? event.max_level ?? 0) : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-2">
        <Link href="/events" className="text-xs text-white/40 hover:text-white/70 transition-colors">← Events</Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-2" style={{ color: '#f5a623' }}>Americano</p>
        <h1 className="font-serif text-3xl font-bold text-white mb-1">{event.title}</h1>
        <p className="text-white/45 text-sm">
          {d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          {event.end_time && ` – ${event.end_time.slice(0, 5)}`}
          {' · '}{event.location}
          {' · '}{event.court_count} court{event.court_count !== 1 ? 's' : ''}
          {event.court_numbers && event.court_numbers.length > 0 && ` (${event.court_numbers.map(n => `#${n}`).join(', ')})`}
          {event.organizer && <>{' · '}Organized by {event.organizer}</>}
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
      </div>

      <div className="space-y-5">

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
                Sign-up closed — 2 hours before the event
              </p>
            ) : me ? (
              mySignup ? (
                <button onClick={handleCancel} disabled={bezig}
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

        {/* Final standings */}
        {event.is_finalized && sortedStandings.length > 0 && (
          <div style={cardStyle} className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">Final standings</p>
            <div className="space-y-0">
              {sortedStandings.map(([id, s], i) => (
                <div key={id} className="flex items-center py-2.5"
                  style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <span className="w-7 text-center text-sm font-bold"
                    style={{ color: i < 3 ? '#f5a623' : 'rgba(255,255,255,0.25)' }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-white/85">{s.naam}</span>
                  <span className="text-xs text-white/35 mr-4">{s.wins}W · {s.games - s.wins}L</span>
                  <span className="text-base font-bold font-mono" style={{ color: '#f5a623' }}>{s.points} pts</span>
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
