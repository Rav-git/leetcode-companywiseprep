// Central module for all /api/user-progress calls — keeps fetch logic out of components
export async function fetchCompanyProgress(slug: string): Promise<{ solvedCount: number; solvedIds: number[] }> {
  const res = await fetch(`/api/user-progress?company=${encodeURIComponent(slug)}`)
  const data = await res.json()
  return {
    solvedCount: data.solvedCount ?? 0,
    solvedIds: Array.isArray(data.solvedIds) ? data.solvedIds : [],
  }
}

export async function fetchAllCompanyProgress(): Promise<Record<string, number>> {
  const res = await fetch('/api/user-progress')
  const data = await res.json()
  return data.solvedByCompany ?? {}
}

// Invalidates Next.js fetch cache for a company — called after every solve toggle
// so a hard refresh also reflects current state
export function invalidateProgressCache(slug: string): void {
  fetch(`/api/user-progress?company=${encodeURIComponent(slug)}`, { cache: 'reload' }).catch(() => {})
  fetch('/api/user-progress', { cache: 'reload' }).catch(() => {})
}
