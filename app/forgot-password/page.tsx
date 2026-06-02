'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [bezig, setBezig]   = useState(false)
  const [sent, setSent]     = useState(false)
  const [fout, setFout]     = useState<string | null>(null)

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
    setBezig(true)

    const supabase = createClient()
    const origin   = window.location.origin

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/api/auth/callback?next=/update-password`,
    })

    if (error) {
      setFout(error.message)
      setBezig(false)
      return
    }

    setSent(true)
    setBezig(false)
  }

  if (sent) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm p-8 text-center" style={cardStyle}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(245,166,35,0.15)', border: '0.5px solid rgba(245,166,35,0.30)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#f5a623' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-white font-semibold mb-2">Check your inbox</p>
          <p className="text-white/45 text-sm leading-relaxed mb-6">
            If an account exists for <span className="text-white/70">{email}</span>, a reset link is on its way.
          </p>
          <Link href="/" className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: '#f5a623' }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-serif text-3xl font-bold text-white mb-1">Reset password</p>
          <p className="text-white/45 text-sm">Enter your email and we'll send a reset link.</p>
        </div>

        <div style={cardStyle} className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] mb-2"
                style={{ color: 'rgba(255,255,255,0.38)' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
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
              {bezig ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <p className="mt-5 pt-5 text-center text-xs"
            style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.38)' }}>
            Remembered it?{' '}
            <Link href="/" className="font-semibold transition-colors hover:opacity-80" style={{ color: '#f5a623' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
