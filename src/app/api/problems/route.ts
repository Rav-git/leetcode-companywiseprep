import { NextRequest, NextResponse } from 'next/server'
import { getCompanyProblems } from '@/lib/companies'
import { TimePeriod } from '@/types'

const VALID_PERIODS: TimePeriod[] = [
  'thirty-days',
  'three-months',
  'six-months',
  'more-than-six-months',
  'all',
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const period = searchParams.get('period') as TimePeriod | null

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
  }
  if (!period || !VALID_PERIODS.includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  const problems = await getCompanyProblems(slug, period)
  return NextResponse.json({ problems })
}
