import { fetchCompanyList, fetchCompanyStats } from '@/lib/github'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { CompanyWithStats } from '@/types'
import CompanyGrid from '@/components/CompanyGrid'

export const revalidate = 86400

const PRIORITY_SLUGS = [
  'google', 'amazon', 'microsoft', 'meta', 'apple',
  'bloomberg', 'uber', 'linkedin', 'netflix', 'airbnb', 'goldman-sachs',
  'bytedance', 'tiktok', 'nvidia', 'openai', 'spotify', 'stripe', 'shopify',
  'twitter', 'snapchat', 'lyft', 'doordash', 'coinbase', 'robinhood', 'figma',
  'databricks', 'snowflake', 'palantir-technologies', 'datadog', 'atlassian',
  'adobe', 'salesforce', 'oracle', 'cisco', 'paypal', 'square', 'twilio',
  'dropbox', 'box', 'asana', 'workday', 'servicenow', 'intuit', 'dell',
  'qualcomm', 'samsung', 'jpmorgan', 'morgan-stanley', 'flipkart', 'swiggy',
]

export default async function Home() {
  const [allCompanies, session] = await Promise.all([fetchCompanyList(), auth()])

  const prioritySet = new Set(PRIORITY_SLUGS)
  const priorityCompanies = allCompanies.filter(c => prioritySet.has(c.slug))
  const otherCompanies = allCompanies.filter(c => !prioritySet.has(c.slug))

  const statsResults = await Promise.all(
    priorityCompanies.map(c =>
      fetchCompanyStats(c.slug).then(stats => ({ slug: c.slug, ...stats }))
    )
  )
  const statsMap = new Map(statsResults.map(s => [s.slug, s]))

  const companiesWithStats: CompanyWithStats[] = [
    ...priorityCompanies
      .map(c => ({
        ...c,
        ...(statsMap.get(c.slug) ?? {
          totalCount: 0,
          easyCount: 0,
          mediumCount: 0,
          hardCount: 0,
        }),
      }))
      .sort((a, b) => b.totalCount - a.totalCount),
    ...otherCompanies.map(c => ({
      ...c,
      totalCount: 0,
      easyCount: 0,
      mediumCount: 0,
      hardCount: 0,
    })),
  ]

  let solvedByCompany: Record<string, number> = {}
  if (session?.user?.id) {
    const solved = await prisma.solvedProblem.findMany({
      where: { userId: session.user.id },
      select: { company: true },
    })
    for (const s of solved) {
      solvedByCompany[s.company] = (solvedByCompany[s.company] ?? 0) + 1
    }
  }

  return (
    <main className="min-h-screen pt-14" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Browse by Company</h1>
          <p className="text-gray-400">
            {allCompanies.length} companies · Real LeetCode Premium data · Feb 2026
          </p>
        </div>
        <CompanyGrid companies={companiesWithStats} solvedByCompany={solvedByCompany} />
      </div>
    </main>
  )
}
