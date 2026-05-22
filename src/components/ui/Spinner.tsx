import { BRAND, INPUT_BORDER } from '@/constants/theme'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  // 'muted' variant for card-level loaders (CompanyGrid); 'brand' for primary actions (ProblemTable)
  color?: 'brand' | 'muted'
}

// Record ensures all three sizes are always covered — TS errors if one is missing
const SIZE_CLASSES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-10 h-10',
}

export default function Spinner({ size = 'md', color = 'brand' }: SpinnerProps) {
  // Inline style instead of Tailwind class because these hex values aren't in the Tailwind palette
  const borderColor = color === 'brand' ? BRAND : INPUT_BORDER
  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full border-2 border-t-transparent animate-spin`}
      style={{ borderColor, borderTopColor: 'transparent' }}
    />
  )
}
