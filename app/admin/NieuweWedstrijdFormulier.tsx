'use client'

import { useState } from 'react'
import { maakWedstrijd } from '@/app/actions/wedstrijden'

export default function NieuweWedstrijdFormulier() {
  const [bezig, setBezig] = useState(false)
  const [bericht, setBericht] = useState<{ type: 'fout' | 'succes'; tekst: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBezig(true)
    setBericht(null)
    const formData = new FormData(e.currentTarget)
    const result = await maakWedstrijd(formData)
    if (result?.fout) {
      setBericht({ type: 'fout', tekst: result.fout })
    } else {
      setBericht({ type: 'succes', tekst: 'Match scheduled!' })
      ;(e.target as HTMLFormElement).reset()
    }
    setBezig(false)
  }

  const morgen = new Date()
  morgen.setDate(morgen.getDate() + 1)
  const minDatum = morgen.toISOString().split('T')[0]

  const inputStyle = {
    background: 'rgba(255,255,255,0.07)',
    border: '0.5px solid rgba(255,255,255,0.15)',
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
    marginBottom: '8px',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label style={labelStyle}>Date</label>
        <input name="datum" type="date" required min={minDatum} style={inputStyle}
          onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.7)' }}
          onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Time</label>
        <input name="tijd" type="time" required defaultValue="10:00" style={inputStyle}
          onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.7)' }}
          onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Location</label>
        <input name="locatie" type="text" placeholder="Javea" style={inputStyle}
          onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.7)' }}
          onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
        />
      </div>

      {bericht && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px', fontSize: '13px',
          background: bericht.type === 'succes' ? 'rgba(245,166,35,0.10)' : 'rgba(232,131,74,0.15)',
          border: `0.5px solid ${bericht.type === 'succes' ? 'rgba(245,166,35,0.30)' : 'rgba(232,131,74,0.35)'}`,
          color: bericht.type === 'succes' ? '#f5a623' : '#f0a070',
        }}>
          {bericht.tekst}
        </div>
      )}

      <button
        type="submit"
        disabled={bezig}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{ background: bezig ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}
      >
        {bezig ? 'Scheduling…' : 'Schedule match'}
      </button>
    </form>
  )
}
