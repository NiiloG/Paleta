import { createClient } from '@/lib/supabase/server'
import type { Event, EventSignup, Profiel } from '@/types'
import Link from 'next/link'

export const revalidate = 0

function formatEventDate(iso: string) {
  const d = new Date(iso)
  const tz = { timeZone: 'Europe/Madrid' }
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short', ...tz }).toUpperCase(),
    day:     parseInt(d.toLocaleDateString('en-GB', { day: 'numeric', ...tz }), 10),
    month:   d.toLocaleDateString('en-GB', { month: 'short', ...tz }),
    time:    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...tz }),
    full:    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', ...tz }),
  }
}

function matchTypeCfg(mt: string): React.CSSProperties {
  if (mt === 'Men only')   return { background: 'rgba(59,130,246,0.15)',  border: '0.5px solid rgba(59,130,246,0.35)',  color: '#60a5fa' }
  if (mt === 'Women only') return { background: 'rgba(244,114,182,0.15)', border: '0.5px solid rgba(244,114,182,0.35)', color: '#f472b6' }
  return                          { background: 'rgba(245,166,35,0.15)',  border: '0.5px solid rgba(245,166,35,0.35)',  color: '#f5a623' }
}

function levelCfgByDisplay(val: number) {
  if (val >= 6.0) return { color: '#f9d070', bg: 'rgba(245,166,35,0.16)',  border: 'rgba(245,166,35,0.35)'  }
  if (val >= 4.0) return { color: '#ef9a9a', bg: 'rgba(239,83,80,0.14)',   border: 'rgba(239,83,80,0.32)'   }
  if (val >= 2.0) return { color: '#6dd0e8', bg: 'rgba(42,135,168,0.14)',  border: 'rgba(42,135,168,0.30)'  }
  return               { color: '#81c784', bg: 'rgba(76,175,80,0.12)',   border: 'rgba(76,175,80,0.28)'   }
}

function levelPickerLabel(val: number): string {
  if (val >= 6.0) return 'Expert'
  if (val >= 4.0) return 'Advanced'
  if (val >= 2.0) return 'Intermediate'
  return 'Beginner'
}

