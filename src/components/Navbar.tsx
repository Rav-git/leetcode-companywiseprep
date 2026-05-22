'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b" style={{ backgroundColor: '#1a1a1a', borderBottomColor: '#2a2a2a' }}>
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <rect width="64" height="64" rx="13" fill="#FFA116" />
            <polyline points="20,20 12,32 20,44" stroke="#161616" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <polyline points="44,20 52,32 44,44" stroke="#161616" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <line x1="37" y1="20" x2="27" y2="44" stroke="#161616" strokeWidth="5.5" strokeLinecap="round" />
          </svg>
          <span className="font-semibold text-white hidden sm:block text-sm tracking-tight">Code Company Wise</span>
        </Link>

        <div className="flex items-center gap-1">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm px-3 py-1.5 rounded-lg transition-colors hidden sm:block text-[rgba(235,235,245,0.6)] hover:text-white"
              >
                Dashboard
              </Link>
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg mr-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: 'rgba(255,161,22,0.12)', border: '1.5px solid rgba(255,161,22,0.3)', color: '#FFA116' }}
                >
                  {(session.user.name ?? session.user.email ?? 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-[rgba(235,235,245,0.8)]">
                  {session.user.name?.split(' ')[0] ?? session.user.email}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm rounded-lg px-3 py-1.5 transition-colors text-[rgba(235,235,245,0.6)] hover:text-white border border-[#3e3e3e] hover:border-[#555]"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-sm px-3 py-1.5 rounded-lg transition-colors text-[rgba(235,235,245,0.6)] hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm font-semibold rounded-lg px-4 py-1.5 transition-colors ml-1 hover:opacity-90"
                style={{ backgroundColor: '#FFA116', color: '#000' }}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
