'use client'

import { TimePeriod, TIME_PERIOD_LABELS } from '@/types'

interface Props {
  selected: TimePeriod
  onChange: (p: TimePeriod) => void
}

const PERIODS = Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]

export default function TimePeriodSelector({ selected, onChange }: Props) {
  return (
    <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid #2a2a2a' }}>
      {PERIODS.map(period => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px"
          style={{
            color: selected === period ? '#FFA116' : 'rgba(235,235,245,0.4)',
            borderBottomColor: selected === period ? '#FFA116' : 'transparent',
          }}
        >
          {TIME_PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  )
}
