import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ solvedCount: 0, solvedIds: [], solvedByCompany: {} })
  }

  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  if (company) {
    const solved = await prisma.solvedProblem.findMany({
      where: { userId: session.user.id, company },
      select: { problemId: true },
    })
    const solvedIds = solved.map(s => s.problemId)
    return NextResponse.json({ solvedCount: solvedIds.length, solvedIds })
  }

  const solved = await prisma.solvedProblem.findMany({
    where: { userId: session.user.id },
    select: { company: true },
  })
  const solvedByCompany: Record<string, number> = {}
  for (const s of solved) {
    solvedByCompany[s.company] = (solvedByCompany[s.company] ?? 0) + 1
  }
  return NextResponse.json({ solvedByCompany })
}
