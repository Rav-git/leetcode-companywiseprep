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

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

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
          {/* Email icon */}
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(255,161,22,0.1)', border: '1.5px solid rgba(255,161,22,0.25)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#FFA116">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-white text-2xl font-bold mb-1 text-center">Check your email</h1>
          <p className="text-sm text-center mb-1" style={{ color: 'rgba(235,235,245,0.5)' }}>
            We sent a 6-digit code to
          </p>
          <p className="text-sm font-medium text-center mb-7 truncate" style={{ color: '#FFA116' }}>
            {email}
          </p>

          {error && (
            <div className="text-sm rounded-xl px-4 py-3 mb-5 text-center" style={{ backgroundColor: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.25)', color: '#ff6b8a' }}>
              {error}
            </div>
          )}

          {resendMsg && (
            <div className="text-sm rounded-xl px-4 py-3 mb-5 text-center" style={{ backgroundColor: 'rgba(0,184,163,0.08)', border: '1px solid rgba(0,184,163,0.25)', color: '#00B8A3' }}>
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
                className="w-11 h-12 text-center text-white text-xl font-bold rounded-lg outline-none transition-all"
                style={{
                  backgroundColor: '#282828',
                  border: digit ? '1.5px solid #FFA116' : '1px solid #3e3e3e',
                  boxShadow: digit ? '0 0 0 3px rgba(255,161,22,0.1)' : 'none',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#FFA116'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,161,22,0.1)'
                }}
                onBlur={e => {
                  if (!digit) {
                    e.currentTarget.style.borderColor = '#3e3e3e'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              />
            ))}
          </div>

          <button
            onClick={handleVerify}
            disabled={loading || digits.join('').length < 6}
            className="w-full font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#FFA116', color: '#000' }}
          >
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>

          <div className="text-center mt-5">
            <p className="text-sm" style={{ color: 'rgba(235,235,245,0.4)' }}>
              Didn&apos;t receive the code?{' '}
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="font-medium transition-colors disabled:cursor-not-allowed"
                style={{ color: resendCooldown > 0 ? 'rgba(235,235,245,0.2)' : '#FFA116' }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </p>
          </div>

          <div className="text-center mt-3">
            <Link href="/auth/signup" className="text-xs transition-colors" style={{ color: 'rgba(235,235,245,0.3)' }}>
              ← Use a different email
            </Link>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'rgba(235,235,245,0.25)' }}>
          Code expires in 10 minutes
        </p>
      </div>
    </main>
  )
}
