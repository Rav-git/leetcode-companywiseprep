import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import prisma from '@/lib/prisma'
import { sendOtpEmail } from '@/lib/mailer'
import { registerLimiter, getIp } from '@/lib/ratelimit'

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
  if (registerLimiter) {
    const { success } = await registerLimiter.limit(getIp(req))
    if (!success) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const body = await req.json()
  const { name, email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const hashedPassword = await hash(password, 12)
  const code = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Delete any existing OTP for this email and create a fresh one
  await prisma.otpCode.deleteMany({ where: { email: normalizedEmail } })
  await prisma.otpCode.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || null,
      password: hashedPassword,
      code,
      expiresAt,
    },
  })

  try {
    await sendOtpEmail(normalizedEmail, code)
  } catch (err) {
    console.error('Mailer error:', err)
    return NextResponse.json({ error: 'Failed to send verification email. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: normalizedEmail })
}
