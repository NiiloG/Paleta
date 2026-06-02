import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Event } from '@/types'
import EventBeheerKnop from './EventBeheerKnop'
import Link from 'next/link'

export const revalidate = 0

type EventRow = Event & { event_signups: { status: string }[] }

export default async function BeheerPagina() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) redirect('/')

  const { data: alleEvents } = await supabase
    .from('events')
    .select('*, event_signups(status)')
    .order('datetime', { ascending: false })
    .limit(30)
  const events = (alleEvents ?? []) as unknown as EventRow[]

  const thStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    borderBottom: '0.5px solid rgba(255,255,255,0.15)',
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>Admin panel</p>
          <h1 className="font-serif text-4xl font-bold text-white">Management</h1>
        </div>
        <Link href="/events/create"
          className="px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
          style={{ background: 'rgba(245,166,35,0.15)', border: '0.5px solid rgba(245,166,35,0.35)', color: '#f5a623' }}>
          + New event
        </Link>
      </div>

      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">All events</h2>
      <div className="rounded-2xl overflow-x-auto" style={{ border: '0.5px solid rgba(255,255,255,0.10)' }}>
        {events.length === 0 ? (
          <div className="px-5 py-8 text-center text-white/30 text-sm"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            No events yet.{' '}
            <Link href="/events/create" style={{ color: '#f5a623' }}>Create the first one →</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={thStyle}>
                <th className="text-left px-3 sm:px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 whitespace-nowrap">Date</th>
                <th className="text-left px-3 sm:px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Title</th>
                <th className="text-left px-3 sm:px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Location</th>
                <th className="text-left px-3 sm:px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Players</th>
                <th className="text-left px-3 sm:px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Status</th>
                <th className="px-3 sm:px-5 py-3"></th>
                <th className="px-3 sm:px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => {
                const d = new Date(ev.datetime)
                const confirmed = ev.event_signups.filter(s => s.status === 'confirmed').length
                const maxPlayers = ev.court_count * 4
                return (
                  <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors"
                    style={{ borderBottom: '0.5px solid rgba(255,255,255,0.10)' }}>
                    <td className="px-3 sm:px-5 py-3.5 text-white font-medium whitespace-nowrap">
                      {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      <span className="text-white/30 font-normal ml-1.5">
                        {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-3 sm:px-5 py-3.5 text-white max-w-[100px] sm:max-w-none truncate">{ev.title}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-white/50 hidden sm:table-cell">{ev.location}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-white/35 tabular-nums hidden sm:table-cell">{confirmed}/{maxPlayers}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-sm font-medium whitespace-nowrap"
                      style={{ color: ev.is_finalized ? 'rgba(255,255,255,0.45)' : confirmed >= maxPlayers ? '#ef9a9a' : '#6fcf97' }}>
                      {ev.is_finalized ? 'Finalized' : confirmed >= maxPlayers ? 'Full' : 'Open'}
                    </td>
                    <td className="px-3 sm:px-5 py-3.5">
                      <Link href={`/events/${ev.id}/admin`}
                        className="text-xs font-medium transition-colors hover:opacity-70 whitespace-nowrap"
                        style={{ color: '#f5a623' }}>
                        Admin →
                      </Link>
                    </td>
                    <td className="px-3 sm:px-5 py-3.5 text-right">
                      <EventBeheerKnop eventId={ev.id} isFinalized={ev.is_finalized} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
