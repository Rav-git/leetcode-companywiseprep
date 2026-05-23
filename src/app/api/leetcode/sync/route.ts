import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncLeetCodeToDb } from '@/services/leetcode-sync.service'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to sync your progress.' }, { status: 401 })
  }

  let lcSession: string
  try {
    const body = await req.json()
    lcSession = (body.session ?? '').toString().trim().replace(/^LEETCODE_SESSION=/, '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!lcSession) {
    return NextResponse.json({ error: 'session is required.' }, { status: 400 })
  }

  try {
    const result = await syncLeetCodeToDb(session.user.id, lcSession)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed.'
    console.error('[leetcode-sync] error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
