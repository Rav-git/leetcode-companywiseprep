import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { fetchProblems } from '@/lib/github'
import { formatCompanyName } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = Array.from(new Set(dates)).sort().reverse()
  const today = new Date().toISOString().split('T')[0]
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
  Easy: '#00B8A3',
  Medium: '#FFB800',
  Hard: '#FF375F',
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const solved = await prisma.solvedProblem.findMany({
    where: { userId: session.user.id },
    orderBy: { solvedAt: 'desc' },
  })

  // Enrich with problem metadata from GitHub (cached by Next.js fetch cache)
  const companies = Array.from(new Set(solved.map(s => s.company)))
  const problemMeta = new Map<number, { slug: string; title: string; difficulty: string }>()

  await Promise.all(
    companies.map(async (company) => {
      const problems = await fetchProblems(company, 'all')
      for (const p of problems) {
        if (!problemMeta.has(p.id)) {
          problemMeta.set(p.id, { slug: p.slug, title: p.title, difficulty: p.difficulty })
        }
      }
    })
  )

  // Count unique problems (a problem solved in 2 companies = 1 unique solve)
  const uniqueSolvedIds = new Set(solved.map(s => s.problemId))
  const total = uniqueSolvedIds.size
  const easy   = Array.from(uniqueSolvedIds).filter(id => problemMeta.get(id)?.difficulty === 'Easy').length
  const medium = Array.from(uniqueSolvedIds).filter(id => problemMeta.get(id)?.difficulty === 'Medium').length
  const hard   = Array.from(uniqueSolvedIds).filter(id => problemMeta.get(id)?.difficulty === 'Hard').length

  // Per-company counts (unique problems per company)
  const companyCounts: Record<string, Set<number>> = {}
  for (const s of solved) {
    if (!companyCounts[s.company]) companyCounts[s.company] = new Set()
    companyCounts[s.company].add(s.problemId)
  }
  const topCompanies = Object.entries(companyCounts)
    .map(([slug, ids]) => [slug, ids.size] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Recent: deduplicate by problemId, show each problem once (latest solve)
  const seenIds = new Set<number>()
  const recent = solved.filter(s => {
    if (seenIds.has(s.problemId)) return false
    seenIds.add(s.problemId)
    return true
  }).slice(0, 10)

  const dateSlugs = solved.map(s => s.solvedAt.toISOString().split('T')[0])
  const streak = calculateStreak(dateSlugs)

  return (
    <main className="min-h-screen pt-14" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">
            Welcome back, {session.user.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-sm" style={{ color: 'rgba(235,235,245,0.45)' }}>
            Your interview prep progress at a glance
          </p>
        </div>

        {/* Stats overview card */}
        <div className="rounded-xl p-6 mb-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <div className="flex flex-wrap gap-8 items-start">
            {/* Total */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'rgba(235,235,245,0.45)' }}>
                Total Solved
              </p>
              <p className="text-5xl font-bold text-white tabular-nums">{total}</p>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch hidden sm:block" style={{ backgroundColor: '#2a2a2a' }} />

            {/* Difficulty breakdown */}
            <div className="flex gap-7 flex-wrap">
              {[['Easy', easy, '#00B8A3'], ['Medium', medium, '#FFB800'], ['Hard', hard, '#FF375F']].map(([label, count, color]) => (
                <div key={label as string}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color as string }} />
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(235,235,245,0.45)' }}>{label}</p>
                  </div>
                  <p className="text-3xl font-bold tabular-nums" style={{ color: color as string }}>{count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stacked difficulty bar */}
          {total > 0 && (
            <div className="mt-6 flex rounded-full overflow-hidden h-2" style={{ backgroundColor: '#2a2a2a' }}>
              <div style={{ width: `${(easy / total) * 100}%`, backgroundColor: '#00B8A3' }} />
              <div style={{ width: `${(medium / total) * 100}%`, backgroundColor: '#FFB800' }} />
              <div style={{ width: `${(hard / total) * 100}%`, backgroundColor: '#FF375F' }} />
            </div>
          )}
        </div>

        {/* Streak banner */}
        {streak > 0 && (
          <div className="rounded-xl px-5 py-3.5 mb-5 flex items-center gap-3" style={{ backgroundColor: 'rgba(255,161,22,0.07)', border: '1px solid rgba(255,161,22,0.18)' }}>
            <span className="text-xl">🔥</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: '#FFA116' }}>
                {streak}-day streak
              </p>
              <p className="text-xs" style={{ color: 'rgba(235,235,245,0.4)' }}>
                Consistency beats intensity — keep it up
              </p>
            </div>
          </div>
        )}

        {total === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <p className="text-sm mb-4" style={{ color: 'rgba(235,235,245,0.45)' }}>No problems solved yet</p>
            <Link
              href="/"
              className="inline-block font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors"
              style={{ backgroundColor: '#FFA116', color: '#000' }}
            >
              Browse companies
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Top companies */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <h2 className="font-semibold text-white text-sm mb-5">Top Companies Practiced</h2>
              <div className="space-y-4">
                {topCompanies.map(([slug, count]) => {
                  const pct = Math.round((count / (topCompanies[0][1] || 1)) * 100)
                  return (
                    <Link key={slug} href={`/company/${slug}`} className="block group">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm transition-colors" style={{ color: 'rgba(235,235,245,0.7)' }}>
                          {formatCompanyName(slug)}
                        </span>
                        <span className="text-xs tabular-nums" style={{ color: 'rgba(235,235,245,0.4)' }}>
                          {count} solved
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: '#FFA116', opacity: 0.8 }}
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Recent activity */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <h2 className="font-semibold text-white text-sm mb-5">Recent Activity</h2>
              <div className="space-y-3">
                {recent.map(s => {
                  const meta = problemMeta.get(s.problemId)
                  const color = difficultyColor[meta?.difficulty ?? ''] ?? '#888'
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        {meta ? (
                          <a
                            href={`https://leetcode.com/problems/${meta.slug}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm truncate transition-colors hover:text-white"
                            style={{ color: 'rgba(235,235,245,0.7)' }}
                          >
                            {meta.title}
                          </a>
                        ) : (
                          <span className="text-sm truncate" style={{ color: 'rgba(235,235,245,0.4)' }}>
                            Problem #{s.problemId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        {meta && (
                          <span className="text-xs font-medium" style={{ color }}>
                            {meta.difficulty}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: 'rgba(235,235,245,0.25)' }}>
                          {timeAgo(s.solvedAt)}
                        </span>
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
