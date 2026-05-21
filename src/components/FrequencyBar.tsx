interface Props {
  value: number
}

export default function FrequencyBar({ value }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-800 rounded-full h-1.5">
        <div
          className="bg-orange-500 h-1.5 rounded-full"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-10 tabular-nums">{value.toFixed(1)}%</span>
    </div>
  )
}
