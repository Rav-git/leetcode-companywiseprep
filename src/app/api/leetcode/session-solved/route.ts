import { NextRequest, NextResponse } from 'next/server'
import { fetchAllSolvedWithSession } from '@/lib/leetcode'

export async function POST(req: NextRequest) {
  let session: string

  try {
    const body = await req.json()
    // Accept the raw cookie value or the full "LEETCODE_SESSION=xxx" string
    session = (body.session ?? '').toString().trim().replace(/^LEETCODE_SESSION=/, '')
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!session) {
    return NextResponse.json({ error: 'session is required' }, { status: 400 })
  }

  try {
    const result = await fetchAllSolvedWithSession(session)

    if (result.totalSolved === 0) {
      return NextResponse.json(
        { error: 'Session invalid or expired — no solved problems returned. Please re-copy your LEETCODE_SESSION cookie.' },
        { status: 401 }
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch from LeetCode'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
