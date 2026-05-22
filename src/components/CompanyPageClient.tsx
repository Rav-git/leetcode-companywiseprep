'use client'

import { useState, useCallback, useEffect } from 'react'
import { Problem, TimePeriod } from '@/types'
import ProblemTable from './ProblemTable'
import { progressCache } from '@/lib/progress-cache'

interface Props {
  slug: string
  totalCount: number
  allPeriodProblems: Record<TimePeriod, Problem[]>
  initialPeriod: TimePeriod
}

export default function CompanyPageClient({ slug, totalCount, allPeriodProblems, initialPeriod }: Props) {
  // Initialise from in-memory cache synchronously — zero flash when navigating back
  const cached = progressCache.get(slug)
  const [solvedSet, setSolvedSet] = useState<Set<number>>(
    cached ? new Set(cached.solvedIds) : new Set()
  )
  const [solvedCount, setSolvedCount] = useState(cached?.solvedCount ?? 0)

  useEffect(() => {
    // Cache hit: already initialised above, no fetch needed
    if (progressCache.get(slug)) return

    fetch(`/api/user-progress?company=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.solvedIds)) {
          const data = { solvedCount: d.solvedCount ?? 0, solvedIds: d.solvedIds }
          progressCache.set(slug, data)
          setSolvedSet(new Set(d.solvedIds))
          setSolvedCount(data.solvedCount)
        }
      })
      .catch(() => {})
  }, [slug])

  const handleSolveToggle = useCallback((problemId: number, solved: boolean) => {
    setSolvedSet(prev => {
      const next = new Set(prev)
      if (solved) next.add(problemId)
      else next.delete(problemId)
      // Keep in-memory cache in sync so navigating away and back is still instant
      progressCache.set(slug, { solvedCount: next.size, solvedIds: Array.from(next) })
      return next
    })
    setSolvedCount(prev => solved ? prev + 1 : Math.max(0, prev - 1))

    // Invalidate HTTP cache so a hard refresh also shows current state
    fetch(`/api/user-progress?company=${encodeURIComponent(slug)}`, { cache: 'reload' }).catch(() => {})
    fetch('/api/user-progress', { cache: 'reload' }).catch(() => {})
  }, [slug])

  const pct = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0

  return (
    <>
      {/* Progress bar — updates instantly on solve */}
      {totalCount > 0 && solvedCount !== null && (
        <div className="max-w-sm">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs" style={{ color: 'rgba(235,235,245,0.4)' }}>Your progress</span>
            <span className="text-xs tabular-nums" style={{ color: 'rgba(235,235,245,0.5)' }}>
              {solvedCount} / {totalCount}
              {solvedCount > 0 && <span style={{ color: '#00B8A3' }}> · {pct}%</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: '#00B8A3' }}
            />
          </div>
        </div>
      )}

      <div className="mt-8">
        <ProblemTable
          allPeriodProblems={allPeriodProblems}
          slug={slug}
          solvedSet={solvedSet}
          onSolvedToggle={handleSolveToggle}
          initialPeriod={initialPeriod}
        />
      </div>
    </>
  )
}
