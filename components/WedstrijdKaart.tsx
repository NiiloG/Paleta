'use client'

import { useState } from 'react'
import type { WedstrijdMetDetails, Profiel } from '@/types'
import { aanmeldenVoorWedstrijd, afmeldenVanWedstrijd } from '@/app/actions/wedstrijden'
import { eloColor, eloToPlaytomic } from '@/lib/tier'

const STATUS_CFG: Record<string, { label: string; dot: string; color: string; bg: string; border: string }> = {
  open:        { label: 'Open',        dot: '#6fcf97', color: '#6fcf97', bg: 'rgba(76,175,80,0.14)',   border: 'rgba(76,175,80,0.32)'   },
  vol:         { label: 'Full',        dot: '#ef9a9a', color: '#ef9a9a', bg: 'rgba(239,83,80,0.14)',   border: 'rgba(239,83,80,0.32)'   },
  bezig:       { label: 'In progress', dot: '#6dd0e8', color: '#6dd0e8', bg: 'rgba(42,135,168,0.14)',  border: 'rgba(42,135,168,0.30)'  },
  voltooid:    { label: 'Completed',   dot: 'rgba(255,255,255,0.40)', color: 'rgba(255,255,255,0.50)', bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)' },
  geannuleerd: { label: 'Cancelled',   dot: '#ef9a9a', color: '#ef9a9a', bg: 'rgba(239,83,80,0.10)',   border: 'rgba(239,83,80,0.22)'   },
}

