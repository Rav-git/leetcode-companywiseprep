import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
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
  const sorted = [...new Set(dates)].sort().reverse()
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

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: 'text-green-400',
  Medium: 'text-yellow-400',
  Hard: 'text-red-400',
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const solved = await prisma.solvedProblem.findMany({
    where: { userId: session.user.id },
    orderBy: { solvedAt: 'desc' },
  })

  const total = solved.length
  const easy = solved.filter(s => s.difficulty === 'Easy').length
  const medium = solved.filter(s => s.difficulty === 'Medium').length
  const hard = solved.filter(s => s.difficulty === 'Hard').length

  // Top companies
  const companyCounts: Record<string, number> = {}
  for (const s of solved) {
    companyCounts[s.company] = (companyCounts[s.company] ?? 0) + 1
  }
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Recent activity
  const recent = solved.slice(0, 10)

  // Streak
  const dateSlugs = solved.map(s => s.solvedAt.toISOString().split('T')[0])
  const streak = calculateStreak(dateSlugs)

  return (
    <main className="min-h-screen bg-gray-950 pt-14">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">
            Welcome back, {session.user.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-gray-400 text-sm">Your interview prep progress at a glance</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Solved</p>
            <p className="text-white text-3xl font-bold">{total}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-green-400 text-xs mb-1">Easy</p>
            <p className="text-white text-3xl font-bold">{easy}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-yellow-400 text-xs mb-1">Medium</p>
            <p className="text-white text-3xl font-bold">{medium}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-red-400 text-xs mb-1">Hard</p>
            <p className="text-white text-3xl font-bold">{hard}</p>
          </div>
        </div>

        {/* Streak banner */}
        {streak > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-5 py-3 mb-8 flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-orange-400 font-semibold text-sm">
                {streak} day streak
              </p>
              <p className="text-gray-400 text-xs">Keep it up — consistency beats intensity</p>
            </div>
          </div>
        )}

        {total === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-gray-400 mb-3">No problems solved yet</p>
            <Link
              href="/"
              className="inline-block bg-[#FFA116] hover:bg-[#FFB84D] text-black font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
            >
              Browse companies
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top companies */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Top Companies Practiced</h2>
              <div className="space-y-3">
                {topCompanies.map(([slug, count]) => {
                  const pct = Math.round((count / total) * 100)
                  return (
                    <Link
                      key={slug}
                      href={`/company/${slug}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-gray-200 text-sm group-hover:text-white transition-colors truncate">
                            {formatCompanyName(slug)}
                          </span>
                          <span className="text-gray-400 text-xs ml-2 shrink-0">{count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#FFA116] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Recent Activity</h2>
              <div className="space-y-2">
                {recent.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      <a
                        href={`https://leetcode.com/problems/${s.problemSlug}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 text-sm hover:text-white transition-colors truncate"
                      >
                        {s.problemSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs ${DIFFICULTY_COLOR[s.difficulty] ?? 'text-gray-400'}`}>
                        {s.difficulty}
                      </span>
                      <span className="text-gray-600 text-xs">{timeAgo(s.solvedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
