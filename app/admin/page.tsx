import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { WedstrijdMetDetails, Profiel, Event } from '@/types'
import NieuweWedstrijdFormulier from './NieuweWedstrijdFormulier'
import ResultaatFormulier from './ResultaatFormulier'
import AnnuleerKnop from './AnnuleerKnop'
import EventBeheerKnop from './EventBeheerKnop'
import Link from 'next/link'

export const revalidate = 0

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  open:        { label: 'Open',        color: '#6fcf97' },
  vol:         { label: 'Full',        color: '#ef9a9a' },
  bezig:       { label: 'In progress', color: '#6dd0e8' },
  voltooid:    { label: 'Completed',   color: 'rgba(255,255,255,0.45)' },
  geannuleerd: { label: 'Cancelled',   color: '#ef9a9a' },
}

export default async function BeheerPagina() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiel } = await supabase.from('profielen').select('is_admin').eq('id', user.id).single()
  if (!profiel?.is_admin) redirect('/')

  const { data: wedstrijden } = await supabase
    .from('wedstrijden')
    .select(`*, aanmeldingen(id,wedstrijd_id,speler_id,team,aangemeld_op,profielen(id,naam,elo_rating)), resultaten(*)`)
    .order('gepland_op', { ascending: false })
    .limit(20)

  function mapWedstrijd(w: Record<string, unknown>): WedstrijdMetDetails {
    return {
      ...w,
      aanmeldingen: ((w.aanmeldingen as Record<string, unknown>[]) ?? []).map(a => ({ ...a, profiel: a.profielen as Profiel })),
      resultaat: ((w.resultaten as Record<string, unknown>[]) ?? [])[0] ?? null,
    } as unknown as WedstrijdMetDetails
  }

  const alle = (wedstrijden ?? []).map(mapWedstrijd)
  const volWedstrijden = alle.filter(w => w.status === 'vol')

  type EventRow = Event & { event_signups: { status: string }[] }
  const { data: alleEvents } = await supabase
    .from('events')
    .select('*, event_signups(status)')
    .order('datetime', { ascending: false })
    .limit(30)
  const events = (alleEvents ?? []) as unknown as EventRow[]

  const cardStyle = { background: 'rgba(8,20,38,0.50)', border: '0.5px solid rgba(255,255,255,0.18)', borderRadius: '14px', backdropFilter: 'blur(12px)' }
  const thStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.07)', borderBottom: '0.5px solid rgba(255,255,255,0.15)' }

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

      <div className="grid lg:grid-cols-2 gap-5 mb-14">
        <div style={cardStyle} className="p-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Schedule a match</h2>
          <NieuweWedstrijdFormulier />
        </div>

        {volWedstrijden.length > 0 && (
          <div style={cardStyle} className="p-6">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Enter results</h2>
            <div className="space-y-4">
              {volWedstrijden.map(w => <ResultaatFormulier key={w.id} wedstrijd={w} />)}
            </div>
          </div>
        )}
      </div>

      {/* ── Events table ─────────────────────────────────────────── */}
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">All events</h2>
      <div className="rounded-2xl overflow-hidden mb-12" style={{ border: '0.5px solid rgba(255,255,255,0.10)' }}>
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
                {['Date', 'Title', 'Location', 'Players', 'Status', '', ''].map((h, i) => (
                  <th key={i} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(ev => {
                const d = new Date(ev.datetime)
                const confirmed = ev.event_signups.filter(s => s.status === 'confirmed').length
                const maxPlayers = ev.court_count * 4
                return (
                  <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.10)' }}>
                    <td className="px-5 py-3.5 text-white font-medium whitespace-nowrap">
                      {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      <span className="text-white/30 font-normal ml-2">{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-5 py-3.5 text-white">{ev.title}</td>
                    <td className="px-5 py-3.5 text-white/50">{ev.location}</td>
                    <td className="px-5 py-3.5 text-white/35 tabular-nums">{confirmed}/{maxPlayers}</td>
                    <td className="px-5 py-3.5 text-sm font-medium"
                      style={{ color: ev.is_finalized ? 'rgba(255,255,255,0.45)' : confirmed >= maxPlayers ? '#ef9a9a' : '#6fcf97' }}>
                      {ev.is_finalized ? 'Finalized' : confirmed >= maxPlayers ? 'Full' : 'Open'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/events/${ev.id}/admin`}
                        className="text-xs font-medium transition-colors hover:opacity-70"
                        style={{ color: '#f5a623' }}>
                        Admin →
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <EventBeheerKnop eventId={ev.id} isFinalized={ev.is_finalized} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">All matches</h2>
      <div className="rounded-2xl overflow-hidden" style={{ border: '0.5px solid rgba(255,255,255,0.10)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={thStyle}>
              {['Date', 'Location', 'Players', 'Status', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alle.map(w => {
              const d = new Date(w.gepland_op)
              const sc = STATUS_CFG[w.status] ?? STATUS_CFG.open
              return (
                <tr key={w.id} className="hover:bg-white/[0.03] transition-colors" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.10)' }}>
                  <td className="px-5 py-3.5 text-white font-medium">
                    {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    <span className="text-white/30 font-normal ml-2">{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-5 py-3.5 text-white/50">{w.locatie}</td>
                  <td className="px-5 py-3.5 text-white/35 tabular-nums">{w.aanmeldingen.length}/{w.max_spelers}</td>
                  <td className="px-5 py-3.5 text-sm font-medium" style={{ color: sc.color }}>{sc.label}</td>
                  <td className="px-5 py-3.5 text-right">
                    {(w.status === 'open' || w.status === 'vol') && <AnnuleerKnop wedstrijdId={w.id} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