function formatDatum(isoString: string) {
  const d = new Date(isoString)
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
    day:     d.getDate(),
    month:   d.toLocaleDateString('en-GB', { month: 'short' }),
    time:    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

interface Props {
  wedstrijd: WedstrijdMetDetails
  huidigeProfiel: Profiel | null
}

export default function WedstrijdKaart({ wedstrijd, huidigeProfiel }: Props) {
  const [bezig, setBezig] = useState(false)
  const [bericht, setBericht] = useState<string | null>(null)

  const { weekday, day, month, time } = formatDatum(wedstrijd.gepland_op)
  const cfg = STATUS_CFG[wedstrijd.status] ?? STATUS_CFG.open
  const aantalAangemeld = wedstrijd.aanmeldingen.length
  const isAangemeld = huidigeProfiel
    ? wedstrijd.aanmeldingen.some(a => a.speler_id === huidigeProfiel.id)
    : false

  const team1      = wedstrijd.aanmeldingen.filter(a => a.team === 1)
  const team2      = wedstrijd.aanmeldingen.filter(a => a.team === 2)
  const zonderTeam = wedstrijd.aanmeldingen.filter(a => a.team === null)

  async function handleAanmelden() {
    if (!huidigeProfiel) return
    setBezig(true)
    setBericht(null)
    const result = isAangemeld
      ? await afmeldenVanWedstrijd(wedstrijd.id)
      : await aanmeldenVoorWedstrijd(wedstrijd.id)
    if (result?.fout) setBericht(result.fout)
    setBezig(false)
  }

  const cardStyle = {
    background: 'rgba(8,20,38,0.50)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'border-color 0.2s',
  }

  const innerPanel: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '10px 12px',
  }

  return (
    <div style={cardStyle} className="overflow-hidden hover:border-white/30 transition-all">
      {/* Header */}
      <div className="flex items-stretch">
        {/* Date block */}
        <div
          className="flex flex-col items-center justify-center px-4 py-4 min-w-[68px] text-center"
          style={{ background: 'rgba(245,166,35,0.12)', borderRight: '0.5px solid rgba(255,255,255,0.10)' }}
        >
          <span className="text-[10px] font-semibold tracking-widest" style={{ color: '#f5a623' }}>{weekday}</span>
          <span className="text-2xl font-bold text-white leading-tight">{day}</span>
          <span className="text-[11px] text-white/50 uppercase tracking-wide">{month}</span>
        </div>

        {/* Info */}
        <div className="flex-1 px-4 py-4 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xl font-bold text-white">{time}</p>
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{ background: cfg.bg, border: `0.5px solid ${cfg.border}`, color: cfg.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
          </div>
          <p className="text-white/45 text-xs mt-1 flex items-center gap-1">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {wedstrijd.locatie}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 space-y-3">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-[11px] text-white/45 mb-1.5">
            <span>{aantalAangemeld} / {wedstrijd.max_spelers} players</span>
          </div>
          <div className="w-full rounded-full h-0.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <div
              className="h-0.5 rounded-full transition-all"
              style={{ width: `${Math.min((aantalAangemeld / wedstrijd.max_spelers) * 100, 100)}%`, background: '#f5a623' }}
            />
          </div>
        </div>

        {/* Score */}
        {wedstrijd.resultaat && (
          <div className="text-center py-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Final score</p>
            <p className="text-2xl font-bold font-mono">
              <span style={{ color: wedstrijd.resultaat.team1_score > wedstrijd.resultaat.team2_score ? '#6fcf97' : '#ef9a9a' }}>
                {wedstrijd.resultaat.team1_score}
              </span>
              <span className="text-white/20 mx-2">–</span>
              <span style={{ color: wedstrijd.resultaat.team2_score > wedstrijd.resultaat.team1_score ? '#6fcf97' : '#ef9a9a' }}>
                {wedstrijd.resultaat.team2_score}
              </span>
            </p>
          </div>
        )}

        {/* Teams */}
        {(team1.length > 0 || team2.length > 0) && (
          <div className="grid grid-cols-2 gap-2">
            {[{ team: team1, nr: 1 }, { team: team2, nr: 2 }].map(({ team, nr }) => {
              const won = wedstrijd.resultaat && (
                (nr === 1 && wedstrijd.resultaat.team1_score > wedstrijd.resultaat.team2_score) ||
                (nr === 2 && wedstrijd.resultaat.team2_score > wedstrijd.resultaat.team1_score)
              )
              return (
                <div key={nr} style={{ ...innerPanel, ...(won ? { borderColor: 'rgba(76,175,80,0.45)' } : {}) }}>
                  <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: won ? '#6fcf97' : 'rgba(255,255,255,0.40)' }}>
                    Team {nr} {won && <span>✓</span>}
                  </p>
                  {team.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-0.5">
                      <span className="text-sm text-white/85 truncate">{a.profiel?.naam ?? '—'}</span>
                      <span className="text-xs font-mono ml-2" style={{ color: eloColor(a.profiel?.elo_rating ?? 1000), opacity: 0.75 }}>{eloToPlaytomic(a.profiel?.elo_rating ?? 1000)}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* Waiting for teams */}
        {zonderTeam.length > 0 && (
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Signed up ({zonderTeam.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {zonderTeam.map(a => (
                <span key={a.id} className="px-2.5 py-1 rounded-full text-xs text-white/65"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.14)' }}>
                  {a.profiel?.naam ?? '—'}
                </span>
              ))}
            </div>
          </div>
        )}

        {bericht && <p className="text-xs" style={{ color: '#f0a070' }}>{bericht}</p>}

        {/* CTA */}
        {wedstrijd.status === 'open' && huidigeProfiel && (
          <button
            onClick={handleAanmelden}
            disabled={bezig}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={
              isAangemeld
                ? { background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)' }
                : { background: '#f5a623', color: '#0a2a3d' }
            }
          >
            {bezig ? '…' : isAangemeld ? 'Cancel sign-up' : 'Sign up'}
          </button>
        )}

        {wedstrijd.status === 'open' && !huidigeProfiel && (
          <p className="text-center text-xs text-white/40">
            <a href="/" style={{ color: '#f5a623' }}>Sign in</a> to join this match
          </p>
        )}
      </div>
    </div>
  )
}
