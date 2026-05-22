'use client'

import { useState, useCallback, useEffect } from 'react'
import { Problem, TimePeriod } from '@/types'
import ProblemTable from './ProblemTable'

interface Props {
  slug: string
  totalCount: number
  initialProblems: Problem[]
  initialPeriod: TimePeriod
}

export default function CompanyPageClient({ slug, totalCount, initialProblems, initialPeriod }: Props) {
  const [solvedSet, setSolvedSet] = useState<Set<number>>(new Set())
  const [solvedCount, setSolvedCount] = useState(0)

  useEffect(() => {
    fetch(`/api/user-progress?company=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.solvedIds)) {
          setSolvedSet(new Set(d.solvedIds))
          setSolvedCount(d.solvedCount ?? 0)
        }
      })
      .catch(() => {})
  }, [slug])

  const handleSolveToggle = useCallback((problemId: number, solved: boolean) => {
    setSolvedSet(prev => {
      const next = new Set(prev)
      if (solved) next.add(problemId)
      else next.delete(problemId)
      return next
    })
    setSolvedCount(prev => solved ? prev + 1 : Math.max(0, prev - 1))
  }, [])

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
          initialProblems={initialProblems}
          slug={slug}
          solvedSet={solvedSet}
          onSolvedToggle={handleSolveToggle}
          initialPeriod={initialPeriod}
        />
      </div>
    </>
  )
}
