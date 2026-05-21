import Link from 'next/link'
import { auth, signOut } from '@/lib/auth'

export default async function Navbar() {
  const session = await auth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FFA116] rounded flex items-center justify-center font-bold text-black text-sm">
            LC
          </div>
          <span className="font-semibold text-white hidden sm:block">LeetCode Companies</span>
        </Link>

        <div className="flex items-center gap-2">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white px-3 py-1.5 transition-colors hidden sm:block"
              >
                Dashboard
              </Link>
              <div className="hidden sm:flex items-center gap-2 mr-1">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 text-xs font-semibold">
                  {(session.user.name ?? session.user.email ?? 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-gray-300 text-sm">
                  {session.user.name ?? session.user.email}
                </span>
              </div>
              <form
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/' })
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-sm text-gray-300 hover:text-white px-3 py-1.5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm bg-[#FFA116] hover:bg-[#FFB84D] text-black font-semibold rounded-lg px-4 py-1.5 transition-colors"
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
