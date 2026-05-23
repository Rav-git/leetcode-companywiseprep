import { NextRequest, NextResponse } from 'next/server'
import { fetchLeetCodeSolvedProblems } from '@/lib/leetcode'

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('username')?.trim()
  if (!raw) {
    return NextResponse.json({ error: 'username query param is required' }, { status: 400 })
  }

  // Accept full profile URLs too: https://leetcode.com/u/username/ or https://leetcode.com/username/
  const username = raw
    .replace(/^https?:\/\/leetcode\.com\/(u\/)?/, '')
    .replace(/\/$/, '')

  if (!username) {
    return NextResponse.json({ error: 'Could not parse a username from the provided value' }, { status: 400 })
  }

  try {
    const profile = await fetchLeetCodeSolvedProblems(username)
    return NextResponse.json(profile)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch LeetCode data'
    const status = message.includes('not found') || message.includes('private') ? 404 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
