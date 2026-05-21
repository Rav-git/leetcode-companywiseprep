import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import prisma from '@/lib/prisma'
import { verifyOtpLimiter, getIp } from '@/lib/ratelimit'

const MAX_ATTEMPTS = 5

// Prisma client needs regeneration to include `attempts` — cast until then
type OtpRecord = {
  id: string; email: string; name: string | null; password: string
  code: string; attempts: number; expiresAt: Date; createdAt: Date
}

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
  }) as OtpRecord | null

  if (!record) {
    return NextResponse.json({ error: 'No verification code found. Please sign up again.' }, { status: 404 })
  }

  // Check attempt limit before anything else
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

  if (record.code !== code.trim()) {
    const updated = await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    }) as OtpRecord
    const remaining = MAX_ATTEMPTS - updated.attempts
    return NextResponse.json(
      { error: remaining > 0 ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Invalid code. No attempts remaining.' },
      { status: 400 }
    )
  }

  // OTP valid — create the user
  const user = await prisma.user.create({
    data: {
      email: record.email,
      name: record.name,
      password: record.password,
    },
  })

  // Generate a short-lived one-time sign-in token (no password needed client-side)
  const signInToken = randomBytes(32).toString('hex')
  await prisma.user.update({
    where: { id: user.id },
    data: {
      signInToken,
      signInTokenExpiry: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
  })

  await prisma.otpCode.delete({ where: { id: record.id } })

  return NextResponse.json({ success: true, signInToken, email: record.email })
}
