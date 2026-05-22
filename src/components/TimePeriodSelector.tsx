'use client'

import { TimePeriod, TIME_PERIOD_LABELS } from '@/types'

interface Props {
  selected: TimePeriod
  onChange: (p: TimePeriod) => void
}

const PERIODS = Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]

export default function TimePeriodSelector({ selected, onChange }: Props) {
  return (
    <div className="flex overflow-x-auto scrollbar-none" style={{ borderBottom: '1px solid #2a2a2a' }}>
      {PERIODS.map(period => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className="px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors"
          style={{
            color: selected === period ? '#FFA116' : 'rgba(235,235,245,0.4)',
            boxShadow: selected === period ? 'inset 0 -2px 0 #FFA116' : 'none',
          }}
        >
          {TIME_PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  )
}
