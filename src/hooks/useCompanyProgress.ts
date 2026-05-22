'use client'

import { useState, useEffect, useCallback } from 'react'
import { progressCache } from '@/lib/progress-cache'
import { fetchCompanyProgress, invalidateProgressCache } from '@/services/progress.service'

interface CompanyProgressState {
  solvedSet: Set<number>
  solvedCount: number
  // Called by SolveButton after a successful toggle — updates state and cache atomically
  handleSolveToggle: (problemId: number, solved: boolean) => void
}

// Extracted from CompanyPageClient — centralizes the fetch/cache/optimistic-update cycle
// so the same logic isn't re-implemented in every component that shows per-company progress
export function useCompanyProgress(slug: string): CompanyProgressState {
  const cached = progressCache.get(slug)

  // Initialise synchronously from in-memory cache — zero flash when navigating back
  const [solvedSet, setSolvedSet] = useState<Set<number>>(
    cached ? new Set(cached.solvedIds) : new Set()
  )
  const [solvedCount, setSolvedCount] = useState(cached?.solvedCount ?? 0)

  useEffect(() => {
    // Cache hit: already initialised above — skip the network call
    if (progressCache.get(slug)) return

    fetchCompanyProgress(slug)
      .then(({ solvedCount: count, solvedIds }) => {
        progressCache.set(slug, { solvedCount: count, solvedIds })
        setSolvedSet(new Set(solvedIds))
        setSolvedCount(count)
      })
      .catch(() => {})
  }, [slug])

  const handleSolveToggle = useCallback(
    (problemId: number, solved: boolean) => {
      setSolvedSet(prev => {
        const next = new Set(prev)
        if (solved) next.add(problemId)
        else next.delete(problemId)
        // Keep in-memory cache in sync so navigating away and back shows correct state
        progressCache.set(slug, { solvedCount: next.size, solvedIds: Array.from(next) })
        return next
      })
      setSolvedCount(prev => (solved ? prev + 1 : Math.max(0, prev - 1)))

      // Invalidate HTTP cache so a hard refresh also reflects current state
      invalidateProgressCache(slug)
    },
    [slug]
  )

  return { solvedSet, solvedCount, handleSolveToggle }
}
