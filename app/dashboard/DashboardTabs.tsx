'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Profiel } from '@/types'
import { tierCfg, eloToPlaytomic } from '@/lib/tier'
import EmailToggle from '@/components/EmailToggle'
import BlurNameToggle from '@/components/BlurNameToggle'
import BlurNumberToggle from '@/components/BlurNumberToggle'
import { createClient } from '@/lib/supabase/client'
import {
  updateProfileInfo,
  sendPasswordReset,
  deleteAccount,
} from '@/app/actions/profile'

type Tab = 'overview' | 'history' | 'settings'

export type HistorieRij = {
  wedstrijd_id: string
  team: number | null
  wedstrijden: {
    id: string
    gepland_op: string
    locatie: string
    status: string
    resultaten: Array<{ team1_score: number; team2_score: number }>
  }
}

export type EventHistorieRij = {
  event_id: string
  elo_at_signup: number
  elo_after: number | null
  events: {
    id: string
    title: string
    datetime: string
    location: string
    is_finalized: boolean
  } | null
}

function TrophyIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <path d="M4 22h16" /><path d="M10 22V16" /><path d="M14 22V16" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

interface Props {
  p: Profiel
  positie: number
  totaalSpelers: number
  winPct: number
  historie: HistorieRij[]
  eventHistorie: EventHistorieRij[]
}

