import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ solvedCount: 0, solvedIds: [], solvedByCompany: {} })
  }

  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  try {
    if (company) {
      // Problems this user solved that appear in this company's list (any period)
      const solved = await prisma.userSolvedProblem.findMany({
        where: {
          userId,
          problem: { companies: { some: { company: { slug: company } } } },
        },
        select: { problemId: true },
      })
      const solvedIds = solved.map(s => s.problemId)
      return NextResponse.json({ solvedCount: solvedIds.length, solvedIds })
    }

    // All companies — return solved count per company slug in one query
    const rows = await prisma.$queryRaw<Array<{ slug: string; count: bigint }>>`
      SELECT c.slug, COUNT(DISTINCT usp."problemId") AS count
      FROM   "UserSolvedProblem" usp
      JOIN   "CompanyProblem"   cp ON cp."problemId"  = usp."problemId"
      JOIN   "Company"           c  ON c.id            = cp."companyId"
      WHERE  usp."userId" = ${userId}
      GROUP  BY c.slug
    `

    const solvedByCompany: Record<string, number> = {}
    for (const r of rows) solvedByCompany[r.slug] = Number(r.count)
    return NextResponse.json({ solvedByCompany })
  } catch (err) {
    console.error('[user-progress] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
  }
}
