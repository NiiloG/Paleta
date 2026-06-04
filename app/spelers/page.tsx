import { createClient } from '@/lib/supabase/server'
import type { Profiel } from '@/types'
import SpelersClient from './SpelersClient'

export const revalidate = 0

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
      <SpelersClient ranglijst={ranglijst} />
    </div>
  )
}
