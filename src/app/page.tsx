import { getAllCompaniesWithStats } from '@/lib/companies'
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
  // Single SQL query replaces the old 662-call Promise.all loop
  const allCompanies = await getAllCompaniesWithStats()

  const prioritySet = new Set(PRIORITY_SLUGS)

  const companiesWithStats: CompanyWithStats[] = [
    ...allCompanies
      .filter(c => prioritySet.has(c.slug))
      .sort((a, b) => b.totalCount - a.totalCount),
    ...allCompanies
      .filter(c => !prioritySet.has(c.slug))
      .sort((a, b) => b.totalCount - a.totalCount),
  ]

  return (
    <main className="min-h-screen pt-14" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Browse by Company</h1>
          <p className="text-gray-400">
            Browse real interview problems asked by {allCompanies.length} companies · Filter by difficulty & time period · Track what you've solved
          </p>
        </div>
        <CompanyGrid companies={companiesWithStats} />
      </div>
    </main>
  )
}
