'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { CompanyWithStats } from '@/types'
import CompanyCard from './CompanyCard'
import Spinner from './ui/Spinner'
import TextInput from './ui/TextInput'
import { progressCache } from '@/lib/progress-cache'
import { fetchAllCompanyProgress } from '@/services/progress.service'

// 50 cards per batch — enough to fill a wide viewport without over-rendering on first load
const CARDS_PER_BATCH = 50

interface CompanyGridProps {
  companies: CompanyWithStats[]
}

export default function CompanyGrid({ companies }: CompanyGridProps) {
  const [search, setSearch] = useState('')
  const [solvedByCompany, setSolvedByCompany] = useState<Record<string, number>>(
    progressCache.getSolvedByCompany() ?? {}
  )
  const [displayCount, setDisplayCount] = useState(CARDS_PER_BATCH)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Cache hit: already fetched in this tab session — skip the API call entirely
    if (progressCache.getSolvedByCompany()) return

    fetchAllCompanyProgress()
      .then(progressData => {
        progressCache.setSolvedByCompany(progressData)
        setSolvedByCompany(progressData)
      })
      .catch(() => {})
  }, [])

  // Reset visible window whenever the search query changes
  useEffect(() => {
    setDisplayCount(CARDS_PER_BATCH)
  }, [search])

  // Load next batch when the sentinel scrolls into view
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDisplayCount(prev => prev + CARDS_PER_BATCH)
        }
      },
      { rootMargin: '300px' } // start loading 300px before the bottom edge
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const filtered = companies.filter(
    c => search === '' || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const visible = filtered.slice(0, displayCount)
  const hasMore = displayCount < filtered.length

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <TextInput
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Search companies..."
          />
        </div>
        <p className="text-sm whitespace-nowrap" style={{ color: 'rgba(235,235,245,0.35)' }}>
          {search
            ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
            : `Showing ${visible.length} of ${companies.length} companies`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {visible.map(company => (
          <CompanyCard
            key={company.slug}
            company={company}
            solvedCount={solvedByCompany[company.slug] ?? 0}
          />
        ))}
      </div>

      {/* Sentinel — triggers next batch load when scrolled into view */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center pt-8 pb-4">
          <Spinner size="sm" color="muted" />
        </div>
      )}
    </div>
  )
}
