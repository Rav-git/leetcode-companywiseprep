/**
 * One-time seed script — populates Company, Problem, CompanyProblem from GitHub CSVs.
 * Run once after migration: npm run db:seed
 * Safe to re-run — uses createMany with skipDuplicates.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/snehasishroy/leetcode-companywise-interview-questions/master'
const PERIODS = ['thirty-days', 'three-months', 'six-months', 'more-than-six-months', 'all'] as const
const CONCURRENCY = 15   // parallel GitHub CDN requests
const BATCH_SIZE  = 500  // rows per createMany call

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCompanyName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

interface RawProblem {
  id: number
  titleSlug: string
  title: string
  difficulty: string
  acceptanceRate: number
  frequency: number
}

function parseCSV(text: string): RawProblem[] {
  const lines = text.split('\n').slice(1)
  const results: RawProblem[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(',')
    if (parts.length < 6) continue
    const id = parseInt(parts[0])
    const url = parts[1].trim()
    const frequency = parseFloat(parts[parts.length - 1])
    const acceptance = parseFloat(parts[parts.length - 2])
    const difficulty = parts[parts.length - 3].trim()
    const title = parts.slice(2, parts.length - 3).join(',').trim()
    const titleSlug = url.split('/problems/')[1]?.replace(/\/$/, '') ?? ''
    if (!id || !url || !title || !titleSlug) continue
    results.push({ id, titleSlug, title, difficulty, acceptanceRate: acceptance, frequency })
  }
  return results
}

async function fetchCompanySlugs(): Promise<string[]> {
  console.log('Fetching company list from GitHub...')
  const html = await fetch(
    'https://github.com/snehasishroy/leetcode-companywise-interview-questions'
  ).then(r => r.text())

  const match = html.match(
    /<script type="application\/json" data-target="react-app\.embeddedData">([\s\S]*?)<\/script>/
  )
  if (!match) throw new Error('Could not parse GitHub page — layout may have changed')

  const json = JSON.parse(match[1])
  return (json.payload.codeViewRepoRoute.tree.items as Array<{ name: string; contentType: string }>)
    .filter(i => i.contentType === 'directory' && !i.name.startsWith('src'))
    .map(i => i.name)
}

async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  })
  await Promise.all(workers)
  return results
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  const start = Date.now()
  console.log('\n── Seed started ─────────────────────────────────────────────\n')

  // ── 1. Company slugs ──────────────────────────────────────────────────────
  const slugs = await fetchCompanySlugs()
  console.log(`Found ${slugs.length} companies\n`)

  // ── 2. Upsert companies ───────────────────────────────────────────────────
  for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
    await prisma.company.createMany({
      data: slugs.slice(i, i + BATCH_SIZE).map(slug => ({
        slug,
        name: formatCompanyName(slug),
      })),
      skipDuplicates: true,
    })
  }
  console.log(`✓ ${slugs.length} companies seeded`)

  // ── 3. Load slug → id map ─────────────────────────────────────────────────
  const companyRows = await prisma.company.findMany({ select: { id: true, slug: true } })
  const companyMap  = new Map(companyRows.map(c => [c.slug, c.id]))

  // ── 4. Fetch all CSVs concurrently ────────────────────────────────────────
  const problemMap = new Map<number, Omit<RawProblem, 'frequency'>>()
  const mappingRows: Array<{ companyId: number; problemId: number; period: string; frequency: number }> = []
  let processed = 0

  const tasks = slugs.map(slug => async () => {
    const companyId = companyMap.get(slug)!
    for (const period of PERIODS) {
      try {
        const res = await fetch(`${GITHUB_RAW_BASE}/${slug}/${period}.csv`)
        if (!res.ok) continue
        const problems = parseCSV(await res.text())
        for (const p of problems) {
          if (!problemMap.has(p.id)) {
            problemMap.set(p.id, {
              id: p.id,
              titleSlug: p.titleSlug,
              title: p.title,
              difficulty: p.difficulty,
              acceptanceRate: p.acceptanceRate,
            })
          }
          mappingRows.push({ companyId, problemId: p.id, period, frequency: p.frequency })
        }
      } catch { /* skip failed CSVs — re-run is safe */ }
    }
    processed++
    if (processed % 100 === 0 || processed === slugs.length) {
      process.stdout.write(`\r  Fetched ${processed}/${slugs.length} companies...`)
    }
  })

  await withConcurrency(tasks, CONCURRENCY)
  console.log(`\n✓ ${problemMap.size} unique problems, ${mappingRows.length} total mappings collected`)

  // ── 5. Bulk upsert problems ───────────────────────────────────────────────
  const problemList = Array.from(problemMap.values())
  for (let i = 0; i < problemList.length; i += BATCH_SIZE) {
    await prisma.problem.createMany({
      data: problemList.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    })
  }
  console.log(`✓ ${problemList.length} problems seeded`)

  // ── 6. Deduplicate and bulk insert CompanyProblem ─────────────────────────
  const seen = new Set<string>()
  const dedupedMappings = mappingRows.filter(r => {
    const key = `${r.companyId}:${r.problemId}:${r.period}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  for (let i = 0; i < dedupedMappings.length; i += BATCH_SIZE) {
    await prisma.companyProblem.createMany({
      data: dedupedMappings.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    })
  }
  console.log(`✓ ${dedupedMappings.length} company-problem mappings seeded`)

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n── Seed complete in ${elapsed}s ──────────────────────────────\n`)
  console.log('Next step: run LeetCode sync from /dashboard/sync to repopulate your solved problems.')
}

seed()
  .catch(e => { console.error('\nSeed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
