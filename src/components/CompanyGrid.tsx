'use client'

import { useState, useEffect, useRef } from 'react'
import { CompanyWithStats } from '@/types'
import CompanyCard from './CompanyCard'
import { progressCache } from '@/lib/progress-cache'

const BATCH = 50

interface Props {
  companies: CompanyWithStats[]
}

export default function CompanyGrid({ companies }: Props) {
  const [search, setSearch] = useState('')
  const [solvedByCompany, setSolvedByCompany] = useState<Record<string, number>>({})
  const [displayCount, setDisplayCount] = useState(BATCH)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/user-progress')
      .then(r => r.json())
      .then(d => {
        if (!d.solvedByCompany) return
        setSolvedByCompany(d.solvedByCompany)

        // Pre-warm the in-memory cache for every company the user has solved problems in.
        // progressCache.prefetch is a no-op if the slug is already cached.
        Object.keys(d.solvedByCompany).forEach(slug => progressCache.prefetch(slug))
      })
      .catch(() => {})
  }, [])

  // Reset visible window whenever the search query changes
  useEffect(() => {
    setDisplayCount(BATCH)
  }, [search])

  // Load next batch when the sentinel scrolls into view
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDisplayCount(prev => prev + BATCH)
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
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-sm rounded-lg px-4 py-2 text-sm text-white outline-none transition-all"
          style={{ backgroundColor: '#282828', border: '1px solid #3e3e3e' }}
          onFocus={e => (e.currentTarget.style.borderColor = '#FFA116')}
          onBlur={e => (e.currentTarget.style.borderColor = '#3e3e3e')}
        />
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
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#3e3e3e', borderTopColor: 'transparent' }}
          />
        </div>
      )}
    </div>
  )
}
