import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchCompanyList, fetchProblemsWithFallback, fetchCompanyStats } from '@/lib/github'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { formatCompanyName, getCompanyColor } from '@/lib/utils'
import ProblemTable from '@/components/ProblemTable'

interface Props {
  params: { slug: string }
}

export const revalidate = 3600

export default async function CompanyPage({ params }: Props) {
  const { slug } = params

  const [companies, { problems, period: initialPeriod }, stats, session] = await Promise.all([
    fetchCompanyList(),
    fetchProblemsWithFallback(slug),
    fetchCompanyStats(slug),
    auth(),
  ])

  const company = companies.find(c => c.slug === slug)
  if (!company) notFound()

  let solvedIdsArray: number[] = []
  let solvedCount = 0

  if (session?.user?.id) {
    const solved = await prisma.solvedProblem.findMany({
      where: { userId: session.user.id, company: slug },
      select: { problemId: true },
    })
    solvedIdsArray = solved.map(s => s.problemId)
    solvedCount = solved.length
  }

  const color = getCompanyColor(slug)
  const name = formatCompanyName(slug)
  const solvedPct = stats.totalCount > 0 ? Math.round((solvedCount / stats.totalCount) * 100) : 0

  return (
    <main className="min-h-screen pt-14" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm mb-7 transition-colors"
          style={{ color: 'rgba(235,235,245,0.45)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to companies
        </Link>

        {/* Company header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-5 mb-8">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
            style={{
              backgroundColor: color + '22',
              border: `2px solid ${color}44`,
              color,
            }}
          >
            {name.charAt(0)}
          </div>

          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2.5">{name}</h1>

            {/* Difficulty stats */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-4">
              <span className="font-medium" style={{ color: '#00B8A3' }}>
                {stats.easyCount} Easy
              </span>
              <span className="font-medium" style={{ color: '#FFB800' }}>
                {stats.mediumCount} Medium
              </span>
              <span className="font-medium" style={{ color: '#FF375F' }}>
                {stats.hardCount} Hard
              </span>
              <span style={{ color: '#3e3e3e' }}>·</span>
              <span style={{ color: 'rgba(235,235,245,0.45)' }}>
                {stats.totalCount} total problems
              </span>
            </div>

            {/* Progress bar — only for logged-in users */}
            {session?.user && stats.totalCount > 0 && (
              <div className="max-w-sm">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs" style={{ color: 'rgba(235,235,245,0.4)' }}>Your progress</span>
                  <span className="text-xs tabular-nums" style={{ color: 'rgba(235,235,245,0.5)' }}>
                    {solvedCount} / {stats.totalCount}
                    {solvedCount > 0 && <span style={{ color: '#00B8A3' }}> · {solvedPct}%</span>}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${solvedPct}%`, backgroundColor: '#00B8A3' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <ProblemTable
          initialProblems={problems}
          slug={slug}
          initialSolvedIds={solvedIdsArray}
          initialPeriod={initialPeriod}
        />
      </div>
    </main>
  )
}
