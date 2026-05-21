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
      className="transition-colors cursor-pointer group"
      style={{
        borderBottom: '1px solid #222',
        backgroundColor: isSolved ? 'rgba(0,184,163,0.04)' : 'transparent',
      }}
      onClick={() => window.open(problem.url, '_blank', 'noopener,noreferrer')}
    >
      <td className="px-4 py-3.5 text-sm w-12 tabular-nums" style={{ color: 'rgba(235,235,245,0.25)' }}>
        {rank}
      </td>
      <td className="px-4 py-3.5 text-sm w-16 tabular-nums" style={{ color: 'rgba(235,235,245,0.4)' }}>
        {problem.id}
      </td>
      <td className="px-4 py-3.5 text-sm font-medium">
        <span
          className="transition-colors"
          style={{ color: isSolved ? 'rgba(0,184,163,0.8)' : 'rgba(235,235,245,0.9)' }}
        >
          {problem.title}
        </span>
      </td>
      <td className="px-4 py-3.5 w-28">
        <DifficultyBadge difficulty={problem.difficulty} />
      </td>
      <td className="px-4 py-3.5 text-sm w-24 tabular-nums" style={{ color: 'rgba(235,235,245,0.45)' }}>
        {problem.acceptance.toFixed(1)}%
      </td>
      <td className="px-4 py-3.5 w-40">
        <FrequencyBar value={problem.frequency} />
      </td>
      <td
        className="px-4 py-3.5 w-12"
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
