import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchCompanyList, fetchProblemsWithFallback, fetchCompanyStats } from '@/lib/github'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { formatCompanyName, getCompanyColor } from '@/lib/utils'
import ProblemTable from '@/components/ProblemTable'
import ProgressBar from '@/components/ProgressBar'

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

  return (
    <main className="min-h-screen bg-gray-950 pt-14">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to companies
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-8">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {name.charAt(0)}
          </div>

          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-green-400">{stats.easyCount} Easy</span>
              <span className="text-yellow-400">{stats.mediumCount} Medium</span>
              <span className="text-red-400">{stats.hardCount} Hard</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400">{stats.totalCount} total problems</span>
            </div>

            {session?.user && stats.totalCount > 0 && (
              <div className="mt-3 max-w-xs">
                <p className="text-xs text-gray-500 mb-1">Your progress</p>
                <ProgressBar solved={solvedCount} total={stats.totalCount} />
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
