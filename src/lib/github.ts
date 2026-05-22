import { parseCSV, formatCompanyName } from './utils'
import { Company, CompanyWithStats, Problem, TimePeriod } from '@/types'

const GITHUB_RAW_BASE_URL =
  'https://raw.githubusercontent.com/snehasishroy/leetcode-companywise-interview-questions/master'

export async function fetchCompanyList(): Promise<Company[]> {
  try {
    const html = await fetch(
      'https://github.com/snehasishroy/leetcode-companywise-interview-questions',
      { next: { revalidate: 86400 } }
    ).then(r => r.text())

    const match = html.match(
      /<script type="application\/json" data-target="react-app\.embeddedData">([\s\S]*?)<\/script>/
    )
    if (!match) return []

    const json = JSON.parse(match[1])
    const items = json.payload.codeViewRepoRoute.tree.items as Array<{
      name: string
      contentType: string
    }>

    return items
      .filter(i => i.contentType === 'directory' && !i.name.startsWith('src'))
      .map(i => ({ slug: i.name, name: formatCompanyName(i.name) }))
  } catch {
    return []
  }
}

export async function fetchProblems(slug: string, period: TimePeriod): Promise<Problem[]> {
  try {
    const url = `${GITHUB_RAW_BASE_URL}/${slug}/${period}.csv`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const text = await res.text()
    return parseCSV(text)
  } catch {
    return []
  }
}

export async function fetchProblemsWithFallback(
  slug: string
): Promise<{ problems: Problem[]; period: TimePeriod }> {
  const order: TimePeriod[] = ['six-months', 'three-months', 'all']
  for (const period of order) {
    const problems = await fetchProblems(slug, period)
    if (problems.length > 0) return { problems, period }
  }
  return { problems: [], period: 'all' }
}

export async function fetchCompanyStats(
  slug: string
): Promise<Omit<CompanyWithStats, 'slug' | 'name'>> {
  const problems = await fetchProblems(slug, 'all')
  return {
    totalCount: problems.length,
    easyCount: problems.filter(p => p.difficulty === 'Easy').length,
    mediumCount: problems.filter(p => p.difficulty === 'Medium').length,
    hardCount: problems.filter(p => p.difficulty === 'Hard').length,
  }
}
