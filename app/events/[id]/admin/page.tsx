import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Event, EventSignup, EventMatch, Profiel } from '@/types'
import ScoreEntry from './ScoreEntry'
import Link from 'next/link'

export const revalidate = 0

type FullEvent = Event & {
  event_signups: (EventSignup & { profielen: Profiel | null })[]
  event_matches: (EventMatch & {
    a1p: Profiel | null; a2p: Profiel | null; b1p: Profiel | null; b2p: Profiel | null
  })[]
  location_data: { booking_deadline_hours: number | null } | null
}

export default async function EventAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) redirect('/')

  const { data: raw } = await supabase
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
      ),
      location_data:locations(booking_deadline_hours)
    `)
    .eq('id', id)
    .single()

  if (!raw) redirect('/events')

  const event = raw as unknown as FullEvent

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-2">
        <Link href={`/events/${id}`} className="text-xs text-white/40 hover:text-white/70 transition-colors">
          ← {event.title}
        </Link>
      </div>

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-2" style={{ color: '#f5a623' }}>Admin</p>
        <h1 className="font-serif text-3xl font-bold text-white">{event.title}</h1>
        <p className="text-white/40 text-sm mt-1">
          {new Date(event.datetime).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}{event.location}
          {' · '}{event.court_count} court{event.court_count !== 1 ? 's' : ''}
          {' · '}max {event.court_count * 4} players
        </p>
      </div>

      <ScoreEntry event={event} />
    </div>
  )
}
