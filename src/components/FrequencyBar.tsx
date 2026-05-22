interface FrequencyBarProps {
  value: number
}

export default function FrequencyBar({ value }: FrequencyBarProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-20 rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: '#FFA116' }}
        />
      </div>
      <span className="text-xs tabular-nums" style={{ color: 'rgba(235,235,245,0.45)', width: '36px' }}>
        {value.toFixed(1)}%
      </span>
    </div>
  )
}
