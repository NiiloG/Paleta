'use client'

import { useState } from 'react'
import type { WedstrijdMetDetails } from '@/types'
import { legResultaatVast } from '@/app/actions/wedstrijden'

interface Props {
  wedstrijd: WedstrijdMetDetails
}

export default function ResultaatFormulier({ wedstrijd }: Props) {
  const [bezig, setBezig] = useState(false)
  const [bericht, setBericht] = useState<{ type: 'fout' | 'succes'; tekst: string } | null>(null)

  const datum = new Date(wedstrijd.gepland_op)
  const team1 = wedstrijd.aanmeldingen.filter(a => a.team === 1)
  const team2 = wedstrijd.aanmeldingen.filter(a => a.team === 2)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBezig(true)
    setBericht(null)
    const formData = new FormData(e.currentTarget)
    const result = await legResultaatVast(formData)
    if (result?.fout) {
      setBericht({ type: 'fout', tekst: result.fout })
    } else {
      setBericht({ type: 'succes', tekst: 'Result recorded!' })
    }
    setBezig(false)
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.07)',
    border: '0.5px solid rgba(255,255,255,0.16)',
    borderRadius: '12px',
    padding: '16px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginBottom: '8px',
  }

  const scoreInputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '0.5px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    color: '#fff',
    width: '100%',
    padding: '10px',
    fontSize: '20px',
    fontWeight: 700,
    fontFamily: 'var(--font-inter)',
    textAlign: 'center',
    outline: 'none',
  }

  return (
    <div style={cardStyle}>
      <p className="text-sm font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.80)' }}>
        {datum.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
        <span className="font-normal ml-2" style={{ color: 'rgba(255,255,255,0.30)' }}>
          {datum.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-3 mt-3 mb-4">
        {[{ team: team1, nr: 1 }, { team: team2, nr: 2 }].map(({ team, nr }) => (
          <div key={nr}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.30)' }}>Team {nr}</p>
            {team.map(a => (
              <p key={a.id} className="text-xs leading-5" style={{ color: 'rgba(255,255,255,0.55)' }}>{a.profiel?.naam}</p>
            ))}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="hidden" name="wedstrijd_id" value={wedstrijd.id} />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            <label style={labelStyle}>Team 1</label>
            <input
              name="team1_score"
              type="number"
              min="0"
              max="99"
              required
              style={scoreInputStyle}
              onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.7)' }}
              onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
            />
          </div>
          <span className="font-bold text-lg mt-5" style={{ color: 'rgba(255,255,255,0.20)' }}>–</span>
          <div>
            <label style={labelStyle}>Team 2</label>
            <input
              name="team2_score"
              type="number"
              min="0"
              max="99"
              required
              style={scoreInputStyle}
              onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.7)' }}
              onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.15)' }}
            />
          </div>
        </div>

        {bericht && (
          <div style={{
            padding: '8px 12px', borderRadius: '8px', fontSize: '12px',
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
          className="w-full py-2 text-sm font-semibold rounded-xl transition-all"
          style={{ background: bezig ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}
        >
          {bezig ? 'Saving…' : 'Save result'}
        </button>
      </form>
    </div>
  )
}
