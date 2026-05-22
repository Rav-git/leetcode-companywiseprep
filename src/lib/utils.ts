import { Problem, Difficulty } from '@/types'

// One color per company avatar — derived deterministically from the first char of the slug
// so the same company always gets the same color without a DB lookup
const COMPANY_AVATAR_COLORS = [
  '#4285F4', '#FF9900', '#00A4EF', '#1877F2', '#555555',
  '#F77B00', '#FF0000', '#1A1A2E', '#0A66C2', '#1DA1F2',
  '#E50914', '#FF5A5F', '#00A1E0', '#F80000', '#69C9D0',
  '#FFCA18', '#FF00BF', '#0052CC', '#0061FF', '#6699CC',
]

export function getCompanyColor(slug: string): string {
  return COMPANY_AVATAR_COLORS[slug.charCodeAt(0) % COMPANY_AVATAR_COLORS.length]
}

export function formatCompanyName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function parseCSVLine(line: string): Problem | null {
  const parts = line.split(',')
  if (parts.length < 6) return null

  const id = parseInt(parts[0])
  const url = parts[1].trim()
  const frequency = parseFloat(parts[parts.length - 1])
  const acceptance = parseFloat(parts[parts.length - 2])
  const difficulty = parts[parts.length - 3].trim() as Difficulty
  const title = parts.slice(2, parts.length - 3).join(',').trim()
  const slug = url.split('/problems/')[1]?.replace(/\/$/, '') ?? ''

  if (!id || !url || !title || !slug) return null
  return { id, url, slug, title, difficulty, acceptance, frequency }
}

export function parseCSV(text: string): Problem[] {
  const lines = text.split('\n')
  return lines
    .slice(1)
    .map(line => parseCSVLine(line.trim()))
    .filter((p): p is Problem => p !== null)
}
