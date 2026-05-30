'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { eloToPlaytomic } from '@/lib/tier'
import { setStartingElo } from '@/app/actions/auth'

const LEVELS = [
  {
    id:    'beginner',
    label: 'Beginner',
    elo:   583,
    desc:  'New to padel or just getting started',
    color: '#81c784',
    bg:    'rgba(76,175,80,0.12)',
    border:'rgba(76,175,80,0.28)',
  },
  {
    id:    'intermediate',
    label: 'Intermediate',
    elo:   750,
    desc:  'Play regularly, understand the basics',
    color: '#6dd0e8',
    bg:    'rgba(42,135,168,0.14)',
    border:'rgba(42,135,168,0.30)',
  },
  {
    id:    'advanced',
    label: 'Advanced',
    elo:   1250,
    desc:  'Competitive player, tournament experience',
    color: '#ef9a9a',
    bg:    'rgba(239,83,80,0.14)',
    border:'rgba(239,83,80,0.32)',
  },
  {
    id:    'expert',
    label: 'Expert',
    elo:   1750,
    desc:  'High-level competitive or professional',
    color: '#f9d070',
    bg:    'rgba(245,166,35,0.16)',
    border:'rgba(245,166,35,0.35)',
  },
] as const

type LevelId = typeof LEVELS[number]['id']

export default function RegistrerenPagina() {
  const supabase = createClient()
  const [fout, setFout]               = useState<string | null>(null)
  const [bezig, setBezig]             = useState(false)
  const [bevestigingNodig, setBevestigingNodig] = useState(false)
  const [niveau, setNiveau]           = useState<LevelId>('intermediate')

  const selectedLevel = LEVELS.find(l => l.id === niveau)!

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFout(null)
    setBezig(true)

    const formData = new FormData(e.currentTarget)
    const naam      = (formData.get('naam')      as string).trim()
    const email     = formData.get('email')      as string
    const wachtwoord = formData.get('wachtwoord') as string

    if (naam.length < 2)       { setFout('Name must be at least 2 characters.');     setBezig(false); return }
    if (wachtwoord.length < 8) { setFout('Password must be at least 8 characters.'); setBezig(false); return }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: wachtwoord,
      options: {
        data: {
          naam,
          elo_rating: selectedLevel.elo,
        },
      },
    })

    if (error) {
      setFout(error.message.includes('already registered') ? 'This email is already registered.' : error.message)
      setBezig(false)
      return
    }

    // Explicitly set the chosen ELO via service role — the DB trigger may default
    // to 1000 if it was created before the metadata-reading version was deployed.
    if (data.user) {
      await setStartingElo(data.user.id, selectedLevel.elo)
    }

    if (data.session) {
      window.location.href = '/'
    } else {
      setBevestigingNodig(true)
      setBezig(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '0.5px solid rgba(255,255,255,0.18)',
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    borderRadius: '16px',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  }

  if (bevestigingNodig) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center p-10" style={cardStyle}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(245,166,35,0.15)', border: '0.5px solid rgba(245,166,35,0.3)' }}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#f5a623' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl font-bold text-white mb-2">Check your inbox</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-7">
            We sent a confirmation link to your email address. Click it to activate your account.
          </p>
          <Link href="/" className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#f5a623', color: '#0a2a3d' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-serif text-3xl font-bold text-white mb-1">Join paleta</p>
          <p className="text-white/45 text-sm">Create your account</p>
        </div>

        <div style={cardStyle} className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { id: 'naam',       label: 'Full name', type: 'text',     placeholder: 'Jan Janssen',      autoComplete: 'name' },
              { id: 'email',      label: 'Email',     type: 'email',    placeholder: 'you@example.com',  autoComplete: 'email' },
              { id: 'wachtwoord', label: 'Password',  type: 'password', placeholder: '8+ characters',    autoComplete: 'new-password' },
            ].map(field => (
              <div key={field.id}>
                <label htmlFor={field.id}
                  className="block text-xs font-medium uppercase tracking-widest mb-2"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {field.label}
                </label>
                <input
                  id={field.id} name={field.id} type={field.type} required
                  autoComplete={field.autoComplete} placeholder={field.placeholder}
                  className="w-full px-4 py-3 text-sm text-white placeholder-white/25 rounded-xl outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.border = '0.5px solid rgba(245,166,35,0.7)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,166,35,0.10)' }}
                  onBlur={e  => { e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.18)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            ))}

            {/* Level selector */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                Starting level
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LEVELS.map(level => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setNiveau(level.id)}
                    className="py-2.5 px-2 rounded-xl text-center transition-all"
                    style={niveau === level.id ? {
                      background: level.bg,
                      border: `0.5px solid ${level.border}`,
                      color: level.color,
                    } : {
                      background: 'rgba(255,255,255,0.05)',
                      border: '0.5px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.40)',
                    }}
                  >
                    <p className="text-xs font-semibold leading-tight">{level.label}</p>
                  </button>
                ))}
              </div>

              {/* Warning */}
              <div className="mt-3 px-3 py-2.5 rounded-xl text-xs leading-relaxed"
                style={{ background: 'rgba(245,166,35,0.08)', border: '0.5px solid rgba(245,166,35,0.22)', color: 'rgba(255,255,255,0.55)' }}>
                <span style={{ color: '#f5a623', fontWeight: 600 }}>Starting rating: {eloToPlaytomic(selectedLevel.elo)}</span>
                {' — '}{selectedLevel.desc}.{' '}
                You'll be matched and ranked with players of a similar level. Your rating adjusts as you play.
              </div>
            </div>

            {fout && (
              <div className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(232,131,74,0.18)', border: '0.5px solid rgba(232,131,74,0.4)', color: '#f0a070' }}>
                {fout}
              </div>
            )}

            <button
              type="submit" disabled={bezig}
              className="w-full py-3 rounded-xl text-sm font-semibold tracking-wide mt-1 transition-all"
              style={{ background: bezig ? 'rgba(245,166,35,0.5)' : '#f5a623', color: '#0a2a3d', cursor: bezig ? 'not-allowed' : 'pointer' }}>
              {bezig ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 pt-5 text-center text-sm"
            style={{ borderTop: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.38)' }}>
            Already a member?{' '}
            <Link href="/" className="font-medium" style={{ color: '#f5a623' }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
