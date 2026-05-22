import { BRAND, PAGE_BG } from '@/constants/theme'

interface LogoProps {
  // auth pages use 34, Navbar uses 30 — accept size to avoid two separate components
  size?: number
  showText?: boolean
  textSize?: 'sm' | 'lg'
}

// Single source of truth for the brand mark — previously duplicated verbatim in Navbar, signin, signup, and verify
export default function Logo({ size = 34, showText = true, textSize = 'lg' }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <rect width="64" height="64" rx="13" fill={BRAND} />
        <polyline
          points="20,20 12,32 20,44"
          stroke={PAGE_BG}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <polyline
          points="44,20 52,32 44,44"
          stroke={PAGE_BG}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <line x1="37" y1="20" x2="27" y2="44" stroke={PAGE_BG} strokeWidth="5.5" strokeLinecap="round" />
      </svg>
      {showText && (
        <span
          className={`font-semibold text-white tracking-tight ${textSize === 'sm' ? 'text-sm hidden sm:block' : 'text-lg'}`}
        >
          Code Company Wise
        </span>
      )}
    </div>
  )
}
