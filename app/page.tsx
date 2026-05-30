'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LandingPagina() {
  const supabase = createClient()
  const [authChecked, setAuthChecked] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  // Hide navbar on sign-in page only; restore on unmount (navigation away)
  useEffect(() => {
    document.body.classList.add('hide-nav')
    return () => { document.body.classList.remove('hide-nav') }
  }, [])

  // Check auth before rendering — prevents flash of login form for logged-in users
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        window.location.href = '/events'
      } else {
        setAuthChecked(true)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!authChecked) return <div style={{ minHeight: 'calc(100vh - 4rem)' }} />

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFout(null)
    setBezig(true)

    const formData = new FormData(e.currentTarget)
    const email     = formData.get('email')     as string
    const wachtwoord = formData.get('wachtwoord') as string

    const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord })

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setFout('Je e-mailadres is nog niet bevestigd. Controleer je inbox.')
      } else if (error.message.toLowerCase().includes('invalid login')) {
        setFout('Ongeldig e-mailadres of wachtwoord.')
      } else {
        setFout(error.message)
      }
      setBezig(false)
      return
    }

    window.location.href = '/events'
  }

  const inputCls = 'w-full px-4 py-3 text-sm text-white placeholder-white/30 rounded-xl outline-none transition-all'
  const inputBase: React.CSSProperties = { background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.18)' }
  const labelCls = 'block text-[10px] font-semibold uppercase tracking-[0.16em] mb-2'

  return (
    <div className="flex flex-col min-h-screen">
      <video
        autoPlay loop muted playsInline
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
        style={{ zIndex: -3 }}
      >
        <source src="/videos/Video3_HD.mp4" type="video/mp4" />
      </video>

      {/* Two-column hero */}
      <div className="flex-1 flex items-center px-6 lg:px-10">
        <div className="w-full max-w-4xl mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-8">

          {/* Left – hero copy (desktop only) */}
          <div className="hidden lg:block flex-1">
            <p className="text-xs font-semibold uppercase mb-5" style={{ letterSpacing: '0.22em', color: '#f5a623' }}>
              Costa Blanca · Javea
            </p>

            {/* Logo — scaled to match the original h1 font size */}
            <div className="flex items-center gap-3 mb-5">
              <svg viewBox="-5 -5 75 90" width="100" height="133" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width="38" height="50" rx="19" fill="none" stroke="#f5a623" strokeWidth="3.5"/>
                <line x1="19" y1="50" x2="19" y2="68" stroke="#f5a623" strokeWidth="3.5" strokeLinecap="round"/>
                <circle cx="50" cy="4" r="7" fill="#f5a623"/>
              </svg>
              <div className="leading-tight">
                <p className="text-white font-normal leading-none mb-[9px]" style={{ fontSize: 'clamp(42px, 5vw, 66px)' }}>paleta</p>
                <p className="leading-none">
                  <span className="font-bold" style={{ color: '#f5a623', fontSize: 'clamp(20px, 2.3vw, 32px)', letterSpacing: '0.12em' }}>PADEL</span>
                  <span className="font-light" style={{ color: 'rgba(255,255,255,0.40)', fontSize: 'clamp(20px, 2.3vw, 32px)' }}> · JAVEA</span>
                </p>
              </div>
            </div>

            {/* Smaller "play under the Spanish sun" — same font-serif bold white + gold italic */}
            <p className="font-serif font-bold text-white leading-snug mb-8" style={{ fontSize: 'clamp(16px, 2vw, 22px)' }}>
              Play under the <em style={{ color: '#f5a623', fontStyle: 'italic' }}>Spanish</em> sun.
            </p>

            <div className="flex flex-wrap gap-2.5">
              {['Events', 'Match organizer', 'Rankings'].map(badge => (
                <span
                  key={badge}
                  className="px-4 py-2 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.20)', color: 'rgba(255,255,255,0.72)' }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Right – frosted glass login card */}
          <div
            className="w-full lg:w-[370px] lg:flex-shrink-0 mx-auto lg:mx-0"
            style={{
              background: 'rgba(8,22,40,0.50)',
              border: '0.5px solid rgba(255,255,255,0.16)',
              borderRadius: '16px',
              padding: '2.25rem',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="mb-7">
              <h2 className="text-white font-semibold text-xl mb-1">Welcome back</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className={labelCls} style={{ color: 'rgba(255,255,255,0.42)' }}>Email</label>
                <input
                  id="email" name="email" type="email" required autoComplete="email"
                  placeholder="you@example.com"
                  className={inputCls} style={inputBase}
                  onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,166,35,0.10)' }}
                  onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <label htmlFor="wachtwoord" className={labelCls} style={{ color: 'rgba(255,255,255,0.42)' }}>Password</label>
                <input
                  id="wachtwoord" name="wachtwoord" type="password" required autoComplete="current-password"
                  placeholder="••••••••"
                  className={inputCls} style={inputBase}
                  onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.65)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,166,35,0.10)' }}
                  onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>

              {fout && (
                <div className="px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: 'rgba(232,131,74,0.15)', border: '0.5px solid rgba(232,131,74,0.38)', color: '#f0a070' }}>
                  {fout}
                </div>
              )}

              <button
                type="submit" disabled={bezig}
                className="w-full py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all"
                style={{
                  background: bezig ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.15)',
                  border: '0.5px solid rgba(255,255,255,0.20)',
                  color: '#fff', cursor: bezig ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => { if (!bezig) e.currentTarget.style.background = 'rgba(255,255,255,0.22)' }}
                onMouseLeave={e => { if (!bezig) e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
              >
                {bezig ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-5 pt-5 text-center text-xs"
              style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.38)' }}>
              Don&apos;t have an account?{' '}
              <Link href="/registreren" className="font-semibold transition-colors hover:opacity-80" style={{ color: '#f5a623' }}>
                Register
              </Link>
            </p>
          </div>

        </div>
      </div>

      {/* Down arrow */}
      <div className="flex justify-center pb-7">
        <div className="flex items-center justify-center"
          style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.18)',
            color: 'rgba(255,255,255,0.50)', fontSize: '14px',
          }}>
          ↓
        </div>
      </div>

    </div>
  )
}
