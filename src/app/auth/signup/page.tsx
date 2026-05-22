'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import FormAlert from '@/components/ui/FormAlert'
import TextInput from '@/components/ui/TextInput'
import { registerUser } from '@/services/auth.service'
import { PAGE_BG, CARD_BG, CARD_BORDER, TEXT_SECONDARY, TEXT_MUTED, BRAND } from '@/constants/theme'

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const result = await registerUser({ name, email, password })

    if (!result.ok) {
      setError(result.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    router.push(`/auth/verify?email=${encodeURIComponent(email.toLowerCase().trim())}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 pt-14" style={{ backgroundColor: PAGE_BG }}>
      <div className="w-full max-w-sm py-12">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <Logo size={34} />
        </div>

        <div className="rounded-2xl p-8" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <h1 className="text-white text-2xl font-bold mb-1">Create account</h1>
          <p className="text-sm mb-7" style={{ color: TEXT_MUTED }}>Start tracking your interview prep</p>

          {error && <FormAlert variant="error" message={error} className="mb-5" />}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: TEXT_SECONDARY }}>
                Full Name
              </label>
              <TextInput
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ravi Singh"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: TEXT_SECONDARY }}>
                Email
              </label>
              <TextInput
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
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: TEXT_SECONDARY }}>
                Confirm Password
              </label>
              <TextInput
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
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
              {loading ? 'Sending code…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'rgba(235,235,245,0.4)' }}>
            Already have an account?{' '}
            <Link href="/auth/signin" className="font-medium" style={{ color: BRAND }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
