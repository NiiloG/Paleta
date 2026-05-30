'use client'

import { useState } from 'react'
import Link from 'next/link'
import { generateEventDraw, saveEventScore, finalizeEvent, assignMatchPlayers } from '@/app/actions/events'
import type { Event, EventSignup, EventMatch, Profiel } from '@/types'
import { eloColor } from '@/lib/tier'

interface Props {
  event: Event & {
    event_signups: (EventSignup & { profielen: Profiel | null })[]
    event_matches: (EventMatch & {
      a1p: Profiel | null; a2p: Profiel | null; b1p: Profiel | null; b2p: Profiel | null
    })[]
  }
}

const innerPanel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '0.5px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  padding: '14px',
}

const scoreInputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '0.5px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  color: '#fff',
  width: '60px',
  padding: '6px',
  fontSize: '18px',
  fontWeight: 700,
  textAlign: 'center',
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '0.5px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  color: '#fff',
  width: '100%',
  padding: '6px 8px',
  fontSize: '13px',
  outline: 'none',
}

type PlayerOption = { id: string; label: string }

// ── Player assignment card (rounds with unassigned players) ────────────────
function PlayerAssignmentCard({ match, playerOptions, onSaved }: {
  match: Props['event']['event_matches'][0]
  playerOptions: PlayerOption[]
  onSaved: () => void
}) {
  const [bezig, setBezig] = useState(false)
  const [fout, setFout]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const fd = new FormData(e.currentTarget)
    const result = await assignMatchPlayers(fd)
    if (result?.fout) setFout(result.fout)
    else onSaved()
    setBezig(false)
  }

  const PlayerSelect = ({ name, defaultVal }: { name: string; defaultVal: string | null }) => (
    <select name={name} required defaultValue={defaultVal ?? ''} style={selectStyle}
      onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
      onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
    >
      <option value="">— select player —</option>
      {playerOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  )

  return (
    <div style={innerPanel}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-3">Court {match.court_number}</p>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="match_id" value={match.id} />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Team A</p>
            <div className="space-y-1.5">
              <PlayerSelect name="player_a1" defaultVal={match.player_a1} />
              <PlayerSelect name="player_a2" defaultVal={match.player_a2} />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Team B</p>
            <div className="space-y-1.5">
              <PlayerSelect name="player_b1" defaultVal={match.player_b1} />
              <PlayerSelect name="player_b2" defaultVal={match.player_b2} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={bezig}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: bezig ? 'rgba(245,166,35,0.4)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
            {bezig ? '…' : 'Assign players'}
          </button>
          {fout && <p className="text-xs" style={{ color: '#f0a070' }}>{fout}</p>}
        </div>
      </form>
    </div>
  )
}

