'use client'

import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import FormAlert from '@/components/ui/FormAlert'
import TextInput from '@/components/ui/TextInput'
import { PAGE_BG, CARD_BG, CARD_BORDER, TEXT_SECONDARY, TEXT_MUTED, BRAND } from '@/constants/theme'

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
    <main className="min-h-screen flex items-center justify-center px-4 pt-14" style={{ backgroundColor: PAGE_BG }}>
      <div className="w-full max-w-sm py-12">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <Logo size={34} />
        </div>

        <div className="rounded-2xl p-8" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <h1 className="text-white text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-sm mb-7" style={{ color: TEXT_MUTED }}>Sign in to track your progress</p>

          {error && <FormAlert variant="error" message={error} className="mb-5" />}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: TEXT_SECONDARY }}>
                Email
              </label>
              <TextInput
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: TEXT_SECONDARY }}>
                Password
              </label>
              <TextInput
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2.5 rounded-lg text-sm transition-colors mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: BRAND, color: '#000' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'rgba(235,235,245,0.4)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="font-medium transition-colors" style={{ color: BRAND }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
