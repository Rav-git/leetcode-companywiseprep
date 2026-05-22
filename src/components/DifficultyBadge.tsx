import { Difficulty } from '@/types'

interface DifficultyBadgeProps {
  difficulty: Difficulty
}

const DIFFICULTY_BADGE_COLORS: Record<Difficulty, { bg: string; text: string; border: string }> = {
  Easy:   { bg: 'rgba(0,184,163,0.1)',   text: '#00B8A3', border: 'rgba(0,184,163,0.25)' },
  Medium: { bg: 'rgba(255,184,0,0.1)',   text: '#FFB800', border: 'rgba(255,184,0,0.25)' },
  Hard:   { bg: 'rgba(255,55,95,0.1)',   text: '#FF375F', border: 'rgba(255,55,95,0.25)' },
}

export default function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const colorConfig = DIFFICULTY_BADGE_COLORS[difficulty]
  return (
    <span
      className="text-xs px-2.5 py-0.5 rounded-full font-medium inline-block text-center"
      style={{ backgroundColor: colorConfig.bg, color: colorConfig.text, border: `1px solid ${colorConfig.border}`, minWidth: '60px' }}
    >
      {difficulty}
    </span>
  )
}