// ── Score entry card (rounds with assigned players) ────────────────────────
function MatchCard({ match, onSaved }: {
  match: Props['event']['event_matches'][0]
  onSaved: () => void
}) {
  const [bezig, setBezig] = useState(false)
  const [fout, setFout]   = useState<string | null>(null)
  const scored = match.team_a_score !== null && match.team_b_score !== null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const fd = new FormData(e.currentTarget)
    const result = await saveEventScore(fd)
    if (result?.fout) setFout(result.fout)
    else onSaved()
    setBezig(false)
  }

  const aWon = scored && match.team_a_score! > match.team_b_score!
  const bWon = scored && match.team_b_score! > match.team_a_score!

  return (
    <div style={innerPanel}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-3">Court {match.court_number}</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div style={{ ...(aWon ? { borderLeft: '2px solid #6fcf97', paddingLeft: '8px' } : {}) }}>
          <p className="text-xs font-medium mb-0.5" style={{ color: aWon ? '#6fcf97' : 'rgba(255,255,255,0.40)' }}>
            Team A {aWon && '✓'}
          </p>
          {[match.a1p, match.a2p].map((p, i) => (
            <p key={i} className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{p?.naam ?? '—'}</p>
          ))}
        </div>

        <div className="text-center">
          {scored ? (
            <p className="text-2xl font-bold font-mono">
              <span style={{ color: aWon ? '#6fcf97' : bWon ? '#ef9a9a' : '#fff' }}>{match.team_a_score}</span>
              <span className="text-white/20 mx-1">–</span>
              <span style={{ color: bWon ? '#6fcf97' : aWon ? '#ef9a9a' : '#fff' }}>{match.team_b_score}</span>
            </p>
          ) : (
            <span className="text-white/20 font-bold">vs</span>
          )}
        </div>

        <div className="text-right" style={{ ...(bWon ? { borderRight: '2px solid #6fcf97', paddingRight: '8px' } : {}) }}>
          <p className="text-xs font-medium mb-0.5" style={{ color: bWon ? '#6fcf97' : 'rgba(255,255,255,0.40)' }}>
            {bWon && '✓ '}Team B
          </p>
          {[match.b1p, match.b2p].map((p, i) => (
            <p key={i} className="text-sm text-right" style={{ color: 'rgba(255,255,255,0.85)' }}>{p?.naam ?? '—'}</p>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="match_id" value={match.id} />
        <input
          name="team_a_score" type="number" min="0" max="99" required
          defaultValue={match.team_a_score ?? ''}
          style={scoreInputStyle}
          onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
          onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
        />
        <span className="text-white/30 font-bold">–</span>
        <input
          name="team_b_score" type="number" min="0" max="99" required
          defaultValue={match.team_b_score ?? ''}
          style={scoreInputStyle}
          onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
          onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
        />
        <button type="submit" disabled={bezig}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: bezig ? 'rgba(245,166,35,0.4)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
          {bezig ? '…' : 'Save'}
        </button>
        {fout && <p className="text-xs" style={{ color: '#f0a070' }}>{fout}</p>}
      </form>
    </div>
  )
}

export default function ScoreEntry({ event: initialEvent }: Props) {
  const [event]                       = useState(initialEvent)
  const [drawBezig, setDrawBezig]     = useState(false)
  const [drawFout, setDrawFout]       = useState<string | null>(null)
  const [finalBezig, setFinalBezig]   = useState(false)
  const [finalResult, setFinalResult] = useState<{ fout?: string } | null>(null)

  const maxPlayers = event.court_count * 4
  const confirmed  = event.event_signups.filter(s => s.status === 'confirmed')
  const waitlisted = event.event_signups.filter(s => s.status === 'waitlisted')

  const signupClosed = Date.now() >= new Date(event.datetime).getTime() - 2 * 60 * 60 * 1000
  const readyForDraw = signupClosed && confirmed.length >= 4 && !event.is_finalized

  const rounds: Record<number, typeof event.event_matches> = {}
  event.event_matches.forEach(m => {
    if (!rounds[m.round_number]) rounds[m.round_number] = []
    rounds[m.round_number].push(m)
  })
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b)

  const allScored = event.event_matches.length > 0 &&
    event.event_matches.every(m => m.team_a_score !== null && m.team_b_score !== null)

  const playerOptions: PlayerOption[] = confirmed.map(s => ({
    id: s.player_id,
    label: s.profielen?.player_number != null
      ? `#${s.profielen.player_number} ${s.profielen.naam}`
      : (s.profielen?.naam ?? '—'),
  })).sort((a, b) => a.label.localeCompare(b.label))

  async function handleGenerateDraw() {
    setDrawBezig(true)
    setDrawFout(null)
    const fd = new FormData()
    fd.set('event_id', event.id)
    fd.set('round_number', '1')
    const result = await generateEventDraw(fd)
    if (result?.fout) {
      setDrawFout(result.fout)
    } else {
      window.location.reload()
    }
    setDrawBezig(false)
  }

  async function handleFinalize() {
    if (!confirm('Finalize event and apply ELO changes? This cannot be undone.')) return
    setFinalBezig(true)
    setFinalResult(null)
    const result = await finalizeEvent(event.id)
    setFinalResult(result ?? {})
    if (!result?.fout) window.location.reload()
    setFinalBezig(false)
  }

  function handleScoreSaved() {
    window.location.reload()
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(8,20,38,0.50)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
  }

  return (
    <div className="space-y-5">

      {/* Players */}
      <div style={cardStyle} className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Players ({confirmed.length}/{maxPlayers})
          </p>
          {signupClosed && !event.is_finalized ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(42,135,168,0.14)', border: '0.5px solid rgba(42,135,168,0.30)', color: '#6dd0e8' }}>
              Sign-up closed
            </span>
          ) : !signupClosed && confirmed.length === maxPlayers && !event.is_finalized ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(76,175,80,0.14)', border: '0.5px solid rgba(76,175,80,0.32)', color: '#6fcf97' }}>
              Full
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-1 mb-3">
          {confirmed.map(s => (
            <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              {s.profielen?.player_number != null && (
                <span className="text-[10px] font-mono w-5 text-center rounded"
                  style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}>
                  {s.profielen.player_number}
                </span>
              )}
              <span className="text-sm text-white/80 truncate">{s.profielen?.naam ?? '—'}</span>
              {s.profielen?.elo_rating != null && (
                <span className="text-xs font-mono ml-auto" style={{ color: eloColor(s.profielen.elo_rating), opacity: 0.8 }}>
                  {s.profielen.elo_rating}
                </span>
              )}
            </div>
          ))}
        </div>
        {waitlisted.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1.5">Waitlist</p>
            {waitlisted.map((s, i) => (
              <p key={s.id} className="text-sm text-white/40 py-0.5">{i + 1}. {s.profielen?.naam ?? '—'}</p>
            ))}
          </>
        )}
        {!signupClosed && !event.is_finalized && (
          <p className="text-xs text-white/35 mt-2">
            Sign-up closes 2 hours before the event.
            {confirmed.length < maxPlayers && ` Waiting for ${maxPlayers - confirmed.length} more player${maxPlayers - confirmed.length !== 1 ? 's' : ''}.`}
          </p>
        )}
      </div>

      {/* Generate draw — shown once after signup closes */}
      {readyForDraw && roundNumbers.length === 0 && (
        <div style={cardStyle} className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Generate draw</p>
          <p className="text-xs text-white/35 mb-3">
            Round 1 will be generated by snake draw. Empty courts for rounds 2 and 3 will be created for manual player assignment.
          </p>
          {drawFout && (
            <p className="text-xs mb-3" style={{ color: '#f0a070' }}>{drawFout}</p>
          )}
          <button onClick={handleGenerateDraw} disabled={drawBezig}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: drawBezig ? 'rgba(245,166,35,0.4)' : '#f5a623', color: '#0a2a3d', cursor: drawBezig ? 'not-allowed' : 'pointer' }}>
            {drawBezig ? 'Generating…' : 'Generate Round 1'}
          </button>
        </div>
      )}

      {/* Rounds */}
      {roundNumbers.map(round => (
        <div key={round} style={cardStyle} className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">Round {round}</p>
          <div className="space-y-3">
            {rounds[round].sort((a, b) => a.court_number - b.court_number).map(m =>
              m.player_a1 === null ? (
                <PlayerAssignmentCard key={m.id} match={m} playerOptions={playerOptions} onSaved={handleScoreSaved} />
              ) : (
                <MatchCard key={m.id} match={m} onSaved={handleScoreSaved} />
              )
            )}
          </div>
        </div>
      ))}

      {/* Finalize */}
      {!event.is_finalized && allScored && roundNumbers.length > 0 && (
        <div style={cardStyle} className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">Finalize event</p>
          <p className="text-xs text-white/40 mb-4">
            All matches are scored. Finalizing will apply ELO changes to all players and lock the event.
          </p>
          {finalResult?.fout && (
            <p className="text-xs mb-3" style={{ color: '#f0a070' }}>{finalResult.fout}</p>
          )}
          <button onClick={handleFinalize} disabled={finalBezig}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: finalBezig ? 'rgba(239,83,80,0.4)' : 'rgba(239,83,80,0.85)', color: '#fff', cursor: finalBezig ? 'not-allowed' : 'pointer' }}>
            {finalBezig ? 'Finalizing…' : 'Finalize & apply ELO'}
          </button>
        </div>
      )}

      {event.is_finalized && (
        <div className="p-4 rounded-xl text-sm text-center"
          style={{ background: 'rgba(76,175,80,0.10)', border: '0.5px solid rgba(76,175,80,0.25)', color: '#6fcf97' }}>
          Event finalized. ELO applied.
        </div>
      )}

      <div className="text-right">
        <Link href={`/events/${event.id}`} className="text-xs text-white/40 hover:text-white/70 transition-colors">
          ← Player view
        </Link>
      </div>
    </div>
  )
}
