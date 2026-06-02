'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function WelcomePopup() {
  const [show, setShow]               = useState(false)
  const [playerNumber, setPlayerNumber] = useState<number | null>(null)
  const [userId, setUserId]           = useState('')

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const key = `paleta_welcomed_${user.id}`
      if (localStorage.getItem(key)) return

      const { data: profiel } = await supabase
        .from('profielen')
        .select('player_number')
        .eq('id', user.id)
        .single()

      if (profiel?.player_number == null) return

      setPlayerNumber(profiel.player_number)
      setUserId(user.id)
      setShow(true)
    }
    check()
  }, [])

  function dismiss() {
    if (userId) localStorage.setItem(`paleta_welcomed_${userId}`, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: 'rgba(6,18,32,0.97)',
          border: '0.5px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <h2 className="font-serif text-2xl font-bold text-white mb-5">
          Welcome to paleta 🎾
        </h2>

        {/* Player number highlight */}
        <div
          className="rounded-xl px-5 py-4 mb-5 text-center"
          style={{ background: 'rgba(245,166,35,0.10)', border: '0.5px solid rgba(245,166,35,0.28)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Your player number
          </p>
          <p
            className="font-bold font-mono tabular-nums leading-none mb-2"
            style={{ fontSize: '64px', color: '#f5a623' }}
          >
            #{playerNumber}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Remember this for on the court!
          </p>
        </div>

        {/* Message */}
        <p className="text-sm leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Just join an Event and you&apos;re set!
        </p>

        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
          — Niels
        </p>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="w-full py-3 rounded-xl text-sm font-semibold tracking-wide transition-all hover:opacity-90"
          style={{ background: '#f5a623', color: '#0a2a3d' }}
        >
          Let&apos;s go!
        </button>
      </div>
    </div>
  )
}
