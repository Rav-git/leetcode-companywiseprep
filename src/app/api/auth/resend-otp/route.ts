import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import prisma from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

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

  const { error } = await resend.emails.send({
    from: 'LeetCode Companies <onboarding@resend.dev>',
    to: normalizedEmail,
    subject: `${newCode} is your new verification code`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:440px;margin:40px auto;background:#18181b;border-radius:16px;padding:36px;border:1px solid #27272a;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
              <div style="width:36px;height:36px;background:#FFA116;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#000;font-size:13px;line-height:36px;text-align:center;">LC</div>
              <span style="color:#fff;font-weight:600;font-size:17px;vertical-align:middle;">LeetCode Companies</span>
            </div>
            <h2 style="color:#fff;margin:0 0 8px;font-size:22px;font-weight:700;">New verification code</h2>
            <p style="color:#a1a1aa;margin:0 0 28px;font-size:15px;">Here is your new code:</p>
            <div style="background:#09090b;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;border:1px solid #27272a;">
              <span style="font-size:42px;font-weight:800;letter-spacing:14px;color:#FFA116;font-variant-numeric:tabular-nums;">${newCode}</span>
            </div>
            <p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">
              This code expires in <strong style="color:#a1a1aa;">10 minutes</strong>.
            </p>
          </div>
        </body>
      </html>
    `,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to resend email. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
