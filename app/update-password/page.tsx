'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [bezig, setBezig]             = useState(false)
  const [fout, setFout]               = useState<string | null>(null)
  const [done, setDone]               = useState(false)

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
  const cardStyle: React.CSSProperties = {
    background: 'rgba(8,20,38,0.60)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '14px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)

    if (password.length < 8) {
      setFout('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setFout('Passwords do not match.')
      return
    }

    setBezig(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setFout(error.message)
      setBezig(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (done) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm p-8 text-center" style={cardStyle}>
          <p className="text-2xl mb-2">✓</p>
          <p className="text-white font-semibold mb-1">Password updated</p>
          <p className="text-white/40 text-sm">Redirecting to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-serif text-3xl font-bold text-white mb-1">New password</p>
          <p className="text-white/45 text-sm">Choose a new password for your account.</p>
        </div>

        <div style={cardStyle} className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label style={lbl}>New password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8+ characters"
                style={inp}
                onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
                onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)' }}
              />
            </div>
            <div>
              <label style={lbl}>Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Same password again"
                style={inp}
                onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)' }}
                onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)' }}
              />
            </div>

            {fout && (
              <p className="text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(232,131,74,0.12)', border: '0.5px solid rgba(232,131,74,0.30)', color: '#f0a070' }}>
                {fout}
              </p>
            )}

            <button
              type="submit"
              disabled={bezig}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: bezig ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}
            >
              {bezig ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
