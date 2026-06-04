'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import type { Event, Location, Cost, AdminUserRow } from '@/types'
import EventBeheerKnop from './EventBeheerKnop'
import MatchesToggle from './MatchesToggle'
import {
  createLocation, updateLocation, deleteLocation,
  createCost, deleteCost,
  setUserAdmin, removeUserAsAdmin,
} from '@/app/actions/admin'

type Tab = 'overview' | 'events' | 'locations' | 'users' | 'financials' | 'settings'
type EventRow = Event & { event_signups: { status: string }[] }

interface Props {
  overviewStats: { playerCount: number; elapsedEvents: number; totalSignups: number }
  events: EventRow[]
  locations: Location[]
  costs: Cost[]
  users: AdminUserRow[]
  matchesEnabled: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function monthsElapsed(startDate: string): number {
  const start = new Date(startDate)
  const now   = new Date()
  return Math.max(1, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1)
}

function calcCostTotals(costs: Cost[]) {
  let totalSpent = 0, monthlyOngoing = 0
  for (const c of costs) {
    if (c.is_monthly) { totalSpent += c.amount * monthsElapsed(c.date); monthlyOngoing += c.amount }
    else               { totalSpent += c.amount }
  }
  return { totalSpent, monthlyOngoing }
}

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

// ── Shared styles ──────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'rgba(8,20,38,0.50)',
  border: '0.5px solid rgba(255,255,255,0.18)',
  borderRadius: '14px',
  backdropFilter: 'blur(12px)',
}

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '0.5px solid rgba(255,255,255,0.18)',
  borderRadius: '10px',
  color: '#fff',
  width: '100%',
  padding: '9px 13px',
  fontSize: '13px',
  outline: 'none',
}

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'rgba(255,255,255,0.38)',
  marginBottom: '5px',
}

const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)'
}
const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)'
}

const thStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  borderBottom: '0.5px solid rgba(255,255,255,0.12)',
}

