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
  const { problemId, company } = body

  if (!problemId || !company) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  try {
    await prisma.solvedProblem.upsert({
      where: {
        userId_problemId_company: {
          userId: session.user.id,
          problemId: Number(problemId),
          company,
        },
      },
      update: {},
      create: {
        userId: session.user.id,
        problemId: Number(problemId),
        company,
      },
    })
  } catch (err) {
    console.error('Solve POST error:', err)
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
  const { problemId, company } = body

  try {
    await prisma.solvedProblem.deleteMany({
      where: {
        userId: session.user.id,
        problemId: Number(problemId),
        company,
      },
    })
  } catch (err) {
    console.error('Solve DELETE error:', err)
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
