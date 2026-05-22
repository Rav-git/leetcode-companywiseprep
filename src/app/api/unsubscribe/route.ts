import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const email = searchParams.get('email')
  const token = searchParams.get('token')

  if (!email || !token) {
    return NextResponse.redirect(new URL('/?unsubscribe=invalid', req.nextUrl.origin))
  }

  // Verify HMAC — same signing logic as sendReengagementEmail
  const expected = createHmac('sha256', process.env.AUTH_SECRET ?? '').update(email).digest('hex')
  if (expected !== token) {
    return NextResponse.redirect(new URL('/?unsubscribe=invalid', req.nextUrl.origin))
  }

  await prisma.user.updateMany({
    where: { email: email.toLowerCase() },
    data: { emailOptOut: true },
  })

  return NextResponse.redirect(new URL('/?unsubscribe=success', req.nextUrl.origin))
}
