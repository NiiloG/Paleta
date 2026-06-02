'use client'

import { useState } from 'react'
import { maakWedstrijd } from '@/app/actions/wedstrijden'

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

function buildDatetime(isoDate: string, hhmm: string): string {
  const off  = -new Date().getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const h    = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const m    = String(Math.abs(off) % 60).padStart(2, '0')
  return `${isoDate}T${hhmm}:00${sign}${h}:${m}`
}

function levelLabel(val: number): string {
  if (val >= 6.0) return 'Expert'
  if (val >= 4.0) return 'Advanced'
  if (val >= 2.0) return 'Intermediate'
  return 'Beginner'
}

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const display = value ? `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}` : ''
  const base: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '10px',
    color: 'transparent',
    colorScheme: 'dark',
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    outline: 'none',
  }
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 36px 0 12px',
        fontSize: '14px',
        color: value ? '#fff' : 'rgba(255,255,255,0.3)',
        pointerEvents: 'none', zIndex: 1,
      }}>
        {display || 'DD-MM-YYYY'}
      </span>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        style={base}
        onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
        onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)' }}
      />
    </div>
  )
}

export default function MaakWedstrijdFormulier() {
  const [open, setOpen]         = useState(false)
  const [bezig, setBezig]       = useState(false)
  const [fout, setFout]         = useState<string | null>(null)
  const [isoDate, setIsoDate]   = useState(localIsoDateNow)
  const [tijd, setTijd]         = useState(localTimeNow)
  const [minLevel, setMinLevel] = useState('')
  const [maxLevel, setMaxLevel] = useState('')

  function handleOpen() {
    setFout(null)
    setIsoDate(localIsoDateNow())
    setTijd(localTimeNow())
    setMinLevel('')
    setMaxLevel('')
    setOpen(true)
  }

  function handleClose() { setOpen(false); setFout(null) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const formData = new FormData(e.currentTarget)
    formData.set('gepland_op', buildDatetime(isoDate, tijd))
    const result = await maakWedstrijd(formData)
    setBezig(false)
    if (result?.fout) setFout(result.fout)
    else handleClose()
  }

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '10px',
    color: '#fff',
    width: '100%',
    padding: '10px 12px',
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
  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)'
  }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)'
  }

  return (
    <>
      <button onClick={handleOpen}
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{ background: '#f5a623', color: '#0a2a3d' }}>
        + Create match
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          padding: '1rem',
        }} onClick={handleClose}>
          <div style={{
            background: 'rgba(5,15,30,0.98)',
            border: '0.5px solid rgba(255,255,255,0.20)',
            borderRadius: '16px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '440px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: '#f5a623' }}>
                  Matches
                </p>
                <h2 className="text-xl font-bold text-white">Create a match</h2>
              </div>
              <button onClick={handleClose}
                className="text-white/30 hover:text-white/70 transition-colors mt-0.5"
                style={{ fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>

            {/* Info banner */}
            <div className="mb-4 px-3 py-2.5 rounded-lg text-xs leading-relaxed"
              style={{ background: 'rgba(245,166,35,0.08)', border: '0.5px solid rgba(245,166,35,0.20)', color: 'rgba(255,255,255,0.55)' }}>
              <span style={{ color: '#f5a623', fontWeight: 600 }}>Single · Unranked · 4 players · </span>
              No ELO changes. As the organiser you are responsible for
              booking the court — confirm it on the match card once booked.
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={lbl}>Date</label>
                  <DatePicker value={isoDate} onChange={setIsoDate} />
                </div>
                <div>
                  <label style={lbl}>Time</label>
                  <input type="time" required value={tijd} onChange={e => setTijd(e.target.value)}
                    style={inp} onFocus={fo} onBlur={fb} />
                </div>
              </div>

              {/* Location */}
              <div>
                <label style={lbl}>Location</label>
                <input name="locatie" type="text" placeholder="e.g. Club Javea · Court 3"
                  style={inp} onFocus={fo} onBlur={fb} />
              </div>

              {/* Gender */}
              <div>
                <label style={lbl}>Match type</label>
                <select name="match_type" defaultValue="Mixed" style={inp} onFocus={fo} onBlur={fb}>
                  <option value="Mixed">Mixed</option>
                  <option value="Men only">Men only</option>
                  <option value="Women only">Women only</option>
                </select>
              </div>

              {/* Level range */}
              <div>
                <label style={lbl}>Level requirements <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>(optional)</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-widest">Min (0.0 – 7.0)</p>
                    <input name="min_level" type="number" min="0" max="7" step="0.5"
                      value={minLevel} onChange={e => setMinLevel(e.target.value)}
                      placeholder="e.g. 2.5" style={inp} onFocus={fo} onBlur={fb} />
                    {minLevel && (
                      <p className="text-[11px] mt-1" style={{ color: '#f5a623' }}>
                        {levelLabel(parseFloat(minLevel))}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-widest">Max (0.0 – 7.0)</p>
                    <input name="max_level" type="number" min="0" max="7" step="0.5"
                      value={maxLevel} onChange={e => setMaxLevel(e.target.value)}
                      placeholder="e.g. 5.5" style={inp} onFocus={fo} onBlur={fb} />
                    {maxLevel && (
                      <p className="text-[11px] mt-1" style={{ color: '#f5a623' }}>
                        {levelLabel(parseFloat(maxLevel))}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-white/30 mt-1.5">
                  Beginner 0–1.99 · Intermediate 2–3.99 · Advanced 4–5.99 · Expert 6–7
                </p>
              </div>

              {fout && (
                <p className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(232,131,74,0.12)', border: '0.5px solid rgba(232,131,74,0.30)', color: '#f0a070' }}>
                  {fout}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={bezig}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: bezig ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
                  {bezig ? 'Creating…' : 'Create match'}
                </button>
                <button type="button" onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.50)' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
