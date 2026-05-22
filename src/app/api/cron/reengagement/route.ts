import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendReengagementEmail } from '@/lib/mailer'

// Called daily by Vercel cron at 09:00 UTC (see vercel.json)
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Raw query needed to compare two columns (Prisma WHERE doesn't support column vs column)
  const users = await prisma.$queryRaw<{ id: string; email: string; name: string | null }[]>`
    SELECT id, email, name FROM "User"
    WHERE
      "emailVerified" = true
      AND "emailOptOut"  = false
      AND "lastActiveAt" < ${sevenDaysAgo}
      AND (
        "reengageSentAt" IS NULL
        OR "reengageSentAt" < "lastActiveAt"
      )
    LIMIT 100
  `

  const results = await Promise.allSettled(
    users.map(async (user) => {
      await sendReengagementEmail({ email: user.email, name: user.name ?? 'there' })
      await prisma.user.update({
        where: { id: user.id },
        data: { reengageSentAt: new Date() },
      })
    })
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  console.log(`[cron/reengagement] sent=${sent} failed=${failed}`)

  return NextResponse.json({ sent, failed })
}
