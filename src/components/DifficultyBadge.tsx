import { Difficulty } from '@/types'

interface Props {
  difficulty: Difficulty
}

const styles: Record<Difficulty, string> = {
  Easy: 'bg-green-900/40 text-green-400 border border-green-800/50',
  Medium: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50',
  Hard: 'bg-red-900/40 text-red-400 border border-red-800/50',
}

export default function DifficultyBadge({ difficulty }: Props) {
  return (
    <span
      className={`text-xs px-2.5 py-0.5 rounded-full font-medium inline-block w-16 text-center ${styles[difficulty]}`}
    >
      {difficulty}
    </span>
  )
}
