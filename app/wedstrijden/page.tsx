import { createClient } from '@/lib/supabase/server'
import WedstrijdKaart from '@/components/WedstrijdKaart'
import MaakWedstrijdFormulier from '@/components/MaakWedstrijdFormulier'
import type { WedstrijdMetDetails, Profiel } from '@/types'

export const revalidate = 0

export default async function WedstrijdenPagina() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let huidigeProfiel: Profiel | null = null
  if (user) {
    const { data } = await supabase.from('profielen').select('*').eq('id', user.id).single()
    huidigeProfiel = data
  }

  const { data: settings } = await supabase
    .from('instellingen').select('matches_enabled').eq('id', 1).single()
  const matchesEnabled = settings?.matches_enabled ?? true

  const SELECT = `
    *,
    aanmaker:aangemaakt_door(id,naam,player_number),
    aanmeldingen(id,wedstrijd_id,speler_id,team,aangemeld_op,profielen(id,naam,elo_rating,player_number)),
    resultaten(*)
  `

  const { data: komende } = await supabase
    .from('wedstrijden')
    .select(SELECT)
    .in('status', ['open', 'vol', 'bezig'])
    .gte('gepland_op', new Date(Date.now() - 3600000).toISOString())
    .order('gepland_op', { ascending: true })

  const { data: gespeeld } = await supabase
    .from('wedstrijden')
    .select(SELECT)
    .eq('status', 'voltooid')
    .order('gepland_op', { ascending: false })
    .limit(5)

  type AanmakerRow = { id: string; naam: string; player_number: number | null }

  function mapWedstrijd(w: Record<string, unknown>): WedstrijdMetDetails {
    return {
      ...w,
      aanmaker:    (w.aanmaker  as AanmakerRow | null) ?? null,
      aanmeldingen: ((w.aanmeldingen as Record<string, unknown>[]) ?? []).map(a => ({ ...a, profiel: a.profielen as Profiel })),
      resultaat:   ((w.resultaten as Record<string, unknown>[]) ?? [])[0] ?? null,
    } as unknown as WedstrijdMetDetails
  }

  const komendeWedstrijden   = (komende  ?? []).map(mapWedstrijd)
  const gespeeldeWedstrijden = (gespeeld ?? []).map(mapWedstrijd)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">

      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>
          Matches
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-bold text-white">Play a match</h1>
            <p className="text-white/40 mt-2 text-sm">
              Single unranked matches — 4 players, no ELO changes.
              Teams are balanced by ELO once full.
            </p>
          </div>
          {huidigeProfiel && matchesEnabled && (
            <div className="flex-shrink-0">
              <MaakWedstrijdFormulier />
            </div>
          )}
        </div>
        {!huidigeProfiel && (
          <p className="mt-3 text-sm text-white/40">
            <a href="/" style={{ color: '#f5a623' }}>Sign in</a> to create or join a match.
          </p>
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
          <p className="text-white/35 text-sm">
            {!matchesEnabled
              ? 'Match creation is currently disabled.'
              : huidigeProfiel
                ? 'Use the button above to create one.'
                : 'Sign in to create the first match.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {komendeWedstrijden.map(w => (
            <WedstrijdKaart key={w.id} wedstrijd={w} huidigeProfiel={huidigeProfiel} />
          ))}
        </div>
      )}

      {gespeeldeWedstrijden.length > 0 && (
        <div className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>
            Results
          </p>
          <h2 className="font-serif text-2xl font-bold text-white mb-6">Recent matches</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gespeeldeWedstrijden.map(w => (
              <WedstrijdKaart key={w.id} wedstrijd={w} huidigeProfiel={huidigeProfiel} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
