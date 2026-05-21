import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { Resend } from 'resend'
import prisma from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
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

  const { error } = await resend.emails.send({
    from: 'LeetCode Companies <onboarding@resend.dev>',
    to: normalizedEmail,
    subject: `${code} is your verification code`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:440px;margin:40px auto;background:#18181b;border-radius:16px;padding:36px;border:1px solid #27272a;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
              <div style="width:36px;height:36px;background:#FFA116;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#000;font-size:13px;line-height:36px;text-align:center;">LC</div>
              <span style="color:#fff;font-weight:600;font-size:17px;vertical-align:middle;">LeetCode Companies</span>
            </div>
            <h2 style="color:#fff;margin:0 0 8px;font-size:22px;font-weight:700;">Verify your email</h2>
            <p style="color:#a1a1aa;margin:0 0 28px;font-size:15px;">Enter this code to complete your sign up:</p>
            <div style="background:#09090b;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;border:1px solid #27272a;">
              <span style="font-size:42px;font-weight:800;letter-spacing:14px;color:#FFA116;font-variant-numeric:tabular-nums;">${code}</span>
            </div>
            <p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">
              This code expires in <strong style="color:#a1a1aa;">10 minutes</strong>.<br/>
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'Failed to send verification email. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: normalizedEmail })
}
