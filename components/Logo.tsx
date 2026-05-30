interface LogoProps {
  className?: string
  iconSize?: number
  showText?: boolean
  textSize?: string
}

export default function Logo({
  className = '',
  iconSize = 28,
  showText = true,
  textSize = 'text-xl',
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={iconSize}
        height={Math.round(iconSize * 1.36)}
        viewBox="0 0 22 30"
        fill="none"
        aria-hidden="true"
      >
        {/* Racket head */}
        <circle
          cx="11" cy="11" r="10"
          stroke="currentColor" strokeWidth="1.6" fill="none"
        />
        {/* String grid – horizontal */}
        <line x1="3.2" y1="8"  x2="18.8" y2="8"  stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.55" />
        <line x1="1.5" y1="11" x2="20.5" y2="11" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.55" />
        <line x1="3.2" y1="14" x2="18.8" y2="14" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.55" />
        {/* String grid – vertical */}
        <line x1="8"  y1="2"  x2="8"  y2="20" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.55" />
        <line x1="11" y1="1"  x2="11" y2="21" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.55" />
        <line x1="14" y1="2"  x2="14" y2="20" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.55" />
        {/* Throat */}
        <path d="M8 21 L14 21 L13 24 L9 24 Z" fill="currentColor" />
        {/* Handle */}
        <rect x="9" y="24" width="4" height="5.5" rx="1.8" fill="currentColor" />
      </svg>

      {showText && (
        <span className={`font-semibold tracking-wide ${textSize}`}>
          Padel<span className="text-terra-500"> Javea</span>
        </span>
      )}
    </div>
  )
}
