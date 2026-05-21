import { Problem } from '@/types'
import DifficultyBadge from './DifficultyBadge'
import FrequencyBar from './FrequencyBar'
import SolveButton from './SolveButton'

interface Props {
  problem: Problem
  rank: number
  isSolved: boolean
  company: string
}

export default function ProblemRow({ problem, rank, isSolved, company }: Props) {
  return (
    <tr
      className={`border-b border-gray-800/50 hover:bg-gray-800/60 transition-colors cursor-pointer ${
        isSolved ? 'bg-green-950/20' : ''
      }`}
      onClick={() => window.open(problem.url, '_blank', 'noopener,noreferrer')}
    >
      <td className="px-4 py-3 text-gray-500 text-sm w-12 tabular-nums">{rank}</td>
      <td className="px-4 py-3 text-gray-400 text-sm w-16 tabular-nums">{problem.id}</td>
      <td className="px-4 py-3 text-white text-sm font-medium">
        <span className="hover:text-orange-400 transition-colors">{problem.title}</span>
      </td>
      <td className="px-4 py-3 w-24">
        <DifficultyBadge difficulty={problem.difficulty} />
      </td>
      <td className="px-4 py-3 text-gray-400 text-sm w-24 tabular-nums">
        {problem.acceptance.toFixed(1)}%
      </td>
      <td className="px-4 py-3 w-36">
        <FrequencyBar value={problem.frequency} />
      </td>
      <td
        className="px-4 py-3 w-12"
        onClick={e => e.stopPropagation()}
      >
        <SolveButton
          problemId={problem.id}
          problemSlug={problem.slug}
          company={company}
          difficulty={problem.difficulty}
          initialSolved={isSolved}
        />
      </td>
    </tr>
  )
}
