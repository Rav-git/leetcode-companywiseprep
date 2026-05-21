'use client'

import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email: email.toLowerCase().trim(),
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 pt-14" style={{ backgroundColor: '#161616' }}>
      <div className="w-full max-w-sm py-12">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <svg width="34" height="34" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="13" fill="#FFA116" />
            <polyline points="20,20 12,32 20,44" stroke="#161616" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <polyline points="44,20 52,32 44,44" stroke="#161616" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <line x1="37" y1="20" x2="27" y2="44" stroke="#161616" strokeWidth="5.5" strokeLinecap="round" />
          </svg>
          <span className="text-white font-semibold text-lg tracking-tight">Code Company Wise</span>
        </div>

        <div className="rounded-2xl p-8" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <h1 className="text-white text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-sm mb-7" style={{ color: 'rgba(235,235,245,0.5)' }}>Sign in to track your progress</p>

          {error && (
            <div className="text-sm rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.25)', color: '#ff6b8a' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(235,235,245,0.7)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg px-4 py-2.5 text-white text-sm transition-all outline-none"
                style={{
                  backgroundColor: '#282828',
                  border: '1px solid #3e3e3e',
                  color: '#fff',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FFA116')}
                onBlur={e => (e.currentTarget.style.borderColor = '#3e3e3e')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(235,235,245,0.7)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg px-4 py-2.5 text-white text-sm transition-all outline-none"
                style={{ backgroundColor: '#282828', border: '1px solid #3e3e3e' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#FFA116')}
                onBlur={e => (e.currentTarget.style.borderColor = '#3e3e3e')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2.5 rounded-lg text-sm transition-colors mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#FFA116', color: '#000' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'rgba(235,235,245,0.4)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="font-medium transition-colors" style={{ color: '#FFA116' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
