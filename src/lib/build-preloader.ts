import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import path from 'path'
import prisma from './prisma'
import { Problem, TimePeriod } from '@/types'

const CACHE_PATH = path.join(process.cwd(), '.next', 'cache', 'company-preload.json')

// Per-worker in-memory copy — populated on first read, avoids repeated disk I/O
let workerCache: Record<string, Problem[]> | null = null

export async function preloadAllCompanyData(): Promise<void> {
  const rows = await prisma.companyProblem.findMany({
    select: {
      period:    true,
      frequency: true,
      company:   { select: { slug: true } },
      problem:   { select: { id: true, titleSlug: true, title: true, difficulty: true, acceptanceRate: true } },
    },
  })

  const obj: Record<string, Problem[]> = {}

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
    if (!obj[key]) obj[key] = []
    obj[key].push(problem)
  }

  for (const problems of Object.values(obj)) {
    problems.sort((a, b) => b.frequency - a.frequency)
  }

  mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
  writeFileSync(CACHE_PATH, JSON.stringify(obj))
  workerCache = obj
}

function loadCache(): Record<string, Problem[]> | null {
  if (workerCache) return workerCache
  try {
    workerCache = JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
    return workerCache
  } catch {
    return null
  }
}

export function getPreloadedProblems(slug: string, period: TimePeriod): Problem[] | null {
  const cache = loadCache()
  if (!cache) return null
  return cache[`${slug}:${period}`] ?? []
}

export function getPreloadedStats(slug: string): { totalCount: number; easyCount: number; mediumCount: number; hardCount: number } | null {
  const cache = loadCache()
  if (!cache) return null
  const FALLBACK: TimePeriod[] = ['six-months', 'three-months', 'all', 'thirty-days', 'more-than-six-months']
  for (const period of FALLBACK) {
    const problems = cache[`${slug}:${period}`]
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
