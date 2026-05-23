import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTopCompanySlugs, getCompanyList, getCompanyProblems, getCompanyStats } from '@/lib/companies'
import { formatCompanyName, getCompanyColor } from '@/lib/utils'
import CompanyProgress from '@/components/CompanyProgress'
import { TimePeriod, Problem } from '@/types'

interface CompanyPageProps {
  params: { slug: string }
}

export const revalidate = 3600

export async function generateStaticParams() {
  const slugs = await getTopCompanySlugs(10)
  return slugs.map(slug => ({ slug }))
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { slug } = params

  const companies = await getCompanyList()
  const company = companies.find((c: { slug: string }) => c.slug === slug)
  if (!company) notFound()

  const ALL_PERIODS: TimePeriod[] = ['thirty-days', 'three-months', 'six-months', 'more-than-six-months', 'all']
  const [periodResults, stats] = await Promise.all([
    Promise.all(ALL_PERIODS.map(p => getCompanyProblems(slug, p).then((probs: Problem[]) => [p, probs] as [TimePeriod, Problem[]]))),
    getCompanyStats(slug),
  ])
  const allPeriodProblems = Object.fromEntries(periodResults) as Record<TimePeriod, Problem[]>

  const FALLBACK_ORDER: TimePeriod[] = ['six-months', 'three-months', 'all']
  const initialPeriod = FALLBACK_ORDER.find(p => allPeriodProblems[p].length > 0) ?? 'all'

  const color = getCompanyColor(slug)
  const name = formatCompanyName(slug)

  return (
    <main className="min-h-screen pt-14" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm mb-7 px-3 py-2 -ml-3 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'rgba(235,235,245,0.45)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to companies
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start gap-5 mb-8">
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

            <CompanyProgress
              slug={slug}
              totalCount={stats.totalCount}
              allPeriodProblems={allPeriodProblems}
              initialPeriod={initialPeriod}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
