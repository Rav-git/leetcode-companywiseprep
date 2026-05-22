export interface CompanyProgress {
  solvedCount: number
  solvedIds: number[]
}

// Module-level store: persists across client-side navigations within the same browser tab.
// Cleared only on hard refresh.
const store = new Map<string, CompanyProgress>()
let solvedByCompany: Record<string, number> | null = null

export const progressCache = {
  // Per-company solved IDs (used on company page)
  get(slug: string): CompanyProgress | null {
    return store.get(slug) ?? null
  },

  set(slug: string, data: CompanyProgress): void {
    store.set(slug, data)
    // Keep solvedByCompany count in sync
    if (solvedByCompany) solvedByCompany[slug] = data.solvedCount
  },

  prefetch(slug: string): void {
    if (store.has(slug)) return
    fetch(`/api/user-progress?company=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.solvedIds)) {
          store.set(slug, { solvedCount: d.solvedCount ?? 0, solvedIds: d.solvedIds })
        }
      })
      .catch(() => {})
  },

  // Home page solved counts per company
  getSolvedByCompany(): Record<string, number> | null {
    return solvedByCompany
  },

  setSolvedByCompany(data: Record<string, number>): void {
    solvedByCompany = data
  },
}