const cardStyle = {
  background: 'rgba(8,20,38,0.50)',
  border: '0.5px solid rgba(255,255,255,0.18)',
  borderRadius: '14px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let currentProfile: Profiel | null = null
  let isAdmin = false
  if (user) {
    const { data } = await supabase.from('profielen').select('*').eq('id', user.id).single()
    currentProfile = data
    isAdmin = currentProfile?.is_admin ?? false
  }

  const { data: rawEvents } = await supabase
    .from('events')
    .select('*, event_signups(id, player_id, status), location_data:locations(booking_deadline_hours)')
    .order('datetime', { ascending: true })

  type RawEvent = Event & {
    event_signups: { id: string; player_id: string; status: string }[]
    location_data: { booking_deadline_hours: number | null } | null
  }
  const events = (rawEvents ?? []) as unknown as RawEvent[]

  const upcoming = events.filter(e => !e.is_finalized)
  const finished = events.filter(e => e.is_finalized).reverse()

  const EventCard = ({ event }: { event: RawEvent }) => {
    const { weekday, day, month, time } = formatEventDate(event.datetime)
    const confirmed  = event.event_signups.filter(s => s.status === 'confirmed')
    const waitlisted = event.event_signups.filter(s => s.status === 'waitlisted')
    const maxPlayers = event.court_count * 4
    const isFull = confirmed.length >= maxPlayers
    const cutoffHours  = event.location_data?.booking_deadline_hours ?? 2
    const signupClosed = Date.now() >= new Date(event.datetime).getTime() - cutoffHours * 60 * 60 * 1000
    const mySignup = currentProfile
      ? event.event_signups.find(s => s.player_id === currentProfile!.id)
      : null
    const spotsLeft = maxPlayers - confirmed.length

    return (
      <Link
        href={`/events/${event.id}`}
        className="block hover:border-white/30 transition-all"
        style={cardStyle}
      >
        <div className="flex flex-col overflow-hidden rounded-[14px]">
          {/* Main row: date column + card body */}
          <div className="flex items-stretch">
            {/* Date block */}
            <div
              className="event-date-col flex flex-col items-center justify-center px-5 py-8 min-w-[80px] text-center flex-shrink-0"
              style={{ background: 'rgba(245,166,35,0.18)', borderRight: '0.5px solid rgba(255,255,255,0.10)' }}
            >
              <span className="text-[10px] font-semibold tracking-widest" style={{ color: '#f5a623' }}>{weekday}</span>
              <span className="text-3xl font-bold text-white leading-tight">{day}</span>
              <span className="text-[11px] text-white/50 uppercase tracking-wide">{month}</span>
            </div>

            {/* Card body */}
            <div className="flex-1 px-5 py-5">
              {/* Row 1: Event name + status badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[20px] font-bold text-white leading-tight">{event.title}</p>
                {event.is_finalized ? (
                  <span className="text-[13px] px-2.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)' }}>
                    Finalized
                  </span>
                ) : signupClosed ? (
                  <span className="text-[13px] px-2.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(42,135,168,0.14)', border: '0.5px solid rgba(42,135,168,0.30)', color: '#6dd0e8' }}>
                    Closed
                  </span>
                ) : isFull ? (
                  <span className="text-[13px] px-2.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(239,83,80,0.14)', border: '0.5px solid rgba(239,83,80,0.32)', color: '#ef9a9a' }}>
                    Full
                  </span>
                ) : (
                  <span className="text-[13px] px-2.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(76,175,80,0.14)', border: '0.5px solid rgba(76,175,80,0.32)', color: '#6fcf97' }}>
                    Open
                  </span>
                )}
              </div>

              {/* Row 2: Time + location */}
              <div className="flex items-center gap-3 mb-2.5 flex-wrap">
                <span className="text-[17px] font-bold" style={{ color: '#f5a623' }}>
                  {time}{event.end_time && ` – ${event.end_time.slice(0, 5)}`}
                </span>
                <span className="text-[16px] text-white/55 flex items-center gap-1.5">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {event.location}
                  {event.organizer && <><span className="text-white/25 mx-1">·</span>{event.organizer}</>}
                </span>
              </div>

              {/* Row 3: Gender badge + level badge */}
              {(event.match_type || event.min_level != null || event.max_level != null) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {event.match_type && (
                    <span className="text-[13px] font-medium px-2.5 py-0.5 rounded-full"
                      style={matchTypeCfg(event.match_type)}>
                      {event.match_type}
                    </span>
                  )}
                  {(event.min_level != null || event.max_level != null) && (() => {
                    const lo = event.min_level ?? 0
                    const hi = event.max_level ?? 7
                    if (lo === 0 && hi === 7) {
                      return (
                        <span className="text-[13px] font-medium px-2.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.55)' }}>
                          All levels
                        </span>
                      )
                    }
                    const c = levelCfgByDisplay(lo)
                    return (
                      <span className="text-[13px] font-medium px-2.5 py-0.5 rounded-full"
                        style={{ background: c.bg, border: `0.5px solid ${c.border}`, color: c.color }}>
                        {lo.toFixed(1)} – {hi.toFixed(1)}
                        {' · '}{levelPickerLabel(lo)}
                      </span>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Footer strip: progress bar left, signup status right */}
          <div className="flex items-center gap-4 px-5 py-3"
            style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
            <div className="flex-1">
              <div className="flex justify-between text-[13px] text-white/45 mb-1.5">
                <span>
                  {confirmed.length}/{maxPlayers}
                  {waitlisted.length > 0 && (
                    <span className="ml-1.5" style={{ color: '#f5a623' }}>
                      · {waitlisted.length} waitlisted
                    </span>
                  )}
                </span>
                {!isFull && !event.is_finalized && waitlisted.length === 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.32)' }}>{spotsLeft} left</span>
                )}
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <div className="h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((confirmed.length / maxPlayers) * 100, 100)}%`, background: '#f5a623' }} />
              </div>
            </div>
            {mySignup && (
              <span className="text-[13px] font-medium flex-shrink-0"
                style={{ color: mySignup.status === 'confirmed' ? '#6fcf97' : '#f5a623' }}>
                {mySignup.status === 'confirmed' ? 'Signed up ✓' : 'Waitlisted'}
              </span>
            )}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>
            King of the Court
          </p>
          <h1 className="font-serif text-4xl font-bold text-white">Events</h1>
          <p className="text-white/45 mt-2 text-sm">Round-robin tournaments with ELO-balanced draws.</p>
        </div>
        {isAdmin && (
          <Link
            href="/events/create"
            className="px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: '#f5a623', color: '#0a2a3d' }}
          >
            + New event
          </Link>
        )}
      </div>

      {upcoming.length === 0 && finished.length === 0 ? (
        <div className="p-14 rounded-2xl text-center"
          style={{ background: 'rgba(8,20,38,0.50)', border: '0.5px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-xl"
            style={{ background: 'rgba(245,166,35,0.10)' }}>🏆</div>
          <p className="text-white/50 text-sm">No events scheduled yet.</p>
          {isAdmin && (
            <Link href="/events/create" className="inline-block mt-4 text-sm font-semibold"
              style={{ color: '#f5a623' }}>
              Create the first event →
            </Link>
          )}
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="mb-12">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            </div>
          )}
          {finished.length > 0 && (
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">Past events</h2>
              <div className="space-y-3">
                {finished.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
