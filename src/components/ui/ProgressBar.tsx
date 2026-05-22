import { EASY, INPUT_BORDER, TEXT_MUTED } from '@/constants/theme'

interface ProgressBarProps {
  solved: number
  total: number
  label?: string
}

export default function ProgressBar({ solved, total, label }: ProgressBarProps) {
  // Guard against division-by-zero when a company has no problems loaded yet
  const solvedPercent = total > 0 ? Math.round((solved / total) * 100) : 0

  return (
    <div className="w-full">
      {label && (
        <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>
          {label}
        </p>
      )}
      <div className="flex items-center gap-2">
        {/* Track uses INPUT_BORDER so it blends with card backgrounds */}
        <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: INPUT_BORDER }}>
          {/* Fill uses EASY (#00B8A3) — same color as easy-difficulty badges for visual consistency */}
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${solvedPercent}%`, backgroundColor: EASY }}
          />
        </div>
        {/* tabular-nums prevents the counter from shifting layout as digits change */}
        <span className="text-xs whitespace-nowrap tabular-nums" style={{ color: TEXT_MUTED }}>
          {solved} / {total}
        </span>
      </div>
    </div>
  )
}
