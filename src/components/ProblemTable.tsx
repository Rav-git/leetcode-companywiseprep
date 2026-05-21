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
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <TimePeriodSelector selected={period} onChange={handlePeriodChange} />
      </div>

      <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-gray-800">
        <div className="flex gap-2 flex-wrap">
          {diffButtons.map(diff => (
            <button
              key={diff}
              onClick={() => {
                setDiffFilter(diff)
                setPage(1)
              }}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                diffFilter === diff
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                  : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>

        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title or ID..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />
        </div>

        <div className="text-sm text-gray-500 flex items-center whitespace-nowrap">
          {filtered.length} problems · {solvedCount} solved
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium w-12">#</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium w-16">ID</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Title</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium w-24">
                    Difficulty
                  </th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium w-24">
                    Acceptance
                  </th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium w-36">
                    Frequency
                  </th>
                  <th className="px-4 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
