'use client'

import { Problem, TimePeriod } from '@/types'
import ProblemTable from './ProblemTable'
import ProgressBar from './ui/ProgressBar'
import { useCompanyProgress } from '@/hooks/useCompanyProgress'

interface CompanyProgressProps {
  slug: string
  totalCount: number
  allPeriodProblems: Record<TimePeriod, Problem[]>
  initialPeriod: TimePeriod
}

// Bridges the static company page (server component) with the interactive problem table.
// Owns the solve state so ProgressBar and ProblemTable stay in sync without prop drilling.
export default function CompanyProgress({ slug, totalCount, allPeriodProblems, initialPeriod }: CompanyProgressProps) {
  const { solvedSet, solvedCount, handleSolveToggle } = useCompanyProgress(slug)

  return (
    <>
      {/* Progress bar — updates optimistically on every solve toggle */}
      {totalCount > 0 && (
        <div className="max-w-sm mb-8">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs" style={{ color: 'rgba(235,235,245,0.4)' }}>Your progress</span>
            {solvedCount > 0 && (
              <span className="text-xs tabular-nums" style={{ color: '#00B8A3' }}>
                {Math.round((solvedCount / totalCount) * 100)}%
              </span>
            )}
          </div>
          <ProgressBar solved={solvedCount} total={totalCount} />
        </div>
      )}

      <ProblemTable
        allPeriodProblems={allPeriodProblems}
        slug={slug}
        solvedSet={solvedSet}
        onSolvedToggle={handleSolveToggle}
        initialPeriod={initialPeriod}
      />
    </>
  )
}
