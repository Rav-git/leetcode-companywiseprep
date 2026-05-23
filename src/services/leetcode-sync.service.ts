import { fetchAllSolvedWithSession, SessionSolvedProblem } from '@/lib/leetcode'
import prisma from '@/lib/prisma'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UnmatchedProblem {
  frontendQuestionId: string
  title:              string
  titleSlug:          string
  difficulty:         string
}

export interface SyncResult {
  totalFetched:       number           // problems returned by LeetCode API
  companiesIndexed:   number           // total companies in DB
  matchedInCompanies: number           // solved problems found in ≥1 company
  notInAnyCompany:    UnmatchedProblem[]   // solved problems not in any company list
  newlyMarked:        number           // new UserSolvedProblem rows inserted
  alreadySolved:      number           // problems already recorded
  companiesAffected:  number           // unique companies with ≥1 of user's solved problems
  durationMs:         number
}

// ─── Main sync ───────────────────────────────────────────────────────────────

const DB_BATCH_SIZE = 500

export async function syncLeetCodeToDb(
  userId:  string,
  session: string
): Promise<SyncResult> {
  const startMs = Date.now()

  // ── 1. Fetch LeetCode solved list ─────────────────────────────────────────
  let leetcodeSolved: SessionSolvedProblem[]
  try {
    const result = await fetchAllSolvedWithSession(session)
    leetcodeSolved   = result.problems
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.toLowerCase().includes('not found') || msg.includes('401') || msg.includes('private')) {
      throw new Error('LeetCode session expired or invalid — re-copy your LEETCODE_SESSION cookie.')
    }
    throw err
  }

  if (leetcodeSolved.length === 0) {
    throw new Error('No solved problems returned. Session may be expired.')
  }

  const solvedSlugs = leetcodeSolved.map(p => p.titleSlug)

  // ── 2. Cross-reference against DB in one query ────────────────────────────
  // Replaces the old buildIndex() which fetched 662 GitHub CSVs on every sync.
  // Now a single DB lookup — instant after seeding.
  const matchedProblems = await prisma.problem.findMany({
    where:  { titleSlug: { in: solvedSlugs } },
    select: { id: true, titleSlug: true },
  })
  const matchedSlugSet = new Set(matchedProblems.map(p => p.titleSlug))
  const matchedIds     = matchedProblems.map(p => p.id)

  const notInAnyCompany: UnmatchedProblem[] = leetcodeSolved
    .filter(p => !matchedSlugSet.has(p.titleSlug))
    .map(p => ({
      frontendQuestionId: p.frontendQuestionId,
      title:              p.title,
      titleSlug:          p.titleSlug,
      difficulty:         p.difficulty,
    }))

  // ── 3. Diff against existing DB rows ──────────────────────────────────────
  const existingRows = await prisma.userSolvedProblem.findMany({
    where:  { userId },
    select: { problemId: true },
  })
  const existingIds   = new Set(existingRows.map((r: { problemId: number }) => r.problemId))
  const newProblemIds = matchedIds.filter((id: number) => !existingIds.has(id))
  const alreadySolved = matchedIds.length - newProblemIds.length

  // ── 4. Batch insert new rows ───────────────────────────────────────────────
  const now = new Date()
  let newlyMarked = 0

  for (let i = 0; i < newProblemIds.length; i += DB_BATCH_SIZE) {
    const { count } = await prisma.userSolvedProblem.createMany({
      data: newProblemIds.slice(i, i + DB_BATCH_SIZE).map((problemId: number) => ({
        userId,
        problemId,
        solvedAt: now,
      })),
      skipDuplicates: true,
    })
    newlyMarked += count
  }

  // ── 5. Summary stats ───────────────────────────────────────────────────────
  const [companiesIndexed, affected] = await Promise.all([
    prisma.company.count(),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT cp."companyId") AS count
      FROM   "UserSolvedProblem" usp
      JOIN   "CompanyProblem"    cp ON cp."problemId" = usp."problemId"
      WHERE  usp."userId" = ${userId}
    `,
  ])

  return {
    totalFetched:       leetcodeSolved.length,
    companiesIndexed,
    matchedInCompanies: matchedIds.length,
    notInAnyCompany,
    newlyMarked,
    alreadySolved,
    companiesAffected:  Number(affected[0]?.count ?? 0),
    durationMs:         Date.now() - startMs,
  }
}
