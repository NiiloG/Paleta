'use client'

import { useState } from 'react'
import { updateBlurNumber } from '@/app/actions/profile'

export default function BlurNumberToggle({ initialValue }: { initialValue: boolean }) {
  const [on, setOn]     = useState(initialValue)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    const next = !on
    await updateBlurNumber(next)
    setOn(next)
    setBusy(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={on ? 'Show player number on leaderboard' : 'Blur player number on leaderboard'}
      className="toggle-track relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200"
      style={{
        background: on ? '#f5a623' : 'rgba(255,255,255,0.15)',
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span
        className="inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-200"
        style={{ marginTop: '3px', transform: on ? 'translateX(21px)' : 'translateX(3px)' }}
      />
    </button>
  )
}
