import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import prisma from '@/lib/prisma'
import { verifyOtpLimiter, getIp } from '@/lib/ratelimit'
import { hashOtp } from '@/lib/otp'

const MAX_ATTEMPTS = 5

export async function POST(req: NextRequest) {
  if (verifyOtpLimiter) {
    const { success } = await verifyOtpLimiter.limit(getIp(req))
    if (!success) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { email, code } = await req.json()

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  const record = await prisma.otpCode.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    return NextResponse.json({ error: 'No verification code found. Please sign up again.' }, { status: 404 })
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.delete({ where: { id: record.id } })
    return NextResponse.json(
      { error: 'Too many failed attempts. Go back and sign up again to get a new code.' },
      { status: 429 }
    )
  }

  if (new Date() > record.expiresAt) {
    await prisma.otpCode.delete({ where: { id: record.id } })
    return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 410 })
  }

  if (record.codeHash !== hashOtp(code.trim())) {
    const updated = await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    })
    const remaining = MAX_ATTEMPTS - updated.attempts
    return NextResponse.json(
      { error: remaining > 0 ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Invalid code. No attempts remaining.' },
      { status: 400 }
    )
  }

  // OTP valid — mark the pending user as verified
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user) {
    return NextResponse.json({ error: 'Account not found. Please sign up again.' }, { status: 404 })
  }

  const signInToken = randomBytes(32).toString('hex')

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      signInToken,
      signInTokenExpiry: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  await prisma.otpCode.delete({ where: { id: record.id } })

  return NextResponse.json({ success: true, signInToken, email: normalizedEmail })
}
