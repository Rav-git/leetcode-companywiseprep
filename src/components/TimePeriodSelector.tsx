'use client'

import { TimePeriod, TIME_PERIOD_LABELS } from '@/types'

interface Props {
  selected: TimePeriod
  onChange: (p: TimePeriod) => void
}

const PERIODS = Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]

export default function TimePeriodSelector({ selected, onChange }: Props) {
  return (
    <div className="flex gap-0 border-b border-gray-800 overflow-x-auto">
      {PERIODS.map(period => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
            selected === period
              ? 'text-orange-400 border-orange-400'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          {TIME_PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  )
}
