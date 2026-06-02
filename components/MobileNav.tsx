'use client'

import { useState } from 'react'
import Link from 'next/link'
import { uitloggen } from '@/app/actions/auth'

interface Props {
  isLoggedIn: boolean
  isAdmin: boolean
  initial: string
  firstName?: string
  playerNumber?: number | null
}

export default function MobileNav({ isLoggedIn, isAdmin, initial, firstName, playerNumber }: Props) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
        style={{ color: 'rgba(255,255,255,0.70)', background: open ? 'rgba(255,255,255,0.08)' : 'transparent' }}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        )}
      </button>

      {open && (
        <>
          <div
            className="lg:hidden fixed inset-x-0 bottom-0 z-40"
            style={{ top: '64px', background: 'rgba(0,0,0,0.30)' }}
            onClick={close}
          />
          <div
            className="lg:hidden fixed inset-x-0 z-50"
            style={{
              top: '64px',
              background: 'rgba(5,16,28,0.97)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderBottom: '0.5px solid rgba(255,255,255,0.12)',
            }}
          >
            {isLoggedIn ? (
              <nav className="px-4 py-3">
                <Link href="/dashboard" onClick={close}
                  className="flex items-center gap-3 px-3 py-3.5 rounded-xl transition-colors hover:bg-white/5 mb-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full select-none"
                    style={{ background: 'rgba(245,166,35,0.15)', border: '0.5px solid rgba(245,166,35,0.35)' }}>
                    {playerNumber != null && (
                      <span className="text-xs font-bold" style={{ color: '#f5a623' }}>
                        {playerNumber}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {firstName ?? initial}
                    </span>
                  </div>
                </Link>

                <div className="my-1 mx-3" style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)' }} />

                {[
                  { href: '/wedstrijden', label: 'Matches' },
                  { href: '/events', label: 'Events' },
                  { href: '/spelers', label: 'Rankings' },
                  { href: '/info', label: 'Info' },
                ].map(item => (
                  <Link key={item.href} href={item.href} onClick={close}
                    className="flex items-center px-3 py-3.5 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors text-base font-medium">
                    {item.label}
                  </Link>
                ))}

                {isAdmin && (
                  <Link href="/admin" onClick={close}
                    className="flex items-center px-3 py-3.5 rounded-xl text-base font-semibold transition-colors hover:bg-white/5"
                    style={{ color: '#f5a623' }}>
                    Admin
                  </Link>
                )}

                <div className="my-1 mx-3" style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)' }} />

                <form action={uitloggen}>
                  <button type="submit"
                    className="flex items-center w-full px-3 py-3.5 rounded-xl text-white/35 hover:text-white/60 transition-colors text-base">
                    Sign out
                  </button>
                </form>
              </nav>
            ) : (
              <nav className="px-4 py-3">
                {[
                  { href: '/', label: 'Sign in' },
                  { href: '/wedstrijden', label: 'Matches' },
                  { href: '/events', label: 'Events' },
                  { href: '/info', label: 'Info' },
                ].map(item => (
                  <Link key={item.href} href={item.href} onClick={close}
                    className="flex items-center px-3 py-3.5 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors text-base font-medium">
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </>
      )}
    </>
  )
}
