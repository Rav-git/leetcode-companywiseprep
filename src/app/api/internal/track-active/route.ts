import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  if (req.headers.get('x-internal-secret') !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    })
  } catch (err) {
    console.error('track-active POST error:', err)
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
