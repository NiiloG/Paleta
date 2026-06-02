'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent } from '@/app/actions/events'

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '0.5px solid rgba(255,255,255,0.18)',
  borderRadius: '10px',
  color: '#fff',
  width: '100%',
  padding: '10px 14px',
  fontSize: '14px',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color: 'rgba(255,255,255,0.40)',
  marginBottom: '6px',
}

const optLabel: React.CSSProperties = {
  textTransform: 'none',
  letterSpacing: 0,
  fontWeight: 400,
  color: 'rgba(255,255,255,0.25)',
}

function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)'
}
function focusOff(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)'
}

function localIsoDateNow(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function localTimeNow(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// Build a timezone-aware ISO datetime so the DB stores the correct UTC equivalent.
function buildDatetime(isoDate: string, hhmm: string): string {
  const off  = -new Date().getTimezoneOffset()          // e.g. 120 for UTC+2
  const sign = off >= 0 ? '+' : '-'
  const h    = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const m    = String(Math.abs(off) % 60).padStart(2, '0')
  return `${isoDate}T${hhmm}:00${sign}${h}:${m}`
}

function levelPickerLabel(val: number): string {
  if (val >= 6.0) return 'Expert'
  if (val >= 4.0) return 'Advanced'
  if (val >= 2.0) return 'Intermediate'
  return 'Beginner'
}

// Calendar picker that displays DD-MM-YYYY regardless of browser locale.
// The native date input (transparent text) provides the calendar UI;
// an overlay span shows the formatted value.
function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const display = value
    ? `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`
    : ''
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 36px 0 14px',
        fontSize: '14px',
        color: value ? '#fff' : 'rgba(255,255,255,0.3)',
        pointerEvents: 'none',
        zIndex: 1,
      }}>
        {display || 'DD-MM-YYYY'}
      </span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, color: 'transparent', colorScheme: 'dark' }}
        onFocus={focusOn}
        onBlur={focusOff}
      />
    </div>
  )
}

export default function CreateEventPage() {
  const router = useRouter()
  const [bezig, setBezig]         = useState(false)
  const [fout, setFout]           = useState<string | null>(null)
  const [minLevel, setMinLevel]   = useState('')
  const [maxLevel, setMaxLevel]   = useState('')
  const [isoDate, setIsoDate]     = useState(localIsoDateNow)
  const [startTime, setStartTime] = useState(localTimeNow)
  const [endTime, setEndTime]     = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const formData = new FormData(e.currentTarget)
    formData.set('datetime', buildDatetime(isoDate, startTime))
    const result = await createEvent(formData)
    if (result?.fout) {
      setFout(result.fout)
      setBezig(false)
    } else {
      router.push(`/events/${result.id}/admin`)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#f5a623' }}>Admin</p>
        <h1 className="font-serif text-3xl font-bold text-white">Create event</h1>
      </div>

      <div style={{
        background: 'rgba(8,20,38,0.50)',
        border: '0.5px solid rgba(255,255,255,0.18)',
        borderRadius: '14px',
        backdropFilter: 'blur(12px)',
        padding: '2rem',
      }}>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Title */}
          <div>
            <label style={labelStyle}>Event title</label>
            <input name="title" type="text" required placeholder="Summer Americano"
              style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>

          {/* Date left · Start + End time stacked right */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Date</label>
              <DatePicker value={isoDate} onChange={setIsoDate} />
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label style={labelStyle}>Start time</label>
                <input type="time" required value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              </div>
              <div>
                <label style={labelStyle}>End time <span style={optLabel}>(optional)</span></label>
                <input name="end_time" type="time" value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location</label>
            <input name="location" type="text" required placeholder="Club Javea"
              style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>

          {/* Court count + Court numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Number of courts</label>
              <input name="court_count" type="number" required min="1" max="10" defaultValue="2"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              <p className="text-xs text-white/35 mt-1.5">Max players = courts × 4</p>
            </div>
            <div>
              <label style={labelStyle}>Court numbers <span style={optLabel}>(optional)</span></label>
              <input name="court_numbers" type="text" placeholder="e.g. 3, 5"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              <p className="text-xs text-white/35 mt-1.5">Shown on the event page</p>
            </div>
          </div>

          {/* Match type */}
          <div>
            <label style={labelStyle}>Match type</label>
            <select name="match_type" defaultValue="Mixed"
              style={inputStyle} onFocus={focusOn} onBlur={focusOff}>
              <option value="Mixed">Mixed</option>
              <option value="Men only">Men only</option>
              <option value="Women only">Women only</option>
            </select>
          </div>

          {/* Level range */}
          <div>
            <label style={labelStyle}>Level requirements <span style={optLabel}>(optional)</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-widest">Min (0.0 – 7.0)</p>
                <input name="min_level" type="number" min="0" max="7" step="0.5"
                  value={minLevel} onChange={e => setMinLevel(e.target.value)}
                  placeholder="e.g. 2.5"
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                {minLevel && (
                  <p className="text-[11px] mt-1.5" style={{ color: '#f5a623' }}>
                    {levelPickerLabel(parseFloat(minLevel))}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-widest">Max (0.0 – 7.0)</p>
                <input name="max_level" type="number" min="0" max="7" step="0.5"
                  value={maxLevel} onChange={e => setMaxLevel(e.target.value)}
                  placeholder="e.g. 5.5"
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                {maxLevel && (
                  <p className="text-[11px] mt-1.5" style={{ color: '#f5a623' }}>
                    {levelPickerLabel(parseFloat(maxLevel))}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-white/35 mt-1.5">
              Beginner 0–1.99 · Intermediate 2–3.99 · Advanced 4–5.99 · Expert 6–7
            </p>
          </div>

          {fout && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
              background: 'rgba(232,131,74,0.15)', border: '0.5px solid rgba(232,131,74,0.35)', color: '#f0a070' }}>
              {fout}
            </div>
          )}

          <button type="submit" disabled={bezig}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: bezig ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
            {bezig ? 'Creating…' : 'Create event'}
          </button>
        </form>
      </div>
    </div>
  )
}
