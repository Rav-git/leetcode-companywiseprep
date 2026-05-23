import prisma from './prisma'
import { Problem, TimePeriod } from '@/types'

// Module-level Map — lives for the lifetime of the Node.js build process.
// Populated ONCE in generateStaticParams, read by every company page render.
// Result: 1 big DB query instead of 662 × 6 = 3,972 individual queries at build time.

let cache: Map<string, Problem[]> | null = null  // key: `${slug}:${period}`

export async function preloadAllCompanyData(): Promise<void> {
  if (cache) return  // already loaded — generateStaticParams may be called multiple times

  const rows = await prisma.companyProblem.findMany({
    select: {
      period:    true,
      frequency: true,
      company:   { select: { slug: true } },
      problem:   { select: { id: true, titleSlug: true, title: true, difficulty: true, acceptanceRate: true } },
    },
  })

  const map = new Map<string, Problem[]>()

  for (const r of rows) {
    const key = `${r.company.slug}:${r.period}`
    const problem: Problem = {
      id:         r.problem.id,
      url:        `https://leetcode.com/problems/${r.problem.titleSlug}/`,
      slug:       r.problem.titleSlug,
      title:      r.problem.title,
      difficulty: r.problem.difficulty as Problem['difficulty'],
      acceptance: r.problem.acceptanceRate,
      frequency:  r.frequency,
    }
    const existing = map.get(key)
    if (existing) existing.push(problem)
    else map.set(key, [problem])
  }

  // Sort each list by frequency desc (mirrors DB ORDER BY)
  Array.from(map.values()).forEach(problems => problems.sort((a, b) => b.frequency - a.frequency))

  cache = map
}

export function getPreloadedProblems(slug: string, period: TimePeriod): Problem[] | null {
  return cache?.get(`${slug}:${period}`) ?? null
}

export function getPreloadedStats(slug: string): { totalCount: number; easyCount: number; mediumCount: number; hardCount: number } | null {
  if (!cache) return null

  const FALLBACK: TimePeriod[] = ['all', 'six-months', 'three-months', 'thirty-days', 'more-than-six-months']
  for (const period of FALLBACK) {
    const problems = cache.get(`${slug}:${period}`)
    if (!problems?.length) continue
    return {
      totalCount:  problems.length,
      easyCount:   problems.filter(p => p.difficulty === 'Easy').length,
      mediumCount: problems.filter(p => p.difficulty === 'Medium').length,
      hardCount:   problems.filter(p => p.difficulty === 'Hard').length,
    }
  }
  return { totalCount: 0, easyCount: 0, mediumCount: 0, hardCount: 0 }
}
