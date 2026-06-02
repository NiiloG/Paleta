import { createClient } from '@/lib/supabase/server'
import type { Profiel } from '@/types'
import { tierCfg, eloToPlaytomic } from '@/lib/tier'

export const revalidate = 0

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

const RANK_COLOR = ['#f5a623', 'rgba(255,255,255,0.70)', 'rgba(205,127,50,0.85)']

export default async function RanglijstPagina() {
  const supabase = await createClient()
  const { data: spelers } = await supabase.from('profielen').select('*').order('elo_rating', { ascending: false })
  const ranglijst = (spelers ?? []) as Profiel[]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>Leaderboard</p>
        <h1 className="font-serif text-4xl font-bold text-white">Rankings</h1>
        <p className="text-white/50 mt-2 text-sm">Win matches to raise your rating and climb the board.</p>
      </div>

      {/* Tier legend — always visible at top */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { range: '0.00 – 1.99', label: 'Beginner',     cfg: tierCfg(0)    },
          { range: '2.00 – 3.99', label: 'Intermediate', cfg: tierCfg(572)  },
          { range: '4.00 – 5.99', label: 'Advanced',     cfg: tierCfg(1143) },
          { range: '6.00 – 7.00', label: 'Expert',       cfg: tierCfg(1715) },
        ].map(t => (
          <div
            key={t.label}
            className="p-3.5 rounded-xl text-center"
            style={{ background: t.cfg.bg, border: `0.5px solid ${t.cfg.border}` }}
          >
            <p className="text-sm font-semibold" style={{ color: t.cfg.color }}>{t.label}</p>
            <p className="text-[11px] text-white/35 mt-0.5">{t.range}</p>
          </div>
        ))}
      </div>

      {ranglijst.length === 0 ? (
        <div className="p-14 rounded-2xl text-center"
          style={{ background: 'rgba(8,20,38,0.50)', border: '0.5px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}>
          <p className="text-lg font-semibold text-white">No players yet</p>
          <p className="text-white/45 text-sm mt-1">Register to be the first on the board.</p>
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
              {ranglijst.map((speler, i) => {
                const tier   = tierCfg(speler.elo_rating)
                const winPct = speler.wedstrijden_gespeeld > 0
                  ? Math.round((speler.gewonnen / speler.wedstrijden_gespeeld) * 100)
                  : 0
                return (
                  <tr
                    key={speler.id}
                    className="hover:bg-white/[0.04] transition-colors"
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
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(245,166,35,0.12)', color: 'rgba(245,166,35,0.70)',
                            ...(speler.blur_number ? { filter: 'blur(5px)', userSelect: 'none' } : {}),
                          }}>
                          {speler.player_number}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
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
                      <span style={{ color: '#6fcf97' }}>{speler.gewonnen}</span>
                      <span className="text-white/25 mx-1">/</span>
                      <span style={{ color: '#ef9a9a' }}>{speler.verloren}</span>
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

    </div>
  )
}
