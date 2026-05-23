import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function timeAgo(date: Date): string {
  const diff  = Date.now() - date.getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  <  1) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  <  7) return `${days}d ago`
  return date.toLocaleDateString()
}

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted    = Array.from(new Set(dates)).sort().reverse()
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round(
      (new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86400000
    )
    if (diff === 1) streak++
    else break
  }
  return streak
}

const difficultyColor: Record<string, string> = {
  Easy:   '#00B8A3',
  Medium: '#FFB800',
  Hard:   '#FF375F',
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const userId = session.user.id

  // All queries run in parallel — no JS aggregation loops
  const [diffStats, topCompaniesRaw, recentActivity, activityDatesRaw] = await Promise.all([

    // Difficulty counts via SQL GROUP BY
    prisma.$queryRaw<Array<{ difficulty: string; count: bigint }>>`
      SELECT p.difficulty, COUNT(*) AS count
      FROM   "UserSolvedProblem" usp
      JOIN   "Problem"           p   ON p.id = usp."problemId"
      WHERE  usp."userId" = ${userId}
      GROUP  BY p.difficulty
    `,

    // Top 8 companies by unique solved problems
    prisma.$queryRaw<Array<{ slug: string; name: string; count: bigint }>>`
      SELECT c.slug, c.name, COUNT(DISTINCT usp."problemId") AS count
      FROM   "UserSolvedProblem" usp
      JOIN   "CompanyProblem"   cp ON cp."problemId"  = usp."problemId"
      JOIN   "Company"           c  ON c.id            = cp."companyId"
      WHERE  usp."userId" = ${userId}
      GROUP  BY c.id, c.slug, c.name
      ORDER  BY count DESC
      LIMIT  8
    `,

    // Recent 10 solved problems
    prisma.userSolvedProblem.findMany({
      where:   { userId },
      orderBy: { solvedAt: 'desc' },
      take:    10,
      select: {
        problemId: true,
        solvedAt:  true,
        problem:   { select: { titleSlug: true, title: true, difficulty: true } },
      },
    }),

    // Dates for streak calculation
    prisma.$queryRaw<Array<{ date: string }>>`
      SELECT TO_CHAR("solvedAt", 'YYYY-MM-DD') AS date
      FROM   "UserSolvedProblem"
      WHERE  "userId" = ${userId}
    `,
  ])

  const total  = diffStats.reduce((s, r) => s + Number(r.count), 0)
  const easy   = Number(diffStats.find(r => r.difficulty === 'Easy')?.count   ?? 0)
  const medium = Number(diffStats.find(r => r.difficulty === 'Medium')?.count ?? 0)
  const hard   = Number(diffStats.find(r => r.difficulty === 'Hard')?.count   ?? 0)

  const topCompanies = topCompaniesRaw.map(r => ({
    slug: r.slug, name: r.name, count: Number(r.count),
  }))

  const streak = calculateStreak(activityDatesRaw.map(r => r.date))

  return (
    <main className="min-h-screen pt-14" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              Welcome back, {session.user.name?.split(' ')[0] ?? 'there'}
            </h1>
            <p className="text-sm" style={{ color: 'rgba(235,235,245,0.45)' }}>
              Your interview prep progress at a glance
            </p>
          </div>
          <Link
            href="/dashboard/sync"
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
            style={{ border: '1px solid #2a2a2a', color: 'rgba(235,235,245,0.6)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync LeetCode
          </Link>
        </div>

        {/* Stats */}
        <div className="rounded-xl p-6 mb-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <div className="flex flex-wrap gap-8 items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'rgba(235,235,245,0.45)' }}>
                Total Solved
              </p>
              <p className="text-5xl font-bold text-white tabular-nums">{total}</p>
            </div>
            <div className="w-px self-stretch hidden sm:block" style={{ backgroundColor: '#2a2a2a' }} />
            <div className="flex gap-7 flex-wrap">
              {([['Easy', easy, '#00B8A3'], ['Medium', medium, '#FFB800'], ['Hard', hard, '#FF375F']] as const).map(([label, count, color]) => (
                <div key={label}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(235,235,245,0.45)' }}>{label}</p>
                  </div>
                  <p className="text-3xl font-bold tabular-nums" style={{ color }}>{count}</p>
                </div>
              ))}
            </div>
          </div>
          {total > 0 && (
            <div className="mt-6 flex rounded-full overflow-hidden h-2" style={{ backgroundColor: '#2a2a2a' }}>
              <div style={{ width: `${(easy   / total) * 100}%`, backgroundColor: '#00B8A3' }} />
              <div style={{ width: `${(medium / total) * 100}%`, backgroundColor: '#FFB800' }} />
              <div style={{ width: `${(hard   / total) * 100}%`, backgroundColor: '#FF375F' }} />
            </div>
          )}
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div className="rounded-xl px-5 py-3.5 mb-5 flex items-center gap-3" style={{ backgroundColor: 'rgba(255,161,22,0.07)', border: '1px solid rgba(255,161,22,0.18)' }}>
            <span className="text-xl">🔥</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: '#FFA116' }}>{streak}-day streak</p>
              <p className="text-xs" style={{ color: 'rgba(235,235,245,0.4)' }}>Consistency beats intensity — keep it up</p>
            </div>
          </div>
        )}

        {total === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <p className="text-sm mb-4" style={{ color: 'rgba(235,235,245,0.45)' }}>No problems solved yet</p>
            <Link href="/" className="inline-block font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors" style={{ backgroundColor: '#FFA116', color: '#000' }}>
              Browse companies
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Top companies */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <h2 className="font-semibold text-white text-sm mb-5">Top Companies Practiced</h2>
              <div className="space-y-4">
                {topCompanies.map(({ slug, name, count }) => (
                  <Link key={slug} href={`/company/${slug}`} className="block group">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm" style={{ color: 'rgba(235,235,245,0.7)' }}>{name}</span>
                      <span className="text-xs tabular-nums" style={{ color: 'rgba(235,235,245,0.4)' }}>{count} solved</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((count / (topCompanies[0]?.count || 1)) * 100)}%`, backgroundColor: '#FFA116', opacity: 0.8 }} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <h2 className="font-semibold text-white text-sm mb-5">Recent Activity</h2>
              <div className="space-y-3">
                {recentActivity.map(s => {
                  const color = difficultyColor[s.problem.difficulty] ?? '#888'
                  return (
                    <div key={s.problemId} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <a
                          href={`https://leetcode.com/problems/${s.problem.titleSlug}/`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-sm truncate transition-colors hover:text-white"
                          style={{ color: 'rgba(235,235,245,0.7)' }}
                        >
                          {s.problem.title}
                        </a>
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span className="text-xs font-medium" style={{ color }}>{s.problem.difficulty}</span>
                        <span className="text-xs" style={{ color: 'rgba(235,235,245,0.25)' }}>{timeAgo(s.solvedAt)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
