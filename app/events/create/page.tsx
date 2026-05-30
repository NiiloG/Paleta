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

function localDatetimeNow() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export default function CreateEventPage() {
  const router = useRouter()
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const formData = new FormData(e.currentTarget)
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
          <div>
            <label style={labelStyle}>Event title</label>
            <input
              name="title" type="text" required placeholder="Summer Americano"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
              onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Date & time</label>
            <input
              name="datetime" type="datetime-local" required
              defaultValue={localDatetimeNow()}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
              onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Location</label>
            <input
              name="location" type="text" required placeholder="Club Javea"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
              onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Organizer <span style={{ color: 'rgba(255,255,255,0.25)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
            <input
              name="organizer" type="text" placeholder="e.g. Club Javea · Niels"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
              onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Number of courts</label>
            <input
              name="court_count" type="number" required min="1" max="10" defaultValue="2"
              style={{ ...inputStyle, width: '120px' }}
              onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
              onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)' }}
            />
            <p className="text-xs text-white/35 mt-1.5">Max players = courts × 4</p>
          </div>

          {fout && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
              background: 'rgba(232,131,74,0.15)', border: '0.5px solid rgba(232,131,74,0.35)', color: '#f0a070' }}>
              {fout}
            </div>
          )}

          <button
            type="submit" disabled={bezig}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: bezig ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}
          >
            {bezig ? 'Creating…' : 'Create event'}
          </button>
        </form>
      </div>
    </div>
  )
}
