import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { problemId, problemSlug, company, difficulty } = body

  if (!problemId || !problemSlug || !company || !difficulty) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

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
      problemSlug,
      company,
      difficulty,
    },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { problemId, company } = body

  await prisma.solvedProblem.deleteMany({
    where: {
      userId: session.user.id,
      problemId: Number(problemId),
      company,
    },
  })

  return NextResponse.json({ success: true })
}
