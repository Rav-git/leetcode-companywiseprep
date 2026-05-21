export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type TimePeriod =
  | 'thirty-days'
  | 'three-months'
  | 'six-months'
  | 'more-than-six-months'
  | 'all'

export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  'thirty-days': '30 Days',
  'three-months': '3 Months',
  'six-months': '6 Months',
  'more-than-six-months': '6+ Months',
  'all': 'All Time',
}

export interface Problem {
  id: number
  url: string
  slug: string
  title: string
  difficulty: Difficulty
  acceptance: number
  frequency: number
}

export interface Company {
  slug: string
  name: string
}

export interface CompanyWithStats extends Company {
  totalCount: number
  easyCount: number
  mediumCount: number
  hardCount: number
}
