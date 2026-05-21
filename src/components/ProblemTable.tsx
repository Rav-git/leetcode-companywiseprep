'use client'

import { useState, useMemo } from 'react'
import { Problem, TimePeriod, Difficulty } from '@/types'
import TimePeriodSelector from './TimePeriodSelector'
import ProblemRow from './ProblemRow'

interface Props {
  initialProblems: Problem[]
  slug: string
  initialSolvedIds: number[]
  initialPeriod: TimePeriod
}

const PAGE_SIZE = 30

const DIFF_COLORS: Record<string, { active: string; activeBorder: string; activeBg: string }> = {
  All:    { active: '#FFA116', activeBorder: 'rgba(255,161,22,0.4)',  activeBg: 'rgba(255,161,22,0.1)'  },
  Easy:   { active: '#00B8A3', activeBorder: 'rgba(0,184,163,0.4)',   activeBg: 'rgba(0,184,163,0.1)'   },
  Medium: { active: '#FFB800', activeBorder: 'rgba(255,184,0,0.4)',   activeBg: 'rgba(255,184,0,0.1)'   },
  Hard:   { active: '#FF375F', activeBorder: 'rgba(255,55,95,0.4)',   activeBg: 'rgba(255,55,95,0.1)'   },
}

export default function ProblemTable({ initialProblems, slug, initialSolvedIds, initialPeriod }: Props) {
  const [problems, setProblems] = useState<Problem[]>(initialProblems)
  const [period, setPeriod] = useState<TimePeriod>(initialPeriod)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [diffFilter, setDiffFilter] = useState<Difficulty | 'All'>('All')
  const [page, setPage] = useState(1)

  const solvedSet = useMemo(() => new Set(initialSolvedIds), [initialSolvedIds])

  const handlePeriodChange = async (newPeriod: TimePeriod) => {
    setPeriod(newPeriod)
    setPage(1)
    setLoading(true)
    try {
      const res = await fetch(`/api/problems?slug=${encodeURIComponent(slug)}&period=${newPeriod}`)
      const data = await res.json()
      setProblems(data.problems ?? [])
    } catch {
      // keep existing problems on error
    } finally {
      setLoading(false)
    }
  }

  const filtered = problems
    .filter(p => diffFilter === 'All' || p.difficulty === diffFilter)
    .filter(
      p =>
        search === '' ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toString().includes(search)
    )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const solvedCount = filtered.filter(p => solvedSet.has(p.id)).length

  const diffButtons: (Difficulty | 'All')[] = ['All', 'Easy', 'Medium', 'Hard']

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
      {/* Time period tabs */}
      <div className="px-1">
        <TimePeriodSelector selected={period} onChange={handlePeriodChange} />
      </div>

      {/* Filters row */}
      <div className="px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center" style={{ borderBottom: '1px solid #2a2a2a' }}>
        {/* Difficulty filters */}
        <div className="flex gap-2">
          {diffButtons.map(diff => {
            const isActive = diffFilter === diff
            const c = DIFF_COLORS[diff]
            return (
              <button
                key={diff}
                onClick={() => { setDiffFilter(diff); setPage(1) }}
                className="px-3.5 py-1 text-sm rounded-full transition-all font-medium"
                style={{
                  backgroundColor: isActive ? c.activeBg : 'transparent',
                  border: `1px solid ${isActive ? c.activeBorder : '#3e3e3e'}`,
                  color: isActive ? c.active : 'rgba(235,235,245,0.45)',
                }}
              >
                {diff}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="flex-1 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by title or ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-lg px-3.5 py-1.5 text-sm text-white outline-none transition-all"
            style={{ backgroundColor: '#282828', border: '1px solid #3e3e3e' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#FFA116')}
            onBlur={e => (e.currentTarget.style.borderColor = '#3e3e3e')}
          />
        </div>

        {/* Count */}
        <p className="text-sm whitespace-nowrap tabular-nums" style={{ color: 'rgba(235,235,245,0.35)' }}>
          {filtered.length} problems · {solvedCount} solved
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#FFA116', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <th className="px-4 py-2.5 text-left text-xs font-medium w-12" style={{ color: 'rgba(235,235,245,0.3)' }}>#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium w-16" style={{ color: 'rgba(235,235,245,0.3)' }}>ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'rgba(235,235,245,0.3)' }}>Title</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium w-28" style={{ color: 'rgba(235,235,245,0.3)' }}>Difficulty</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium w-24" style={{ color: 'rgba(235,235,245,0.3)' }}>Acceptance</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium w-40" style={{ color: 'rgba(235,235,245,0.3)' }}>Frequency</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-sm" style={{ color: 'rgba(235,235,245,0.3)' }}>
                      No problems found
                    </td>
                  </tr>
                ) : (
                  paginated.map((problem, idx) => (
                    <ProblemRow
                      key={problem.id}
                      problem={problem}
                      rank={(page - 1) * PAGE_SIZE + idx + 1}
                      isSolved={solvedSet.has(problem.id)}
                      company={slug}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #2a2a2a' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3.5 py-1.5 text-sm rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: '1px solid #3e3e3e', color: 'rgba(235,235,245,0.6)' }}
              >
                Previous
              </button>
              <span className="text-sm tabular-nums" style={{ color: 'rgba(235,235,245,0.35)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3.5 py-1.5 text-sm rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: '1px solid #3e3e3e', color: 'rgba(235,235,245,0.6)' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
