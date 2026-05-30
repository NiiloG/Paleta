import { createClient } from '@/lib/supabase/server'
import WedstrijdKaart from '@/components/WedstrijdKaart'
import type { WedstrijdMetDetails, Profiel } from '@/types'
import Link from 'next/link'

export const revalidate = 0

export default async function WedstrijdenPagina() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let huidigeProfiel: Profiel | null = null
  if (user) {
    const { data } = await supabase.from('profielen').select('*').eq('id', user.id).single()
    huidigeProfiel = data
  }

  const { data: komende } = await supabase
    .from('wedstrijden')
    .select(`*, aanmeldingen(id,wedstrijd_id,speler_id,team,aangemeld_op,profielen(id,naam,elo_rating)), resultaten(*)`)
    .in('status', ['open', 'vol', 'bezig'])
    .gte('gepland_op', new Date(Date.now() - 3600000).toISOString())
    .order('gepland_op', { ascending: true })

  const { data: gespeeld } = await supabase
    .from('wedstrijden')
    .select(`*, aanmeldingen(id,wedstrijd_id,speler_id,team,aangemeld_op,profielen(id,naam,elo_rating)), resultaten(*)`)
    .eq('status', 'voltooid')
    .order('gepland_op', { ascending: false })
    .limit(5)

  function mapWedstrijd(w: Record<string, unknown>): WedstrijdMetDetails {
    return {
      ...w,
      aanmeldingen: ((w.aanmeldingen as Record<string, unknown>[]) ?? []).map(a => ({ ...a, profiel: a.profielen as Profiel })),
      resultaat: ((w.resultaten as Record<string, unknown>[]) ?? [])[0] ?? null,
    } as unknown as WedstrijdMetDetails
  }

  const komendeWedstrijden  = (komende  ?? []).map(mapWedstrijd)
  const gespeeldeWedstrijden = (gespeeld ?? []).map(mapWedstrijd)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">

      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>
            Upcoming matches
          </p>
          <h1 className="font-serif text-4xl font-bold text-white">Sign up &amp; play</h1>
          <p className="text-white/40 mt-2 text-sm">Teams are auto-balanced by ELO once 4 players sign up.</p>
        </div>
        {huidigeProfiel?.is_admin && (
          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: '#f5a623', color: '#0a2a3d' }}
          >
            + Schedule match
          </Link>
        )}
      </div>

      {komendeWedstrijden.length === 0 ? (
        <div
          className="p-14 rounded-2xl text-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"
            style={{ background: 'rgba(245,166,35,0.10)' }}>🎾</div>
          <p className="text-lg font-semibold text-white mb-1">No matches scheduled</p>
          <p className="text-white/35 text-sm">Check back soon for upcoming matches.</p>
          {huidigeProfiel?.is_admin && (
            <Link
              href="/admin"
              className="inline-block mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: '#f5a623', color: '#0a2a3d' }}
            >
              Schedule a match
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {komendeWedstrijden.map(w => <WedstrijdKaart key={w.id} wedstrijd={w} huidigeProfiel={huidigeProfiel} />)}
        </div>
      )}

      {gespeeldeWedstrijden.length > 0 && (
        <div className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>
            Results
          </p>
          <h2 className="font-serif text-2xl font-bold text-white mb-6">Recent matches</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gespeeldeWedstrijden.map(w => <WedstrijdKaart key={w.id} wedstrijd={w} huidigeProfiel={huidigeProfiel} />)}
          </div>
        </div>
      )}

    </div>
  )
}
