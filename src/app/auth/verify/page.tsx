'use client'

import { useState, useRef, useEffect, Suspense, type KeyboardEvent, type ClipboardEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/layout/Logo'
import FormAlert from '@/components/ui/FormAlert'
import { verifyOtp, resendOtp } from '@/services/auth.service'
import { PAGE_BG, CARD_BG, CARD_BORDER, BRAND, INPUT_BG, INPUT_BORDER } from '@/constants/theme'

function VerifyContent() {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // cooldownTimer: seconds remaining before the user can request another OTP — prevents email flooding
  const [cooldownTimer, setCooldownTimer] = useState(0)
  // resendStatusMessage: success feedback shown after a resend — separate from error so both can coexist
  const [resendStatusMessage, setResendStatusMessage] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null))
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (cooldownTimer <= 0) return
    // Decrement once per second — setTimeout instead of setInterval avoids drift
    const cooldownTick = setTimeout(() => setCooldownTimer(c => c - 1), 1000)
    return () => clearTimeout(cooldownTick)
  }, [cooldownTimer])

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

    const result = await verifyOtp({ email, code })

    if (!result.ok) {
      setError(result.error ?? 'Verification failed')
      setLoading(false)
      return
    }

    if (result.signInToken) {
      const signInResult = await signIn('credentials', {
        email,
        signInToken: result.signInToken,
        redirect: false,
      })
      if (signInResult?.ok) {
        router.push('/')
        router.refresh()
        return
      }
    }

    router.push('/auth/signin')
  }

  const handleResend = async () => {
    if (cooldownTimer > 0) return
    setResendStatusMessage('')
    setError('')

    const result = await resendOtp(email)

    if (result.ok) {
      setResendStatusMessage('New code sent!')
      setCooldownTimer(30)
      setDigits(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    } else {
      setError(result.error ?? 'Failed to resend. Try again.')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 pt-14" style={{ backgroundColor: PAGE_BG }}>
      <div className="w-full max-w-sm py-12">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <Logo size={34} />
        </div>

        <div className="rounded-2xl p-8" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          {/* Email icon */}
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(255,161,22,0.1)', border: '1.5px solid rgba(255,161,22,0.25)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={BRAND}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-white text-2xl font-bold mb-1 text-center">Check your email</h1>
          <p className="text-sm text-center mb-1" style={{ color: 'rgba(235,235,245,0.5)' }}>
            We sent a 6-digit code to
          </p>
          <p className="text-sm font-medium text-center mb-7 truncate" style={{ color: BRAND }}>
            {email}
          </p>

          {error && <FormAlert variant="error" message={error} centered className="mb-5" />}
          {resendStatusMessage && <FormAlert variant="success" message={resendStatusMessage} centered className="mb-5" />}

          {/* 6 OTP digit boxes — individual inputs for better mobile UX than a single field */}
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
                  backgroundColor: INPUT_BG,
                  border: digit ? `1.5px solid ${BRAND}` : `1px solid ${INPUT_BORDER}`,
                  boxShadow: digit ? '0 0 0 3px rgba(255,161,22,0.1)' : 'none',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = BRAND
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,161,22,0.1)'
                }}
                onBlur={e => {
                  if (!digit) {
                    e.currentTarget.style.borderColor = INPUT_BORDER
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
            style={{ backgroundColor: BRAND, color: '#000' }}
          >
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>

          <div className="text-center mt-5">
            <p className="text-sm" style={{ color: 'rgba(235,235,245,0.4)' }}>
              Didn&apos;t receive the code?{' '}
              <button
                onClick={handleResend}
                disabled={cooldownTimer > 0}
                className="font-medium transition-colors disabled:cursor-not-allowed"
                style={{ color: cooldownTimer > 0 ? 'rgba(235,235,245,0.2)' : BRAND }}
              >
                {cooldownTimer > 0 ? `Resend in ${cooldownTimer}s` : 'Resend code'}
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

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  )
}
