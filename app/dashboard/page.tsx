import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profiel } from '@/types'
import Link from 'next/link'
import { tierCfg, eloToPlaytomic } from '@/lib/tier'
import EmailToggle from '@/components/EmailToggle'

export const revalidate = 0

export default async function DashboardPagina() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiel } = await supabase.from('profielen').select('*').eq('id', user.id).single()
  if (!profiel) redirect('/login')

  const p = profiel as Profiel
  const tier = tierCfg(p.elo_rating)
  const winPct = p.wedstrijden_gespeeld > 0 ? Math.round((p.gewonnen / p.wedstrijden_gespeeld) * 100) : 0

  const { count: hogerGerankt } = await supabase
    .from('profielen').select('id', { count: 'exact', head: true }).gt('elo_rating', p.elo_rating)
  const positie = (hogerGerankt ?? 0) + 1

  const { count: totaalSpelers } = await supabase
    .from('profielen').select('id', { count: 'exact', head: true })

  const { data: mijnaanmeldingen } = await supabase
    .from('aanmeldingen')
    .select(`wedstrijd_id, team, wedstrijden(id,gepland_op,locatie,status,resultaten(team1_score,team2_score))`)
    .eq('speler_id', user.id)
    .order('aangemeld_op', { ascending: false })
    .limit(10)

  type HistorieRij = {
    wedstrijd_id: string; team: number | null
    wedstrijden: { id: string; gepland_op: string; locatie: string; status: string; resultaten: Array<{ team1_score: number; team2_score: number }> }
  }
  const historie = (mijnaanmeldingen ?? []) as unknown as HistorieRij[]

  const cardStyle = {
    background: 'rgba(8,20,38,0.50)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  const statCards = [
    {
      label: 'Rating',
      value: <span className="text-4xl font-bold font-mono tabular-nums" style={{ color: tier.color }}>{eloToPlaytomic(p.elo_rating)}</span>,
      sub: <span className="text-xs font-medium px-2 py-0.5 rounded-full mt-1" style={{ background: tier.bg, border: `0.5px solid ${tier.border}`, color: tier.color }}>{tier.label}</span>,
    },
    {
      label: 'Played',
      value: <span className="text-4xl font-bold text-white tabular-nums">{p.wedstrijden_gespeeld}</span>,
      sub: <span className="text-xs text-white/30">matches</span>,
    },
    {
      label: 'W / L',
      value: (
        <span className="text-4xl font-bold font-mono tabular-nums">
          <span style={{ color: '#f5a623' }}>{p.gewonnen}</span>
          <span className="text-white/15 mx-1 text-2xl">/</span>
          <span className="text-white/35">{p.verloren}</span>
        </span>
      ),
      sub: <span className="text-xs text-white/30">{winPct}% win rate</span>,
    },
    {
      label: 'Ranking',
      value: <span className="text-4xl font-bold text-white tabular-nums">#{positie}</span>,
      sub: <span className="text-xs text-white/30">of {totaalSpelers ?? '?'} players</span>,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>Your profile</p>
        <h1 className="font-serif text-4xl font-bold text-white">{p.naam}</h1>
        {p.is_admin && (
          <span className="inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full" style={{ background: 'rgba(245,166,35,0.12)', border: '0.5px solid rgba(245,166,35,0.25)', color: '#f5a623' }}>
            Admin
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(c => (
          <div key={c.label} style={cardStyle} className="p-5 text-center hover:border-white/20 transition-colors">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">{c.label}</p>
            <div className="mb-1">{c.value}</div>
            <div className="flex justify-center">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Profile info */}
        <div style={cardStyle} className="p-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Account details</h2>
          <div className="space-y-0">
            {[
              { label: 'Name',          value: p.naam },
              { label: 'Player #',      value: p.player_number != null ? `#${p.player_number}` : '—' },
              { label: 'Email',         value: p.email },
              { label: 'Member since',  value: new Date(p.aangemaakt_op).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.12)' }}>
                <span className="text-white/40 text-sm">{row.label}</span>
                <span className="text-white text-sm font-medium">{row.value}</span>
              </div>
            ))}
            {/* Email notifications toggle */}
            <div className="flex justify-between items-center py-3">
              <div>
                <p className="text-white/40 text-sm">Email notifications</p>
                <p className="text-white/25 text-xs mt-0.5">Notify when moved from waitlist to confirmed</p>
              </div>
              <EmailToggle initialValue={p.email_notifications ?? true} />
            </div>
          </div>
        </div>

        {/* History */}
        <div style={cardStyle} className="p-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Match history</h2>
          {historie.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>🎾</div>
              <p className="text-white/35 text-sm">No matches played yet.</p>
              <Link href="/wedstrijden" className="inline-block mt-3 text-sm" style={{ color: '#f5a623' }}>Browse matches →</Link>
            </div>
          ) : (
            <div>
              {historie.map(({ wedstrijden: w, team }) => {
                if (!w) return null
                const d = new Date(w.gepland_op)
                const r = w.resultaten?.[0]
                let uitslag: { tekst: string; color: string } | null = null
                if (r && team) {
                  const won = (team === 1 && r.team1_score > r.team2_score) || (team === 2 && r.team2_score > r.team1_score)
                  uitslag = won ? { tekst: 'Won', color: '#6fcf97' } : { tekst: 'Lost', color: '#ef9a9a' }
                }
                return (
                  <div key={w.id} className="flex items-center justify-between py-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.12)' }}>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        <span className="text-white/30 font-normal ml-2">{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                      <p className="text-white/30 text-xs mt-0.5">{w.locatie}</p>
                    </div>
                    <div className="text-right">
                      {r && <p className="text-white text-sm font-mono">{r.team1_score} – {r.team2_score}</p>}
                      {uitslag && <p className="text-xs font-semibold" style={{ color: uitslag.color }}>{uitslag.tekst}</p>}
                      {w.status === 'open' && <p className="text-xs" style={{ color: '#f5a623' }}>Signed up</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
