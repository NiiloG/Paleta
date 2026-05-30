'use client'

import { useHc } from '@/lib/hc-context'

export default function HcToggle() {
  const { hc, toggle } = useHc()

  return (
    <button
      onClick={toggle}
      aria-label={hc ? 'Switch to dark mode' : 'Switch to high contrast mode'}
      className="flex items-center justify-center w-8 h-8 rounded-full transition-all hover:opacity-80"
      style={{
        background: hc ? '#f5a623' : 'rgba(255,255,255,0.10)',
        border: `0.5px solid ${hc ? 'rgba(245,166,35,0.80)' : 'rgba(255,255,255,0.22)'}`,
      }}
    >
      {/* Sun icon */}
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke={hc ? '#0a1828' : '#f5a623'}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    </button>
  )
}
