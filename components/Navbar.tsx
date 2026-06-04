import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { uitloggen } from '@/app/actions/auth'
import HcToggle from '@/components/HcToggle'
import MobileNav from '@/components/MobileNav'

function PaletaLogo() {
  return (
    <div className="flex items-center gap-1.5 lg:gap-2">
      <svg
        viewBox="-5 -5 75 90" fill="none" xmlns="http://www.w3.org/2000/svg"
        className="mt-1 ml-1 lg:mt-2 lg:ml-2 w-[36px] h-[48px] lg:w-[60px] lg:h-[80px]"
      >
        <rect x="0" y="0" width="38" height="50" rx="19" fill="none" stroke="#f5a623" strokeWidth="3.5"/>
        <line x1="19" y1="50" x2="19" y2="68" stroke="#f5a623" strokeWidth="3.5" strokeLinecap="round"/>
        <circle cx="50" cy="4" r="7" fill="#f5a623"/>
      </svg>
      <div className="leading-tight">
        <div className="flex items-baseline gap-1.5 mb-1 lg:mb-[7px]">
          <p className="text-white font-normal text-[22px] lg:text-[33px] tracking-tight leading-none">paleta</p>
          <span
            className="text-[8px] lg:text-[9px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-[0.14em]"
            style={{ background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.40)', transform: 'translateY(-3px)', display: 'inline-block' }}
          >
            Beta
          </span>
        </div>
        <p className="leading-none">
          <span className="text-[11px] lg:text-[17px] font-bold tracking-[0.12em]" style={{ color: '#f5a623' }}>PADEL</span>
          <span className="text-[11px] lg:text-[17px] font-light" style={{ color: 'rgba(255,255,255,0.40)' }}> · JAVEA</span>
        </p>
      </div>
    </div>
  )
}

function MatchesIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <div className="relative">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" style={{ position: 'absolute', top: '-4px', right: '-5px' }}>
        <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
        <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
        <path d="M4 22h16M10 22V16M14 22V16" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    </div>
  )
}

function TrophyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <path d="M4 22h16" />
      <path d="M10 22V16" />
      <path d="M14 22V16" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}


export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profiel = null
  if (user) {
    const { data } = await supabase.from('profielen').select('naam, is_admin, player_number').eq('id', user.id).single()
    profiel = data
  }

  const { data: settings } = await supabase.from('instellingen').select('matches_enabled').eq('id', 1).single()
  const matchesEnabled = settings?.matches_enabled ?? true

  const initial = profiel?.naam?.[0]?.toUpperCase() ?? '?'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full" style={{ background: 'transparent', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 lg:h-24 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="hover:opacity-90 transition-opacity flex-shrink-0">
          <PaletaLogo />
        </Link>

        {/* Right side: desktop nav + always-visible controls */}
        <div className="flex items-center gap-2 lg:gap-3">

          {/* Desktop nav — hidden on mobile */}
          <div className="hidden lg:flex items-center gap-4">
            {user && profiel ? (
              <>
                <div className="flex items-start gap-4">
                  {matchesEnabled && (
                    <Link href="/wedstrijden" className="flex flex-col items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
                      <MatchesIcon />
                      <span>Matches</span>
                    </Link>
                  )}
                  <Link href="/events" className="flex flex-col items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
                    <CalendarIcon />
                    <span>Events</span>
                  </Link>
                  <Link href="/spelers" className="flex flex-col items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
                    <TrophyIcon />
                    <span>Rankings</span>
                  </Link>
                  <Link href="/info" className="flex flex-col items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
                    <InfoIcon />
                    <span>Info</span>
                  </Link>
                </div>

                {profiel.is_admin && (
                  <Link href="/admin"
                    className="flex flex-col items-center gap-1 text-[11px] font-semibold transition-all hover:opacity-80"
                    style={{ color: '#f5a623' }}>
                    <ShieldIcon />
                    <span>Admin</span>
                  </Link>
                )}

                <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full select-none"
                    style={{ background: 'rgba(245,166,35,0.15)', border: '0.5px solid rgba(245,166,35,0.35)' }}>
                    {profiel.player_number != null && (
                      <span className="text-[11px] font-bold" style={{ color: '#f5a623' }}>
                        {profiel.player_number}
                      </span>
                    )}
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {profiel.naam.split(' ')[0]}
                    </span>
                  </div>
                </Link>

                <div className="w-px h-4 self-center" style={{ background: 'rgba(255,255,255,0.14)' }} />

                <form action={uitloggen}>
                  <button type="submit" className="flex flex-col items-center gap-1 text-sm text-white/35 hover:text-white/70 transition-colors">
                    <LogoutIcon />
                    <span>Sign out</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1.5">Sign in</Link>
                {matchesEnabled && <Link href="/wedstrijden" className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1.5">Matches</Link>}
                <Link href="/events" className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1.5">Events</Link>
                <Link href="/info" className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1.5">Info</Link>
              </>
            )}
          </div>

          {/* Always-visible: high-contrast toggle + mobile hamburger */}
          <HcToggle />
          <MobileNav
            isLoggedIn={!!profiel}
            isAdmin={profiel?.is_admin ?? false}
            initial={initial}
            firstName={profiel?.naam?.split(' ')[0]}
            playerNumber={profiel?.player_number ?? null}
            matchesEnabled={matchesEnabled}
          />
        </div>

      </div>
    </nav>
  )
}
