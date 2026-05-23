import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Weekly refresh — upserts new companies and problems from GitHub CSVs.
// Runs every Sunday midnight UTC (see vercel.json).
// Incremental: skipDuplicates means it's safe to re-run at any time.

const prisma = new PrismaClient()

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/snehasishroy/leetcode-companywise-interview-questions/master'
const PERIODS = ['thirty-days', 'three-months', 'six-months', 'more-than-six-months', 'all'] as const
const CONCURRENCY  = 15
const BATCH_SIZE   = 500

function formatCompanyName(slug: string): string {
  return slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

interface RawProblem {
  id: number; titleSlug: string; title: string
  difficulty: string; acceptanceRate: number; frequency: number
}

function parseCSV(text: string): RawProblem[] {
  const results: RawProblem[] = []
  for (const raw of text.split('\n').slice(1)) {
    const line  = raw.trim()
    if (!line) continue
    const parts = line.split(',')
    if (parts.length < 6) continue
    const id         = parseInt(parts[0])
    const url        = parts[1].trim()
    const frequency  = parseFloat(parts[parts.length - 1])
    const acceptance = parseFloat(parts[parts.length - 2])
    const difficulty = parts[parts.length - 3].trim()
    const title      = parts.slice(2, parts.length - 3).join(',').trim()
    const titleSlug  = url.split('/problems/')[1]?.replace(/\/$/, '') ?? ''
    if (!id || !url || !title || !titleSlug) continue
    results.push({ id, titleSlug, title, difficulty, acceptanceRate: acceptance, frequency })
  }
  return results
}

async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) { const i = next++; results[i] = await tasks[i]() }
  })
  await Promise.all(workers)
  return results
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    // 1. Fetch company slugs from GitHub
    const html  = await fetch('https://github.com/snehasishroy/leetcode-companywise-interview-questions').then(r => r.text())
    const match = html.match(/<script type="application\/json" data-target="react-app\.embeddedData">([\s\S]*?)<\/script>/)
    if (!match) throw new Error('Could not parse GitHub page')

    const slugs: string[] = JSON.parse(match[1])
      .payload.codeViewRepoRoute.tree.items
      .filter((i: { name: string; contentType: string }) => i.contentType === 'directory' && !i.name.startsWith('src'))
      .map((i: { name: string }) => i.name)

    // 2. Upsert companies
    for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
      await prisma.company.createMany({
        data: slugs.slice(i, i + BATCH_SIZE).map(slug => ({ slug, name: formatCompanyName(slug) })),
        skipDuplicates: true,
      })
    }

    const companyRows = await prisma.company.findMany({ select: { id: true, slug: true } })
    const companyMap  = new Map(companyRows.map(c => [c.slug, c.id]))

    // 3. Fetch CSVs and collect problems + mappings
    const problemMap  = new Map<number, Omit<RawProblem, 'frequency'>>()
    const mappingRows: Array<{ companyId: number; problemId: number; period: string; frequency: number }> = []

    const tasks = slugs.map(slug => async () => {
      const companyId = companyMap.get(slug)!
      for (const period of PERIODS) {
        try {
          const res = await fetch(`${GITHUB_RAW_BASE}/${slug}/${period}.csv`)
          if (!res.ok) continue
          for (const p of parseCSV(await res.text())) {
            if (!problemMap.has(p.id)) {
              problemMap.set(p.id, { id: p.id, titleSlug: p.titleSlug, title: p.title, difficulty: p.difficulty, acceptanceRate: p.acceptanceRate })
            }
            mappingRows.push({ companyId, problemId: p.id, period, frequency: p.frequency })
          }
        } catch { /* skip */ }
      }
    })

    await withConcurrency(tasks, CONCURRENCY)

    // 4. Upsert problems
    const problemList = Array.from(problemMap.values())
    for (let i = 0; i < problemList.length; i += BATCH_SIZE) {
      await prisma.problem.createMany({ data: problemList.slice(i, i + BATCH_SIZE), skipDuplicates: true })
    }

    // 5. Upsert mappings (deduplicated)
    const seen = new Set<string>()
    const deduped = mappingRows.filter(r => {
      const key = `${r.companyId}:${r.problemId}:${r.period}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      await prisma.companyProblem.createMany({ data: deduped.slice(i, i + BATCH_SIZE), skipDuplicates: true })
    }

    const durationMs = Date.now() - start
    console.log(`[cron/refresh-data] companies=${slugs.length} problems=${problemList.length} mappings=${deduped.length} duration=${durationMs}ms`)

    return NextResponse.json({
      companies: slugs.length,
      problems:  problemList.length,
      mappings:  deduped.length,
      durationMs,
    })
  } catch (err) {
    console.error('[cron/refresh-data] failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
