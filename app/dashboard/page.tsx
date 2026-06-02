import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profiel } from '@/types'
import { tierCfg } from '@/lib/tier'
import DashboardTabs, { type HistorieRij, type EventHistorieRij } from './DashboardTabs'

export const revalidate = 0

export default async function DashboardPagina() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiel } = await supabase.from('profielen').select('*').eq('id', user.id).single()
  if (!profiel) redirect('/login')

  const p = profiel as Profiel
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

  const { data: eventDeelnames } = await supabase
    .from('event_signups')
    .select('event_id, elo_at_signup, elo_after, events(id, title, datetime, location, is_finalized)')
    .eq('player_id', user.id)
    .eq('status', 'confirmed')
    .order('signed_up_at', { ascending: false })
    .limit(20)

  const historie = (mijnaanmeldingen ?? []) as unknown as HistorieRij[]
  const eventHistorie = (eventDeelnames ?? []) as unknown as EventHistorieRij[]

  const tier = tierCfg(p.elo_rating)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>Your profile</p>
        <div className="flex items-center gap-4 flex-wrap">
          {p.player_number != null && (
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-xl font-bold font-mono tabular-nums"
              style={{
                width: '56px', height: '56px',
                fontSize: '1.6rem',
                background: 'rgba(245,166,35,0.15)',
                border: '0.5px solid rgba(245,166,35,0.40)',
                color: '#f5a623',
              }}
            >
              {p.player_number}
            </div>
          )}
          <div>
            <h1 className="font-serif text-4xl font-bold text-white">{p.naam}</h1>
            <p className="text-sm mt-0.5" style={{ color: tier.color }}>{tier.label}</p>
          </div>
        </div>
        {p.is_admin && (
          <span className="inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full"
            style={{ background: 'rgba(245,166,35,0.12)', border: '0.5px solid rgba(245,166,35,0.25)', color: '#f5a623' }}>
            Admin
          </span>
        )}
      </div>

      {/* Tabs */}
      <DashboardTabs
        p={p}
        positie={positie}
        totaalSpelers={totaalSpelers ?? 0}
        winPct={winPct}
        historie={historie}
        eventHistorie={eventHistorie}
      />
    </div>
  )
}
