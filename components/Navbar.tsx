import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { uitloggen } from '@/app/actions/auth'
import HcToggle from '@/components/HcToggle'

function PaletaLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="-5 -5 75 90" width="60" height="80" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-2 ml-2">
        <rect x="0" y="0" width="38" height="50" rx="19" fill="none" stroke="#f5a623" strokeWidth="3.5"/>
        <line x1="19" y1="50" x2="19" y2="68" stroke="#f5a623" strokeWidth="3.5" strokeLinecap="round"/>
        <circle cx="50" cy="4" r="7" fill="#f5a623"/>
      </svg>
      <div className="leading-tight">
        <p className="text-white font-normal text-[33px] tracking-tight leading-none mb-[7px]">paleta</p>
        <p className="leading-none">
          <span className="text-[17px] font-bold tracking-[0.12em]" style={{ color: '#f5a623' }}>PADEL</span>
          <span className="text-[17px] font-light" style={{ color: 'rgba(255,255,255,0.40)' }}> · JAVEA</span>
        </p>
      </div>
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

const pill = (bg: string, border: string, color: string, text: string) => (
  <span
    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
    style={{ background: bg, border: `0.5px solid ${border}`, color }}
  >
    {text}
  </span>
)

const linkCls = 'text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1.5'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profiel = null
  if (user) {
    const { data } = await supabase.from('profielen').select('naam, is_admin').eq('id', user.id).single()
    profiel = data
  }

  const initial = profiel?.naam?.[0]?.toUpperCase() ?? '?'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full" style={{ background: 'transparent', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <PaletaLogo />
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-4">
          {user && profiel ? (
            <>
              {/* Text nav links — items-start so all labels sit on the same horizontal line */}
              <div className="flex items-start gap-4">
                <Link href="/wedstrijden" className="flex flex-col items-center gap-0.5 text-sm text-white/60 hover:text-white transition-colors">
                  <span>Matches</span>
                  {pill('rgba(255,255,255,0.09)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.45)', 'Casual')}
                </Link>

                <Link href="/events" className="flex flex-col items-center gap-0.5 text-sm text-white/60 hover:text-white transition-colors">
                  <span>Events</span>
                  {pill('rgba(245,166,35,0.14)', 'rgba(245,166,35,0.32)', '#f5a623', 'Ranked')}
                </Link>

                <Link href="/spelers" className="flex flex-col items-center gap-0.5 text-sm text-white/60 hover:text-white transition-colors">
                  <span>Rankings</span>
                  <TrophyIcon />
                </Link>

                <Link href="/info" className="flex flex-col items-center gap-0.5 text-sm text-white/60 hover:text-white transition-colors">
                  <span>Info</span>
                </Link>
              </div>

              {profiel.is_admin && (
                <Link
                  href="/admin"
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                  style={{ background: 'rgba(245,166,35,0.18)', border: '0.5px solid rgba(245,166,35,0.40)', color: '#f5a623' }}
                >
                  Admin
                </Link>
              )}

              {/* User initial circle */}
              <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold select-none"
                  style={{ background: 'rgba(245,166,35,0.15)', border: '0.5px solid rgba(245,166,35,0.35)', color: '#f5a623' }}
                >
                  {initial}
                </div>
              </Link>

              {/* Divider */}
              <div className="w-px h-4 self-center" style={{ background: 'rgba(255,255,255,0.14)' }} />

              <form action={uitloggen}>
                <button type="submit" className="text-sm text-white/35 hover:text-white/70 transition-colors">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/" className={linkCls}>Sign in</Link>
              <Link href="/wedstrijden" className={linkCls}>Matches</Link>
              <Link href="/events" className={linkCls}>Events</Link>
              <Link href="/info" className={linkCls}>Info</Link>
            </>
          )}
          <HcToggle />
        </div>

      </div>
    </nav>
  )
}
