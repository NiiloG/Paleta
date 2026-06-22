'use client'

import { useState } from 'react'
import type { Profiel } from '@/types'
import { tierCfg, eloToPlaytomic } from '@/lib/tier'

type Filter = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert'

const TIERS: { id: Filter; label: string; range: string; minElo: number; maxElo: number }[] = [
  { id: 'all',          label: 'All',          range: '0.00 – 7.00', minElo: 0,    maxElo: Infinity },
  { id: 'beginner',     label: 'Beginner',     range: '0.00 – 1.99', minElo: 0,    maxElo: 571      },
  { id: 'intermediate', label: 'Intermediate', range: '2.00 – 3.99', minElo: 572,  maxElo: 1142     },
  { id: 'advanced',     label: 'Advanced',     range: '4.00 – 5.99', minElo: 1143, maxElo: 1714     },
  { id: 'expert',       label: 'Expert',       range: '6.00 – 7.00', minElo: 1715, maxElo: Infinity },
]

const RANK_COLOR = ['#f5a623', 'rgba(255,255,255,0.70)', 'rgba(205,127,50,0.85)']

function TrophyIcon({ size = 13, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <path d="M4 22h16" /><path d="M10 22V16" /><path d="M14 22V16" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

export default function SpelersClient({ ranglijst }: { ranglijst: Profiel[] }) {
  const [filter, setFilter]                 = useState<Filter>('all')
  const [selectedPlayer, setSelectedPlayer] = useState<Profiel | null>(null)
  const [zoomAvatar, setZoomAvatar]         = useState(false)

  const activeTier = TIERS.find(t => t.id === filter)!
  const filtered = filter === 'all'
    ? ranglijst
    : ranglijst.filter(p => p.elo_rating >= activeTier.minElo && p.elo_rating <= activeTier.maxElo)

  const selectedRank = selectedPlayer ? ranglijst.findIndex(p => p.id === selectedPlayer.id) + 1 : 0

  return (
    <>
      {/* ── Public player profile modal ── */}
      {selectedPlayer && (() => {
        const tier      = tierCfg(selectedPlayer.elo_rating)
        const isBlurred = selectedPlayer.blur_name
        const winPct    = selectedPlayer.wedstrijden_gespeeld > 0
          ? Math.round((selectedPlayer.gewonnen / selectedPlayer.wedstrijden_gespeeld) * 100)
          : 0
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
            onClick={() => { setSelectedPlayer(null); setZoomAvatar(false) }}>
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} />
            <div className="relative w-full max-w-sm rounded-2xl p-6 space-y-5"
              style={{ background: '#0a1828', border: '1px solid rgba(255,255,255,0.14)' }}
              onClick={e => e.stopPropagation()}>

              <button onClick={() => setSelectedPlayer(null)}
                className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors text-xl leading-none"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3 pt-2">
                {selectedPlayer.avatar_url ? (
                  <img
                    src={selectedPlayer.avatar_url}
                    alt={isBlurred ? '' : selectedPlayer.naam}
                    onClick={() => !isBlurred && setZoomAvatar(true)}
                    className="w-20 h-20 rounded-full object-cover"
                    style={{
                      border: '2px solid rgba(245,166,35,0.35)',
                      filter: isBlurred ? 'blur(10px)' : undefined,
                      cursor: isBlurred ? 'default' : 'zoom-in',
                    }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={{ background: 'rgba(245,166,35,0.12)', border: '2px solid rgba(245,166,35,0.25)', color: '#f5a623',
                      filter: isBlurred ? 'blur(6px)' : undefined }}>
                    {isBlurred ? '?' : selectedPlayer.naam.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="text-center">
                  <p className="text-white font-semibold text-lg leading-tight"
                    style={isBlurred ? { filter: 'blur(8px)', userSelect: 'none' } : undefined}>
                    {selectedPlayer.naam}
                  </p>
                  {selectedPlayer.player_number != null && !selectedPlayer.blur_number && (
                    <p className="text-xs font-mono mt-1" style={{ color: 'rgba(245,166,35,0.65)' }}>
                      #{selectedPlayer.player_number}
                    </p>
                  )}
                  <span className="inline-block mt-2 px-3 py-0.5 text-[11px] font-medium rounded-full"
                    style={{ background: tier.bg, border: `0.5px solid ${tier.border}`, color: tier.color }}>
                    {tier.label}
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                {[
                  { label: 'Rank',   value: `#${selectedRank}`,                          color: undefined },
                  { label: 'Rating', value: eloToPlaytomic(selectedPlayer.elo_rating),   color: tier.color },
                  { label: 'Played', value: String(selectedPlayer.wedstrijden_gespeeld), color: undefined },
                  { label: 'Win %',  value: `${winPct}%`,                                color: undefined },
                  { label: 'Won',    value: String(selectedPlayer.gewonnen),              color: '#6fcf97' },
                  { label: 'Lost',   value: String(selectedPlayer.verloren),              color: '#e87a7a' },
                ].map(stat => (
                  <div key={stat.label} className="p-3 rounded-xl text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">{stat.label}</p>
                    <p className="text-lg font-bold tabular-nums" style={{ color: stat.color ?? tier.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {isBlurred && (
                <p className="text-center text-xs text-white/25 pt-1">This player has chosen to keep their identity private.</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Avatar zoom overlay ── */}
      {zoomAvatar && selectedPlayer?.avatar_url && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={() => setZoomAvatar(false)}
          style={{ background: 'rgba(0,0,0,0.92)', cursor: 'zoom-out' }}>
          <img
            src={selectedPlayer.avatar_url}
            alt={selectedPlayer.naam}
            style={{ maxHeight: '90vh', maxWidth: '90vw', borderRadius: '14px', boxShadow: '0 0 60px rgba(0,0,0,0.6)' }}
          />
        </div>
      )}

      {/* Tier filter bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-8">
        {TIERS.map(t => {
          const cfg = t.id === 'all' ? null : tierCfg(t.minElo)
          const active = filter === t.id
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className="p-3.5 rounded-xl text-center transition-all"
              style={active
                ? cfg
                  ? { background: cfg.bg, border: `1.5px solid ${cfg.color}`, cursor: 'pointer' }
                  : { background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.60)', cursor: 'pointer' }
                : cfg
                  ? { background: cfg.bg, border: `0.5px solid ${cfg.border}`, cursor: 'pointer', opacity: 0.65 }
                  : { background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.14)', cursor: 'pointer', opacity: 0.65 }
              }
            >
              <p className="text-base font-bold text-white">{t.label}</p>
              <p className="text-sm mt-0.5 text-white/70">{t.range}</p>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="p-14 rounded-2xl text-center"
          style={{ background: 'rgba(8,20,38,0.50)', border: '0.5px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}>
          <p className="text-lg font-semibold text-white">No players in this division yet</p>
          <p className="text-white/45 text-sm mt-1">Be the first to reach this level.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(8,20,38,0.50)', border: '0.5px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.07)', borderBottom: '0.5px solid rgba(255,255,255,0.15)' }}>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 w-16">Rank</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 hidden sm:table-cell">ID</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">Player</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">Rating</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 hidden sm:table-cell">Played</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 hidden sm:table-cell">W / L</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 hidden sm:table-cell">Win%</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((speler, i) => {
                const tier   = tierCfg(speler.elo_rating)
                const winPct = speler.wedstrijden_gespeeld > 0
                  ? Math.round((speler.gewonnen / speler.wedstrijden_gespeeld) * 100)
                  : 0
                return (
                  <tr
                    key={speler.id}
                    className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                    onClick={() => setSelectedPlayer(speler)}
                    style={{
                      background: i === 0 ? 'rgba(245,166,35,0.06)' : undefined,
                      borderBottom: '0.5px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5"
                        style={{ color: i < 3 ? RANK_COLOR[i] : 'rgba(255,255,255,0.25)' }}>
                        <TrophyIcon size={i < 3 ? 14 : 11} />
                        <span className="text-sm font-bold tabular-nums">{i + 1}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      {speler.player_number != null && (
                        <span className="player-id-chip text-[11px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(245,166,35,0.12)', color: 'rgba(245,166,35,0.70)',
                            ...(speler.blur_number ? { filter: 'blur(5px)', userSelect: 'none' } : {}),
                          }}>
                          {speler.player_number}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {speler.avatar_url ? (
                          <img src={speler.avatar_url} alt={speler.blur_name ? '' : speler.naam}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            style={{
                              border: '1px solid rgba(255,255,255,0.12)',
                              ...(speler.blur_name ? { filter: 'blur(6px)' } : {}),
                            }} />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                            style={{ background: 'rgba(245,166,35,0.12)', color: '#f5a623' }}>
                            {speler.blur_name ? '?' : speler.naam.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium text-sm"
                            style={speler.blur_name ? { filter: 'blur(6px)', userSelect: 'none' } : undefined}>
                            {speler.naam}
                          </p>
                          <span
                            className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-medium rounded-full"
                            style={{ background: tier.bg, border: `0.5px solid ${tier.border}`, color: tier.color }}
                          >
                            {tier.label}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-base font-bold font-mono tabular-nums" style={{ color: tier.color }}>
                        {eloToPlaytomic(speler.elo_rating)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-white/55 text-sm tabular-nums hidden sm:table-cell">
                      {speler.wedstrijden_gespeeld}
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums text-sm hidden sm:table-cell">
                      <span style={{ color: '#1a7c44' }}>{speler.gewonnen}</span>
                      <span className="text-white/25 mx-1">/</span>
                      <span style={{ color: '#a12425' }}>{speler.verloren}</span>
                    </td>
                    <td className="px-5 py-4 text-right text-white/45 text-xs tabular-nums hidden sm:table-cell">
                      {winPct}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
