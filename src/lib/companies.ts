import prisma from './prisma'
import { Company, CompanyWithStats, Problem, TimePeriod } from '@/types'

// All functions read from your own DB — no runtime GitHub dependency.
// GitHub CSVs are only fetched by scripts/seed.ts (once) and /api/cron/refresh-data (weekly).

export async function getCompanyList(): Promise<Company[]> {
  return prisma.company.findMany({
    orderBy: { slug: 'asc' },
    select: { slug: true, name: true },
  })
}

export async function getCompanyProblems(slug: string, period: TimePeriod): Promise<Problem[]> {
  const rows = await prisma.companyProblem.findMany({
    where:   { company: { slug }, period },
    orderBy: { frequency: 'desc' },
    select: {
      frequency: true,
      problem: {
        select: { id: true, titleSlug: true, title: true, difficulty: true, acceptanceRate: true },
      },
    },
  })

  return rows.map(r => ({
    id:         r.problem.id,
    url:        `https://leetcode.com/problems/${r.problem.titleSlug}/`,
    slug:       r.problem.titleSlug,
    title:      r.problem.title,
    difficulty: r.problem.difficulty as Problem['difficulty'],
    acceptance: r.problem.acceptanceRate,
    frequency:  r.frequency,
  }))
}

export async function getCompanyStats(slug: string): Promise<Omit<CompanyWithStats, 'slug' | 'name'>> {
  const FALLBACK: TimePeriod[] = ['all', 'six-months', 'three-months', 'thirty-days', 'more-than-six-months']

  for (const period of FALLBACK) {
    const rows = await prisma.companyProblem.findMany({
      where:  { company: { slug }, period },
      select: { problem: { select: { difficulty: true } } },
    })
    if (rows.length === 0) continue

    return {
      totalCount:  rows.length,
      easyCount:   rows.filter(r => r.problem.difficulty === 'Easy').length,
      mediumCount: rows.filter(r => r.problem.difficulty === 'Medium').length,
      hardCount:   rows.filter(r => r.problem.difficulty === 'Hard').length,
    }
  }

  return { totalCount: 0, easyCount: 0, mediumCount: 0, hardCount: 0 }
}

// ONE query for all 662 companies — replaces the 662-call Promise.all loop on the home page.
// Counts DISTINCT problems per company across all periods so each problem is counted once.
export async function getAllCompaniesWithStats(): Promise<CompanyWithStats[]> {
  const rows = await prisma.$queryRaw<Array<{
    slug:        string
    name:        string
    totalCount:  bigint
    easyCount:   bigint
    mediumCount: bigint
    hardCount:   bigint
  }>>`
    SELECT
      c.slug,
      c.name,
      COUNT(DISTINCT cp."problemId")                                              AS "totalCount",
      COUNT(DISTINCT CASE WHEN p.difficulty = 'Easy'   THEN cp."problemId" END)  AS "easyCount",
      COUNT(DISTINCT CASE WHEN p.difficulty = 'Medium' THEN cp."problemId" END)  AS "mediumCount",
      COUNT(DISTINCT CASE WHEN p.difficulty = 'Hard'   THEN cp."problemId" END)  AS "hardCount"
    FROM "Company" c
    LEFT JOIN "CompanyProblem" cp ON cp."companyId" = c.id
    LEFT JOIN "Problem"        p  ON p.id           = cp."problemId"
    GROUP BY c.id, c.slug, c.name
    ORDER BY c.slug
  `

  return rows.map(r => ({
    slug:        r.slug,
    name:        r.name,
    totalCount:  Number(r.totalCount),
    easyCount:   Number(r.easyCount),
    mediumCount: Number(r.mediumCount),
    hardCount:   Number(r.hardCount),
  }))
}
