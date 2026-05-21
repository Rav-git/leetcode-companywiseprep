'use client'

import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function VerifyPage() {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMsg, setResendMsg] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null))
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...digits]
    newDigits[index] = value.slice(-1)
    setDigits(newDigits)
    setError('')
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits]
        newDigits[index] = ''
        setDigits(newDigits)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newDigits = [...digits]
    pasted.split('').forEach((char, i) => { newDigits[i] = char })
    setDigits(newDigits)
    const nextFocus = Math.min(pasted.length, 5)
    inputRefs.current[nextFocus]?.focus()
  }

  const handleVerify = async () => {
    const code = digits.join('')
    if (code.length < 6) {
      setError('Please enter the complete 6-digit code')
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Verification failed')
      setLoading(false)
      return
    }

    // Auto sign-in using the one-time token returned by the server (no password stored)
    if (data.signInToken) {
      const result = await signIn('credentials', {
        email,
        signInToken: data.signInToken,
        redirect: false,
      })
      if (result?.ok) {
        router.push('/')
        router.refresh()
        return
      }
    }

    router.push('/auth/signin')
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setResendMsg('')
    setError('')

    const res = await fetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (res.ok) {
      setResendMsg('New code sent!')
      setResendCooldown(30)
      setDigits(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to resend. Try again.')
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-[#FFA116] rounded-lg flex items-center justify-center font-bold text-black text-sm">
            LC
          </div>
          <span className="text-white font-semibold text-lg">LeetCode Companies</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {/* Email icon */}
          <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-white text-2xl font-bold mb-1 text-center">Check your email</h1>
          <p className="text-gray-400 text-sm text-center mb-1">
            We sent a 6-digit code to
          </p>
          <p className="text-orange-400 text-sm font-medium text-center mb-7 truncate">
            {email}
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-800/50 text-red-400 text-sm rounded-lg px-4 py-3 mb-5 text-center">
              {error}
            </div>
          )}

          {resendMsg && (
            <div className="bg-green-900/30 border border-green-800/50 text-green-400 text-sm rounded-lg px-4 py-3 mb-5 text-center">
              {resendMsg}
            </div>
          )}

          {/* 6 OTP boxes */}
          <div className="flex gap-2 justify-center mb-6">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className={`w-11 h-12 text-center text-white text-xl font-bold bg-gray-800 rounded-lg border transition-all outline-none
                  ${digit ? 'border-orange-500/70' : 'border-gray-700'}
                  focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20`}
              />
            ))}
          </div>

          <button
            onClick={handleVerify}
            disabled={loading || digits.join('').length < 6}
            className="w-full bg-[#FFA116] hover:bg-[#FFB84D] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>

          <div className="text-center mt-5">
            <p className="text-gray-500 text-sm">
              Didn&apos;t receive the code?{' '}
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-orange-400 hover:text-orange-300 disabled:text-gray-600 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </p>
          </div>

          <div className="text-center mt-3">
            <Link href="/auth/signup" className="text-gray-600 hover:text-gray-400 text-xs transition-colors">
              ← Use a different email
            </Link>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          Code expires in 10 minutes
        </p>
      </div>
    </main>
  )
}