// ── Stat box ───────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, muted }: { label: string; value: React.ReactNode; sub?: string; muted?: boolean }) {
  return (
    <div style={card} className="p-5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">{label}</p>
      <div className="text-3xl font-bold font-mono tabular-nums mb-1" style={{ color: muted ? 'rgba(255,255,255,0.20)' : '#f5a623' }}>
        {value}
      </div>
      {sub && <p className="text-xs text-white/30">{sub}</p>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdminTabs({ overviewStats, events, locations: initLocations, costs: initCosts, users, matchesEnabled }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  // Locations state
  const [locations, setLocations]   = useState(initLocations)
  const [locName, setLocName]           = useState('')
  const [locAddress, setLocAddress]     = useState('')
  const [locMaps, setLocMaps]           = useState('')
  const [locExtra, setLocExtra]         = useState('')
  const [locDeadline, setLocDeadline]   = useState('')
  const [locSaving, setLocSaving]       = useState(false)
  const [locMsg, setLocMsg]             = useState<{ ok: boolean; text: string } | null>(null)
  const [editingLocId, setEditingLocId] = useState<string | null>(null)
  const locFormRef = useRef<HTMLDivElement>(null)

  // Costs state
  const [costs, setCosts]           = useState(initCosts)
  const [costDesc, setCostDesc]     = useState('')
  const [costAmount, setCostAmount] = useState('')
  const [costDate, setCostDate]     = useState(new Date().toISOString().slice(0, 10))
  const [costMonthly, setCostMonthly] = useState(false)
  const [costSaving, setCostSaving] = useState(false)
  const [costMsg, setCostMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  // Users state
  const [userSearch, setUserSearch] = useState('')
  const [userFilter, setUserFilter] = useState<'all' | 'admins' | 'unconfirmed'>('all')
  const [userBusy, setUserBusy]     = useState<string | null>(null)

  const { totalSpent, monthlyOngoing } = calcCostTotals(costs)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Overview'   },
    { id: 'events',     label: 'Events'     },
    { id: 'locations',  label: 'Locations'  },
    { id: 'users',      label: 'Users'      },
    { id: 'financials', label: 'Financials' },
    { id: 'settings',   label: 'Settings'   },
  ]

  // ── Location handlers ────────────────────────────────────────────────────

  function handleStartEdit(l: typeof locations[number]) {
    setEditingLocId(l.id)
    setLocName(l.name)
    setLocAddress(l.address ?? '')
    setLocMaps(l.maps_url ?? '')
    setLocExtra(l.extra_info ?? '')
    setLocDeadline(l.booking_deadline_hours != null ? String(l.booking_deadline_hours) : '')
    setLocMsg(null)
    locFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleCancelEdit() {
    setEditingLocId(null)
    setLocName(''); setLocAddress(''); setLocMaps(''); setLocExtra(''); setLocDeadline('')
    setLocMsg(null)
  }

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault()
    setLocSaving(true); setLocMsg(null)
    const fd = new FormData()
    fd.set('name', locName); fd.set('address', locAddress)
    fd.set('maps_url', locMaps); fd.set('extra_info', locExtra)
    fd.set('booking_deadline_hours', locDeadline)
    if (editingLocId) {
      const r = await updateLocation(editingLocId, fd)
      if (r?.fout) {
        setLocMsg({ ok: false, text: r.fout })
      } else {
        setLocMsg({ ok: true, text: 'Location updated.' })
        setEditingLocId(null)
        setLocName(''); setLocAddress(''); setLocMaps(''); setLocExtra(''); setLocDeadline('')
        window.location.reload()
      }
    } else {
      const r = await createLocation(fd)
      if (r?.fout) {
        setLocMsg({ ok: false, text: r.fout })
      } else {
        setLocMsg({ ok: true, text: 'Location saved.' })
        setLocName(''); setLocAddress(''); setLocMaps(''); setLocExtra(''); setLocDeadline('')
        window.location.reload()
      }
    }
    setLocSaving(false)
  }

  async function handleDeleteLocation(id: string) {
    if (!confirm('Delete this location?')) return
    await deleteLocation(id)
    setLocations(l => l.filter(x => x.id !== id))
  }

  // ── Cost handlers ────────────────────────────────────────────────────────

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault()
    setCostSaving(true); setCostMsg(null)
    const fd = new FormData()
    fd.set('description', costDesc); fd.set('amount', costAmount)
    fd.set('date', costDate); fd.set('is_monthly', String(costMonthly))
    const r = await createCost(fd)
    if (r?.fout) {
      setCostMsg({ ok: false, text: r.fout })
    } else {
      setCostMsg({ ok: true, text: 'Cost added.' })
      setCostDesc(''); setCostAmount(''); setCostMonthly(false)
      window.location.reload()
    }
    setCostSaving(false)
  }

  async function handleDeleteCost(id: string) {
    if (!confirm('Delete this cost entry?')) return
    await deleteCost(id)
    setCosts(c => c.filter(x => x.id !== id))
  }

  // ── User handlers ────────────────────────────────────────────────────────

  async function handleToggleAdmin(userId: string, currentlyAdmin: boolean) {
    setUserBusy(userId)
    await setUserAdmin(userId, !currentlyAdmin)
    window.location.reload()
  }

  async function handleRemoveUser(userId: string, name: string) {
    if (!confirm(`Permanently delete ${name}'s account? This cannot be undone.`)) return
    setUserBusy(userId)
    await removeUserAsAdmin(userId)
    window.location.reload()
  }

  // ── Filtered users ───────────────────────────────────────────────────────

  const filteredUsers = users.filter(u => {
    const matchSearch = userSearch === '' ||
      u.naam.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    const matchFilter =
      userFilter === 'all'         ? true :
      userFilter === 'admins'      ? u.is_admin :
      userFilter === 'unconfirmed' ? !u.email_confirmed : true
    return matchSearch && matchFilter
  })

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto"
        style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.10)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-shrink-0 flex-1 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={tab === t.id
              ? { background: 'rgba(245,166,35,0.18)', border: '0.5px solid rgba(245,166,35,0.35)', color: '#f5a623' }
              : { color: 'rgba(255,255,255,0.45)', border: '0.5px solid transparent', cursor: 'pointer' }
            }>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="grid sm:grid-cols-3 gap-4">
          <StatBox label="Players" value={overviewStats.playerCount} sub="registered accounts" />
          <StatBox label="Events completed" value={overviewStats.elapsedEvents} sub="finalized events" />
          <StatBox label="Total sign-ups" value={overviewStats.totalSignups} sub="confirmed participations" />
        </div>
      )}

      {/* ── Events ── */}
      {tab === 'events' && (
        <div>
          <div className="flex justify-end mb-4">
            <Link href="/events/create"
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(245,166,35,0.15)', border: '0.5px solid rgba(245,166,35,0.35)', color: '#f5a623' }}>
              + New event
            </Link>
          </div>
          <div className="rounded-2xl overflow-x-auto" style={{ border: '0.5px solid rgba(255,255,255,0.10)' }}>
            {events.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/30 text-sm" style={{ background: 'rgba(255,255,255,0.02)' }}>
                No events yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={thStyle}>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Date</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Title</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Location</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Players</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Status</th>
                    <th className="px-4 py-3"></th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => {
                    const d = new Date(ev.datetime)
                    const confirmed = ev.event_signups.filter(s => s.status === 'confirmed').length
                    return (
                      <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors"
                        style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                        <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                          {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          <span className="text-white/30 ml-1.5">
                            {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white font-medium max-w-[120px] truncate">{ev.title}</td>
                        <td className="px-4 py-3 text-white/50 hidden sm:table-cell">{ev.location}</td>
                        <td className="px-4 py-3 text-white/35 tabular-nums hidden sm:table-cell">{confirmed}/{ev.court_count * 4}</td>
                        <td className="px-4 py-3 text-sm font-medium whitespace-nowrap"
                          style={{ color: ev.is_finalized ? 'rgba(255,255,255,0.45)' : confirmed >= ev.court_count * 4 ? '#ef9a9a' : '#6fcf97' }}>
                          {ev.is_finalized ? 'Finalized' : confirmed >= ev.court_count * 4 ? 'Full' : 'Open'}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/events/${ev.id}/admin`}
                            className="text-xs font-medium transition-colors hover:opacity-70 whitespace-nowrap"
                            style={{ color: '#f5a623' }}>
                            Admin →
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
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
      )}

      {/* ── Locations ── */}
      {tab === 'locations' && (
        <div className="space-y-5">
          {/* Add / Edit form */}
          <div ref={locFormRef} style={card} className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">
              {editingLocId ? 'Edit location' : 'Add location'}
            </p>
            <form onSubmit={handleAddLocation} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label style={lbl}>Name <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>(required)</span></label>
                  <input type="text" required value={locName} onChange={e => setLocName(e.target.value)}
                    placeholder="Club de Pádel Jávea" style={inp} onFocus={fo} onBlur={fb} />
                </div>
                <div>
                  <label style={lbl}>Address <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>(optional)</span></label>
                  <input type="text" value={locAddress} onChange={e => setLocAddress(e.target.value)}
                    placeholder="Calle Example 12, Jávea" style={inp} onFocus={fo} onBlur={fb} />
                </div>
              </div>
              <div>
                <label style={lbl}>Google Maps link <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>(optional)</span></label>
                <input type="url" value={locMaps} onChange={e => setLocMaps(e.target.value)}
                  placeholder="https://maps.google.com/..." style={inp} onFocus={fo} onBlur={fb} />
              </div>
              <div>
                <label style={lbl}>Extra info <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>(optional)</span></label>
                <textarea value={locExtra} onChange={e => setLocExtra(e.target.value)}
                  placeholder="Parking available, enter through gate B…" rows={2}
                  style={{ ...inp, resize: 'vertical' }} onFocus={fo} onBlur={fb} />
              </div>
              <div>
                <label style={lbl}>Booking deadline <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>(hours before event — optional)</span></label>
                <input type="number" min="1" value={locDeadline} onChange={e => setLocDeadline(e.target.value)}
                  placeholder="e.g. 48" style={inp} onFocus={fo} onBlur={fb} />
                <p className="text-xs text-white/30 mt-1.5">Players who cancel after this deadline will be warned they are responsible for the court cost.</p>
              </div>
              {locMsg && (
                <p className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: locMsg.ok ? 'rgba(76,175,80,0.12)' : 'rgba(232,131,74,0.12)', border: `0.5px solid ${locMsg.ok ? 'rgba(76,175,80,0.32)' : 'rgba(232,131,74,0.30)'}`, color: locMsg.ok ? '#6fcf97' : '#f0a070' }}>
                  {locMsg.text}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={locSaving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: locSaving ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: locSaving ? 'not-allowed' : 'pointer' }}>
                  {locSaving ? 'Saving…' : editingLocId ? 'Save changes' : 'Add location'}
                </button>
                {editingLocId && (
                  <button type="button" onClick={handleCancelEdit}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Locations list */}
          {locations.length > 0 && (
            <div style={card} className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={thStyle}>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Name</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Address</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden md:table-cell">Deadline</th>
                    <th className="px-5 py-3 w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map(l => (
                    <tr key={l.id} className="hover:bg-white/[0.03]"
                      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <td className="px-5 py-3">
                        <p className="text-white font-medium">{l.name}</p>
                        {l.maps_url && (
                          <a href={l.maps_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs transition-colors hover:opacity-80" style={{ color: '#f5a623' }}>
                            Maps ↗
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-3 text-white/45 text-xs hidden sm:table-cell">{l.address ?? '—'}</td>
                      <td className="px-5 py-3 text-white/35 text-xs hidden md:table-cell">
                        {l.booking_deadline_hours != null ? `${l.booking_deadline_hours}h before` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => handleStartEdit(l)}
                            className="text-xs font-medium transition-colors hover:opacity-80"
                            style={{ color: 'rgba(245,166,35,0.70)', cursor: 'pointer', background: 'none', border: 'none' }}>
                            Edit
                          </button>
                          <button onClick={() => handleDeleteLocation(l.id)}
                            className="text-xs text-white/30 hover:text-red-400 transition-colors"
                            style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {locations.length === 0 && (
            <p className="text-center text-white/30 text-sm py-4">No locations registered yet.</p>
          )}
        </div>
      )}

      {/* ── Users ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Search + filters */}
          <div style={card} className="p-4 flex flex-col sm:flex-row gap-3">
            <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{ ...inp, flex: 1 }} onFocus={fo} onBlur={fb} />
            <div className="flex gap-1.5 flex-shrink-0">
              {(['all', 'admins', 'unconfirmed'] as const).map(f => (
                <button key={f} onClick={() => setUserFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={userFilter === f
                    ? { background: 'rgba(245,166,35,0.18)', border: '0.5px solid rgba(245,166,35,0.35)', color: '#f5a623' }
                    : { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.50)', cursor: 'pointer' }
                  }>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/30 px-1">{filteredUsers.length} of {users.length} players</p>

          <div className="rounded-2xl overflow-x-auto" style={{ border: '0.5px solid rgba(255,255,255,0.10)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={thStyle}>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Player</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Phone</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.03] transition-colors"
                    style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.player_number != null && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'rgba(245,166,35,0.12)', color: 'rgba(245,166,35,0.70)' }}>
                            {u.player_number}
                          </span>
                        )}
                        <div>
                          <p className="text-white font-medium">{u.naam}</p>
                          {u.is_admin && (
                            <span className="text-[10px] font-semibold" style={{ color: '#f5a623' }}>Admin</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/45 text-xs hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {u.phone ? (
                        <a href={`tel:${u.phone}`} className="text-xs hover:opacity-80 transition-opacity"
                          style={{ color: 'rgba(255,255,255,0.55)' }}>
                          {u.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={u.email_confirmed
                          ? { background: 'rgba(76,175,80,0.12)', border: '0.5px solid rgba(76,175,80,0.28)', color: '#6fcf97' }
                          : { background: 'rgba(232,131,74,0.12)', border: '0.5px solid rgba(232,131,74,0.28)', color: '#f0a070' }
                        }>
                        {u.email_confirmed ? 'Confirmed' : 'Unconfirmed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button disabled={!!userBusy} onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                          className="text-xs font-medium transition-colors hover:opacity-80 whitespace-nowrap"
                          style={{ color: u.is_admin ? 'rgba(255,255,255,0.35)' : 'rgba(245,166,35,0.70)', cursor: userBusy ? 'not-allowed' : 'pointer', background: 'none', border: 'none' }}>
                          {u.is_admin ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button disabled={!!userBusy} onClick={() => handleRemoveUser(u.id, u.naam)}
                          className="text-xs transition-colors hover:text-red-400"
                          style={{ color: 'rgba(255,255,255,0.25)', cursor: userBusy ? 'not-allowed' : 'pointer', background: 'none', border: 'none' }}>
                          {userBusy === u.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-white/30 text-sm">No players match the current filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Financials ── */}
      {tab === 'financials' && (
        <div className="space-y-5">
          {/* Stat boxes */}
          <div className="grid sm:grid-cols-3 gap-4">
            <StatBox label="Total income" value="—" sub="not yet tracked" muted />
            <StatBox label="Total costs" value={fmt(totalSpent)} sub="all time" />
            <StatBox label="Monthly costs" value={fmt(monthlyOngoing)} sub="ongoing per month" />
          </div>

          {/* Add cost */}
          <div style={card} className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Add cost</p>
            <form onSubmit={handleAddCost} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label style={lbl}>Description</label>
                  <input type="text" required value={costDesc} onChange={e => setCostDesc(e.target.value)}
                    placeholder="Court rental, equipment…" style={inp} onFocus={fo} onBlur={fb} />
                </div>
                <div>
                  <label style={lbl}>Amount (€)</label>
                  <input type="number" required min="0.01" step="0.01" value={costAmount}
                    onChange={e => setCostAmount(e.target.value)}
                    placeholder="0.00" style={inp} onFocus={fo} onBlur={fb} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label style={lbl}>Date</label>
                  <input type="date" required value={costDate} onChange={e => setCostDate(e.target.value)}
                    style={{ ...inp, colorScheme: 'dark' }} onFocus={fo} onBlur={fb} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={costMonthly}
                        onChange={e => setCostMonthly(e.target.checked)} />
                      <div className="toggle-track w-10 h-6 rounded-full transition-colors"
                        style={{ background: costMonthly ? '#f5a623' : 'rgba(255,255,255,0.15)' }}>
                        <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                          style={{ left: costMonthly ? '20px' : '2px' }} />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-white">Monthly recurring</p>
                      <p className="text-xs text-white/35">Repeats every month from date above</p>
                    </div>
                  </label>
                </div>
              </div>
              {costMsg && (
                <p className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: costMsg.ok ? 'rgba(76,175,80,0.12)' : 'rgba(232,131,74,0.12)', border: `0.5px solid ${costMsg.ok ? 'rgba(76,175,80,0.32)' : 'rgba(232,131,74,0.30)'}`, color: costMsg.ok ? '#6fcf97' : '#f0a070' }}>
                  {costMsg.text}
                </p>
              )}
              <button type="submit" disabled={costSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: costSaving ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: costSaving ? 'not-allowed' : 'pointer' }}>
                {costSaving ? 'Saving…' : 'Add cost'}
              </button>
            </form>
          </div>

          {/* Costs list */}
          {costs.length > 0 && (
            <div style={card} className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={thStyle}>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Description</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Date</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Type</th>
                    <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Amount</th>
                    <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden md:table-cell">Total paid</th>
                    <th className="px-5 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map(c => {
                    const months = c.is_monthly ? monthsElapsed(c.date) : null
                    return (
                      <tr key={c.id} className="hover:bg-white/[0.03]"
                        style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                        <td className="px-5 py-3 text-white font-medium">{c.description}</td>
                        <td className="px-5 py-3 text-white/45 hidden sm:table-cell">
                          {new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3 hidden sm:table-cell">
                          <span className="text-[11px] px-2 py-0.5 rounded-full"
                            style={c.is_monthly
                              ? { background: 'rgba(109,208,232,0.12)', border: '0.5px solid rgba(109,208,232,0.28)', color: '#6dd0e8' }
                              : { background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.45)' }
                            }>
                            {c.is_monthly ? 'Monthly' : 'One-time'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold text-white/80">
                          {fmt(c.amount)}
                          {c.is_monthly && <span className="text-white/35 text-xs">/mo</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-white/40 font-mono hidden md:table-cell">
                          {months ? `${fmt(c.amount * months)} (${months}mo)` : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => handleDeleteCost(c.id)}
                            className="text-xs text-white/25 hover:text-red-400 transition-colors"
                            style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {costs.length === 0 && (
            <p className="text-center text-white/30 text-sm py-4">No costs recorded yet.</p>
          )}
        </div>
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && (
        <div style={card} className="p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Matches</p>
          <MatchesToggle initialEnabled={matchesEnabled} />
        </div>
      )}
    </>
  )
}
