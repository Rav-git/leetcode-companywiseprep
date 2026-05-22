// Central module for auth API calls — keeps fetch logic out of auth page components

export async function registerUser(payload: {
  name: string
  email: string
  password: string
}): Promise<{ ok: boolean; error?: string; email?: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return res.ok ? { ok: true, email: data.email } : { ok: false, error: data.error }
}

export async function verifyOtp(payload: {
  email: string
  code: string
}): Promise<{ ok: boolean; signInToken?: string; error?: string }> {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  return res.ok ? { ok: true, signInToken: data.signInToken } : { ok: false, error: data.error }
}

export async function resendOtp(email: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/auth/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await res.json()
  return res.ok ? { ok: true } : { ok: false, error: data.error }
}
