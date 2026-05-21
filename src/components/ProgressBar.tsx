interface Props {
  solved: number
  total: number
  label?: string
}

export default function ProgressBar({ solved, total, label }: Props) {
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0

  return (
    <div className="w-full">
      {label && <p className="text-xs text-gray-400 mb-1">{label}</p>}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-800 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
          {solved} / {total}
        </span>
      </div>
    </div>
  )
}
