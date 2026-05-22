import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import prisma from '@/lib/prisma'
import { sendOtpEmail } from '@/lib/mailer'
import { resendOtpLimiter } from '@/lib/ratelimit'

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()

  if (resendOtpLimiter) {
    const { success } = await resendOtpLimiter.limit(normalizedEmail)
    if (!success) return NextResponse.json({ error: 'Too many resend requests. Wait a few minutes.' }, { status: 429 })
  }

  // Verify the unverified user exists before resending
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user || user.emailVerified) {
    return NextResponse.json({ error: 'No pending registration found. Please sign up again.' }, { status: 404 })
  }

  const newCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.otpCode.deleteMany({ where: { email: normalizedEmail } })
  await prisma.otpCode.create({
    data: { email: normalizedEmail, codeHash: hashOtp(newCode), expiresAt },
  })

  try {
    await sendOtpEmail(normalizedEmail, newCode, true)
  } catch (err) {
    console.error('Mailer error:', err)
    return NextResponse.json({ error: 'Failed to resend email. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
