import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { solveLimiter } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (solveLimiter) {
    const { success } = await solveLimiter.limit(session.user.id)
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 })
  }

  const body = await req.json()
  const problemId = Number(body.problemId)
  if (!problemId) {
    return NextResponse.json({ error: 'Missing problemId' }, { status: 400 })
  }

  try {
    await prisma.userSolvedProblem.upsert({
      where:  { userId_problemId: { userId: session.user.id, problemId } },
      update: {},
      create: { userId: session.user.id, problemId },
    })
  } catch (err) {
    console.error('[solve] POST error:', err)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (solveLimiter) {
    const { success } = await solveLimiter.limit(session.user.id)
    if (!success) return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 })
  }

  const body = await req.json()
  const problemId = Number(body.problemId)

  try {
    await prisma.userSolvedProblem.delete({
      where: { userId_problemId: { userId: session.user.id, problemId } },
    })
  } catch (err) {
    console.error('[solve] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
