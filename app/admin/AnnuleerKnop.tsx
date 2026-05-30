'use client'

import { useState } from 'react'
import { annuleerWedstrijd } from '@/app/actions/wedstrijden'

export default function AnnuleerKnop({ wedstrijdId }: { wedstrijdId: string }) {
  const [bezig, setBezig] = useState(false)

  async function handleClick() {
    if (!confirm('Are you sure you want to cancel this match?')) return
    setBezig(true)
    await annuleerWedstrijd(wedstrijdId)
    setBezig(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={bezig}
      className="text-xs font-medium transition-colors"
      style={{ color: 'rgba(255,255,255,0.30)', cursor: bezig ? 'not-allowed' : 'pointer', opacity: bezig ? 0.4 : 1 }}
      onMouseEnter={e => { if (!bezig) e.currentTarget.style.color = 'rgba(232,100,100,0.80)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.30)' }}
    >
      {bezig ? '…' : 'Cancel'}
    </button>
  )
}
