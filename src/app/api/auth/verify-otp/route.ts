import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { email, code } = await req.json()

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
  }

  const record = await prisma.otpCode.findFirst({
    where: { email: email.toLowerCase().trim() },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    return NextResponse.json({ error: 'No verification code found. Please sign up again.' }, { status: 404 })
  }

  if (new Date() > record.expiresAt) {
    await prisma.otpCode.delete({ where: { id: record.id } })
    return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 410 })
  }

  if (record.code !== code.trim()) {
    return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
  }

  // OTP valid — create the user
  const user = await prisma.user.create({
    data: {
      email: record.email,
      name: record.name,
      password: record.password,
    },
  })

  // Clean up OTP
  await prisma.otpCode.delete({ where: { id: record.id } })

  return NextResponse.json({ success: true, userId: user.id })
}
