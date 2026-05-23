const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql'

// ─── Authenticated (session cookie) ──────────────────────────────────────────

const SESSION_SOLVED_QUERY = `
  query sessionSolvedProblems($categorySlug: String!, $skip: Int!, $limit: Int!, $filters: QuestionListFilterInput!) {
    problemsetQuestionList: questionList(
      categorySlug: $categorySlug
      limit: $limit
      skip: $skip
      filters: $filters
    ) {
      total: totalNum
      questions: data {
        questionId
        frontendQuestionId: questionFrontendId
        title
        titleSlug
        difficulty
      }
    }
  }
`

export interface SessionSolvedProblem {
  questionId: string
  frontendQuestionId: string   // the number shown on LeetCode (e.g. "136")
  title: string
  titleSlug: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
}

async function fetchSolvedPage(
  session: string,
  skip: number,
  limit: number
): Promise<{ total: number; questions: SessionSolvedProblem[] }> {
  const res = await fetch(LEETCODE_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `LEETCODE_SESSION=${session}`,
      'Referer': 'https://leetcode.com',
      'Origin': 'https://leetcode.com',
    },
    body: JSON.stringify({
      query: SESSION_SOLVED_QUERY,
      variables: {
        categorySlug: '',      // empty = all categories
        skip,
        limit,
        filters: { status: 'AC' },   // AC = accepted/solved only
      },
    }),
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`LeetCode responded with ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? 'LeetCode GraphQL error')
  return json.data.problemsetQuestionList
}

export async function fetchAllSolvedWithSession(
  session: string
): Promise<{ totalSolved: number; fetchedCount: number; problems: SessionSolvedProblem[] }> {
  const PAGE = 100

  // First page — establishes total count
  const first = await fetchSolvedPage(session, 0, PAGE)
  const total = first.total
  const allProblems: SessionSolvedProblem[] = [...first.questions]

  // Remaining pages in parallel
  const remainingPages = Math.ceil((total - PAGE) / PAGE)
  if (remainingPages > 0) {
    const pages = await Promise.all(
      Array.from({ length: remainingPages }, (_, i) =>
        fetchSolvedPage(session, (i + 1) * PAGE, PAGE)
      )
    )
    for (const page of pages) allProblems.push(...page.questions)
  }

  return {
    totalSolved: total,
    fetchedCount: allProblems.length,
    problems: allProblems,
  }
}

export interface LeetCodeProblem {
  titleSlug: string
  title: string
  timestamp: number
}

export interface LeetCodeProfile {
  username: string
  totalSolved: number
  easySolved: number
  mediumSolved: number
  hardSolved: number
  fetchedCount: number  // how many unique slugs we got (may be less than totalSolved — LeetCode caps public submission history)
  problems: LeetCodeProblem[]
}

async function queryLeetCode<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(LEETCODE_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com',
      'Origin': 'https://leetcode.com',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`LeetCode API responded with ${res.status}`)

  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? 'LeetCode GraphQL error')

  return json.data as T
}

const STATS_QUERY = `
  query userStats($username: String!) {
    matchedUser(username: $username) {
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
  }
`

const RECENT_AC_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`

type StatsData = {
  matchedUser: {
    submitStatsGlobal: {
      acSubmissionNum: Array<{ difficulty: string; count: number }>
    }
  } | null
}

type SubmissionsData = {
  recentAcSubmissionList: Array<{
    id: string
    title: string
    titleSlug: string
    timestamp: string
  }>
}

export async function fetchLeetCodeSolvedProblems(username: string): Promise<LeetCodeProfile> {
  const [statsData, submissionsData] = await Promise.all([
    queryLeetCode<StatsData>(STATS_QUERY, { username }),
    // LeetCode caps this server-side (typically ~20 for public profiles)
    // We request 2000 to get whatever the maximum they allow
    queryLeetCode<SubmissionsData>(RECENT_AC_QUERY, { username, limit: 2000 }),
  ])

  if (!statsData.matchedUser) {
    throw new Error(`LeetCode user "${username}" not found or profile is private`)
  }

  const acCounts = statsData.matchedUser.submitStatsGlobal.acSubmissionNum
  const totalSolved  = acCounts.find(c => c.difficulty === 'All')?.count ?? 0
  const easySolved   = acCounts.find(c => c.difficulty === 'Easy')?.count ?? 0
  const mediumSolved = acCounts.find(c => c.difficulty === 'Medium')?.count ?? 0
  const hardSolved   = acCounts.find(c => c.difficulty === 'Hard')?.count ?? 0

  // Deduplicate: the same problem can appear multiple times (re-submissions)
  const seen = new Set<string>()
  const problems: LeetCodeProblem[] = []
  for (const s of submissionsData.recentAcSubmissionList) {
    if (!seen.has(s.titleSlug)) {
      seen.add(s.titleSlug)
      problems.push({
        titleSlug: s.titleSlug,
        title: s.title,
        timestamp: Number(s.timestamp),
      })
    }
  }

  return {
    username,
    totalSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    fetchedCount: problems.length,
    problems,
  }
}
