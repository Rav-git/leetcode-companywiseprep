import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendOtpEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()

  const record = await prisma.otpCode.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    return NextResponse.json({ error: 'No pending registration found. Please sign up again.' }, { status: 404 })
  }

  const newCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { code: newCode, expiresAt, createdAt: new Date() },
  })

  try {
    await sendOtpEmail(normalizedEmail, newCode, true)
  } catch (err) {
    console.error('Mailer error:', err)
    return NextResponse.json({ error: 'Failed to resend email. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