export default function DashboardTabs({ p, positie, totaalSpelers, winPct, historie, eventHistorie }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')

  // Profile form
  const [firstName, setFirstName] = useState(() => p.naam.split(' ')[0] || '')
  const [lastName,  setLastName]  = useState(() => p.naam.split(' ').slice(1).join(' '))
  const [phone,     setPhone]     = useState(() => p.phone ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  // Password reset
  const [resetBusy, setResetBusy] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Avatar upload
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(p.avatar_url ?? null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarMsg,       setAvatarMsg]       = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setAvatarMsg('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setAvatarMsg('Image must be under 5 MB.'); return }
    setAvatarUploading(true); setAvatarMsg(null)
    const supabase = createClient()
    const { error: upErr } = await supabase.storage.from('avatars').upload(p.id, file, { upsert: true, contentType: file.type })
    if (upErr) { setAvatarMsg('Upload failed: ' + upErr.message); setAvatarUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(p.id)
    const { error: dbErr } = await supabase.from('profielen').update({ avatar_url: publicUrl }).eq('id', p.id)
    if (dbErr) { setAvatarMsg('Saved photo but could not update profile.'); setAvatarUploading(false); return }
    setAvatarUrl(publicUrl + '?t=' + Date.now())
    setAvatarMsg('Photo updated!')
    setAvatarUploading(false)
  }

  // Delete account
  const [showDelete,  setShowDelete]  = useState(false)
  const [deleteBusy,  setDeleteBusy]  = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const tier = tierCfg(p.elo_rating)

  const cardStyle: React.CSSProperties = {
    background: 'rgba(8,20,38,0.50)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '10px',
    color: '#fff',
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
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
  const fo = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)'
  }
  const fb = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)'
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaveMsg(null)
    const fd = new FormData()
    fd.set('first_name', firstName)
    fd.set('last_name',  lastName)
    fd.set('phone',      phone)
    const result = await updateProfileInfo(fd)
    setSaveMsg(result?.fout
      ? { ok: false, text: result.fout }
      : { ok: true,  text: 'Profile updated.' }
    )
    setSaving(false)
  }

  async function handlePasswordReset() {
    setResetBusy(true)
    await sendPasswordReset()
    setResetSent(true)
    setResetBusy(false)
  }

  async function handleDeleteAccount() {
    setDeleteBusy(true); setDeleteError(null)
    const result = await deleteAccount()
    if (result?.fout) {
      setDeleteError(result.fout)
      setDeleteBusy(false)
    } else {
      router.push('/')
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'history',  label: 'History'  },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <>
      {/* ── Tab bar ── */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.10)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
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
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              {
                label: 'Rating',
                value: <span className="text-4xl font-bold font-mono tabular-nums" style={{ color: tier.color }}>{eloToPlaytomic(p.elo_rating)}</span>,
                sub: <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: tier.bg, border: `0.5px solid ${tier.border}`, color: tier.color }}>{tier.label}</span>,
              },
              {
                label: 'Played',
                value: <span className="text-4xl font-bold text-white tabular-nums">{p.wedstrijden_gespeeld}</span>,
                sub: <span className="text-xs text-white/30">matches</span>,
              },
              {
                label: 'W / D / L',
                value: (() => {
                  const draws = Math.max(0, p.wedstrijden_gespeeld - p.gewonnen - p.verloren)
                  return (
                    <span className="text-3xl font-bold font-mono tabular-nums">
                      <span style={{ color: '#1a7c44' }}>{p.gewonnen}</span>
                      <span className="text-white/15 mx-1 text-xl">/</span>
                      <span style={{ color: '#f5a623' }}>{draws}</span>
                      <span className="text-white/15 mx-1 text-xl">/</span>
                      <span style={{ color: '#a12425' }}>{p.verloren}</span>
                    </span>
                  )
                })(),
                sub: <span className="text-xs text-white/30">{winPct}% win rate</span>,
              },
              {
                label: 'Ranking',
                value: (
                  <span className="inline-flex items-center justify-center gap-2" style={{ color: '#f5a623' }}>
                    <TrophyIcon size={28} />
                    <span className="text-4xl font-bold tabular-nums">{positie}</span>
                  </span>
                ),
                sub: <span className="text-xs text-white/30">of {totaalSpelers} players</span>,
              },
            ] as const).map(c => (
              <div key={c.label} style={cardStyle} className="p-5 text-center hover:border-white/20 transition-colors">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">{c.label}</p>
                <div className="mb-1">{c.value}</div>
                <div className="flex justify-center">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Rating history chart */}
          {(() => {
            const sorted = [...eventHistorie]
              .filter(r => r.events != null)
              .sort((a, b) => new Date(a.events!.datetime).getTime() - new Date(b.events!.datetime).getTime())

            type Pt = { elo: number; label: string }
            const series: Pt[] = []
            if (sorted.length > 0) {
              const firstDate = new Date(sorted[0].events!.datetime)
              series.push({ elo: sorted[0].elo_at_signup, label: firstDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })
              for (const r of sorted) {
                if (r.elo_after != null) {
                  const d = new Date(r.events!.datetime)
                  series.push({ elo: r.elo_after, label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })
                }
              }
              if (series[series.length - 1].elo !== p.elo_rating) series.push({ elo: p.elo_rating, label: 'Now' })
            }
            const points = series.slice(-17)
            if (points.length < 2) return null
            const ratings = points.map(pt => parseFloat(eloToPlaytomic(pt.elo)))
            const W = 400, H = 100, pad = { t: 10, r: 12, b: 24, l: 42 }
            const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b
            const minR = Math.min(...ratings), maxR = Math.max(...ratings)

            // Snap Y axis to nearest level boundaries
            const BOUNDS = [0.00, 2.00, 4.00, 6.00, 7.00]
            const loSnap = [...BOUNDS].reverse().find(b => b <= minR) ?? 0.00
            const hiSnap = BOUNDS.find(b => b >= maxR) ?? 7.00
            const snapSpan = (hiSnap - loSnap) || 2.0
            const lo = Math.max(0, loSnap - snapSpan * 0.125)
            const hi = Math.min(7, hiSnap + snapSpan * 0.125)
            const span = (hi - lo) || 2.0
            const xOf = (i: number) => pad.l + (i / (points.length - 1)) * pw
            const yOf = (v: number) => pad.t + ph - ((v - lo) / span) * ph
            const areaD = ratings.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
              + ` L${xOf(ratings.length-1).toFixed(1)},${(pad.t+ph).toFixed(1)} L${xOf(0).toFixed(1)},${(pad.t+ph).toFixed(1)} Z`

            // Level zone fills (0.20 opacity)
            const ZONES = [
              { from: 0.00, to: 2.00, color: 'rgba(129,199,132,0.20)' },
              { from: 2.00, to: 4.00, color: 'rgba(109,208,232,0.20)' },
              { from: 4.00, to: 6.00, color: 'rgba(239,154,154,0.20)' },
              { from: 6.00, to: 7.00, color: 'rgba(249,208,112,0.20)' },
            ].filter(z => z.from < hi && z.to > lo)

            // Y axis integer ticks — start from first whole number ≥ lo
            const yTicks: number[] = []
            for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) yTicks.push(v)

            // Segment color: green up, red down, gold flat
            const segColor = (i: number) => ratings[i] > ratings[i-1] ? '#1a7c44' : ratings[i] < ratings[i-1] ? '#a12425' : '#f5a623'
            const dotColor = () => '#f5a623'

            return (
              <div style={cardStyle} className="p-6">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">Rating history</p>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
                  {/* Level zone background fills */}
                  {ZONES.map(z => {
                    const zTop = yOf(Math.min(z.to, hi))
                    const zBot = yOf(Math.max(z.from, lo))
                    return (
                      <rect key={z.from} x={pad.l} y={zTop} width={pw} height={zBot - zTop} fill={z.color} />
                    )
                  })}
                  {/* Y integer tick labels */}
                  {yTicks.map(v => (
                    <text key={v} x={pad.l - 4} y={yOf(v) + 3} textAnchor="end"
                      fontSize="6.5" style={{ fill: 'var(--chart-label-fill)' }}>{v.toFixed(2)}</text>
                  ))}
                  {/* Y tick marks */}
                  {yTicks.map(v => (
                    <line key={`tick-${v}`} x1={pad.l - 2} x2={pad.l} y1={yOf(v)} y2={yOf(v)}
                      stroke="var(--chart-label-fill)" strokeWidth="0.5" opacity={0.4} />
                  ))}
                  {/* X labels — first, middle, last (deduped to avoid duplicate keys with 2 points) */}
                  {[...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((i) => (
                    <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
                      fontSize="6.5" style={{ fill: 'var(--chart-label-fill)' }}>{points[i].label}</text>
                  ))}
                  {/* Colored line segments */}
                  {ratings.map((v, i) => i === 0 ? null : (
                    <line key={i}
                      x1={xOf(i-1).toFixed(1)} y1={yOf(ratings[i-1]).toFixed(1)}
                      x2={xOf(i).toFixed(1)}   y2={yOf(v).toFixed(1)}
                      stroke={segColor(i)} strokeWidth="1.5" strokeLinecap="round" />
                  ))}
                  {/* Dots */}
                  {ratings.map((v, i) => (
                    <circle key={i} cx={xOf(i)} cy={yOf(v)} r={i === ratings.length-1 ? 3 : 2}
                      fill={dotColor()} stroke="rgba(8,20,38,0.8)" strokeWidth="1" />
                  ))}
                </svg>
              </div>
            )
          })()}

          {/* Account details */}
          <div style={cardStyle} className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">Account details</p>
            <div>
              {[
                { label: 'Email',         value: p.email },
                { label: 'Player ID',     value: p.player_number != null ? `#${p.player_number}` : '—' },
                { label: 'Member since',  value: new Date(p.aangemaakt_op).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
              ].map((row, i, arr) => (
                <div key={row.label} className="flex justify-between items-center gap-4 py-3"
                  style={i < arr.length - 1 ? { borderBottom: '0.5px solid rgba(255,255,255,0.10)' } : {}}>
                  <span className="text-white/40 text-sm flex-shrink-0">{row.label}</span>
                  <span className="text-white text-sm font-medium truncate text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── History ── */}
      {tab === 'history' && (
        <div className="space-y-5">

          {/* Events */}
          <div style={cardStyle} className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Events</p>
            {eventHistorie.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-white/35 text-sm">No events attended yet.</p>
                <Link href="/events" className="inline-block mt-3 text-sm" style={{ color: '#f5a623' }}>
                  Browse events →
                </Link>
              </div>
            ) : (
              <div>
                {eventHistorie.map(row => {
                  const ev = row.events
                  if (!ev) return null
                  const d = new Date(ev.datetime)
                  const impact = row.elo_after != null
                    ? (parseFloat(eloToPlaytomic(row.elo_after)) - parseFloat(eloToPlaytomic(row.elo_at_signup))).toFixed(2)
                    : null
                  const pos = impact != null ? parseFloat(impact) >= 0 : null
                  return (
                    <Link key={row.event_id} href={`/events/${ev.id}`}
                      className="flex items-center justify-between py-3 hover:opacity-80 transition-opacity"
                      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.10)' }}>
                      <div>
                        <p className="text-white text-sm font-medium">{ev.title}</p>
                        <p className="text-white/30 text-xs mt-0.5">
                          {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}{ev.location}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-white/40 text-xs font-mono">{eloToPlaytomic(row.elo_at_signup)}</p>
                        {impact != null ? (
                          <p className="text-sm font-bold font-mono tabular-nums"
                            style={{ color: pos ? '#6fcf97' : '#ef9a9a' }}>
                            {pos ? '+' : ''}{impact}
                          </p>
                        ) : ev.is_finalized ? (
                          <p className="text-xs text-white/25">—</p>
                        ) : (
                          <p className="text-xs" style={{ color: '#f5a623' }}>Upcoming</p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Match history */}
          <div style={cardStyle} className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Match history</p>
            {historie.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-white/35 text-sm">No matches played yet.</p>
                <Link href="/wedstrijden" className="inline-block mt-3 text-sm" style={{ color: '#f5a623' }}>
                  Browse matches →
                </Link>
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
                    <div key={w.id} className="flex items-center justify-between py-3"
                      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.12)' }}>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          <span className="text-white/30 font-normal ml-2">
                            {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
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
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && (
        <div className="space-y-5">

          {/* Profile photo */}
          <div style={cardStyle} className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Profile photo</p>
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover"
                    style={{ border: '2px solid rgba(245,166,35,0.35)' }} />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={{ background: 'rgba(245,166,35,0.12)', border: '2px solid rgba(245,166,35,0.25)', color: '#f5a623' }}>
                    {p.naam.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(245,166,35,0.15)', border: '0.5px solid rgba(245,166,35,0.35)', color: '#f5a623', cursor: avatarUploading ? 'not-allowed' : 'pointer' }}>
                  {avatarUploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
                </button>
                {avatarMsg && (
                  <p className="text-xs" style={{ color: avatarMsg.startsWith('Photo') ? '#6fcf97' : '#f0a070' }}>{avatarMsg}</p>
                )}
                <p className="text-xs text-white/30">JPG, PNG or WebP · max 5 MB</p>
              </div>
            </div>
          </div>

          {/* Profile information */}
          <div style={cardStyle} className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Profile</p>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={lbl}>First name</label>
                  <input type="text" required value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    style={inp} onFocus={fo} onBlur={fb} />
                </div>
                <div>
                  <label style={lbl}>Last name</label>
                  <input type="text" value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    style={inp} onFocus={fo} onBlur={fb} />
                </div>
              </div>
              <div>
                <label style={lbl}>
                  Phone number{' '}
                  <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>
                    (optional)
                  </span>
                </label>
                <input type="tel" value={phone} placeholder="+34 600 000 000"
                  onChange={e => setPhone(e.target.value)}
                  style={inp} onFocus={fo} onBlur={fb} />
                <p className="text-xs text-white/30 mt-1.5">
                  Shown to players when you organise a match so they can reach you.
                </p>
              </div>

              {saveMsg && (
                <p className="text-xs px-3 py-2 rounded-lg"
                  style={{
                    background: saveMsg.ok ? 'rgba(76,175,80,0.12)' : 'rgba(232,131,74,0.12)',
                    border: `0.5px solid ${saveMsg.ok ? 'rgba(76,175,80,0.32)' : 'rgba(232,131,74,0.30)'}`,
                    color: saveMsg.ok ? '#6fcf97' : '#f0a070',
                  }}>
                  {saveMsg.text}
                </p>
              )}

              <button type="submit" disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: saving ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>

          {/* Privacy */}
          <div style={cardStyle} className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Privacy</p>
            <div className="space-y-0">
              {[
                {
                  label: 'Email notifications',
                  sub: 'Get notified when moved from waitlist to confirmed',
                  control: <EmailToggle initialValue={p.email_notifications ?? true} />,
                },
                {
                  label: 'Blur name on leaderboard',
                  sub: 'Your name and profile photo appear blurred on the public rankings',
                  control: <BlurNameToggle initialValue={p.blur_name ?? false} />,
                },
                {
                  label: 'Blur player ID on leaderboard',
                  sub: 'Your player ID appears blurred on the public rankings',
                  control: <BlurNumberToggle initialValue={p.blur_number ?? false} />,
                },
              ].map((row, i, arr) => (
                <div key={row.label} className="flex justify-between items-center py-4 gap-4"
                  style={i < arr.length - 1 ? { borderBottom: '0.5px solid rgba(255,255,255,0.10)' } : {}}>
                  <div>
                    <p className="text-white/75 text-sm">{row.label}</p>
                    <p className="text-white/30 text-xs mt-0.5">{row.sub}</p>
                  </div>
                  {row.control}
                </div>
              ))}
            </div>
          </div>

          {/* Account */}
          <div style={cardStyle} className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-5">Account</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white/75 text-sm">Password</p>
                <p className="text-white/30 text-xs mt-0.5">
                  {resetSent
                    ? 'Reset link sent — check your inbox.'
                    : 'Send a reset link to your email address.'}
                </p>
              </div>
              <button onClick={handlePasswordReset} disabled={resetBusy || resetSent}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80 flex-shrink-0"
                style={{
                  background: resetSent ? 'rgba(76,175,80,0.12)' : 'rgba(255,255,255,0.07)',
                  border: `0.5px solid ${resetSent ? 'rgba(76,175,80,0.32)' : 'rgba(255,255,255,0.18)'}`,
                  color: resetSent ? '#6fcf97' : 'rgba(255,255,255,0.60)',
                  cursor: resetBusy || resetSent ? 'default' : 'pointer',
                }}>
                {resetBusy ? 'Sending…' : resetSent ? 'Email sent ✓' : 'Reset password'}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="p-6 rounded-2xl"
            style={{ background: 'rgba(239,83,80,0.06)', border: '0.5px solid rgba(239,83,80,0.22)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-5"
              style={{ color: 'rgba(239,83,80,0.70)' }}>Danger zone</p>

            {!showDelete ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-white/75 text-sm">Delete account</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    Permanently removes your account, rating, and all match history.
                  </p>
                </div>
                <button onClick={() => setShowDelete(true)}
                  className="px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0 transition-all hover:opacity-80"
                  style={{ background: 'rgba(239,83,80,0.14)', border: '0.5px solid rgba(239,83,80,0.30)', color: '#ef9a9a', cursor: 'pointer' }}>
                  Delete account
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="px-4 py-3 rounded-xl text-sm leading-relaxed"
                  style={{ background: 'rgba(239,83,80,0.10)', border: '0.5px solid rgba(239,83,80,0.25)', color: 'rgba(255,255,255,0.70)' }}>
                  <strong style={{ color: '#ef9a9a' }}>This cannot be undone.</strong>{' '}
                  Your account, ELO rating, match history, and all associated data will be permanently deleted.
                </div>
                {deleteError && (
                  <p className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(232,131,74,0.12)', border: '0.5px solid rgba(232,131,74,0.30)', color: '#f0a070' }}>
                    {deleteError}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={handleDeleteAccount} disabled={deleteBusy}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: deleteBusy ? 'rgba(239,83,80,0.4)' : 'rgba(239,83,80,0.85)', color: '#fff', cursor: deleteBusy ? 'not-allowed' : 'pointer' }}>
                    {deleteBusy ? 'Deleting…' : 'Yes, delete my account'}
                  </button>
                  <button onClick={() => { setShowDelete(false); setDeleteError(null) }}
                    className="text-sm text-white/40 hover:text-white/70 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </>
  )
}
