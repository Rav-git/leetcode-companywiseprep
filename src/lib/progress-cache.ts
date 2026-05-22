export interface CompanyProgress {
  solvedCount: number
  solvedIds: number[]
}

// Module-level store: persists across client-side navigations within the same browser tab.
// Cleared only on hard refresh — HTTP cache (max-age=86400) handles that case.
const store = new Map<string, CompanyProgress>()

export const progressCache = {
  get(slug: string): CompanyProgress | null {
    return store.get(slug) ?? null
  },

  set(slug: string, data: CompanyProgress): void {
    store.set(slug, data)
  },

  // Fire-and-forget: warms the cache without blocking. No-op if already cached.
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
}
