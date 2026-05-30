'use client'

import { useState } from 'react'
import { deleteEvent } from '@/app/actions/events'

export default function EventBeheerKnop({ eventId, isFinalized }: { eventId: string; isFinalized: boolean }) {
  const [bezig, setBezig] = useState(false)

  async function handleDelete() {
    const msg = isFinalized
      ? 'This event is finalized (ELO already applied). Delete anyway? This cannot be undone.'
      : 'Delete this event and all its signups/matches? This cannot be undone.'
    if (!confirm(msg)) return
    setBezig(true)
    await deleteEvent(eventId)
    setBezig(false)
  }

  return (
    <button
      onClick={handleDelete}
      disabled={bezig}
      className="text-xs font-medium transition-colors"
      style={{ color: 'rgba(255,255,255,0.30)', cursor: bezig ? 'not-allowed' : 'pointer', opacity: bezig ? 0.4 : 1 }}
      onMouseEnter={e => { if (!bezig) e.currentTarget.style.color = 'rgba(232,100,100,0.80)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.30)' }}
    >
      {bezig ? '…' : 'Delete'}
    </button>
  )
}
