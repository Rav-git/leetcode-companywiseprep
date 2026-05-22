import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|icon|apple-icon).*)'],
}

export default auth(async (req) => {
  const session = req.auth
  if (!session?.user?.id) return NextResponse.next()

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const lastTracked = req.cookies.get('_lat')?.value
  if (lastTracked === today) return NextResponse.next()

  // Fire-and-forget — does not block the page response
  fetch(`${req.nextUrl.origin}/api/internal/track-active`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_SECRET ?? '',
    },
    body: JSON.stringify({ userId: session.user.id }),
  }).catch(() => {})

  const res = NextResponse.next()
  res.cookies.set('_lat', today, { maxAge: 86400, httpOnly: true, sameSite: 'lax', path: '/' })
  return res
})
