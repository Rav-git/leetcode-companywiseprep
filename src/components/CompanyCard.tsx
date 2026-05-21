'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { CompanyWithStats } from '@/types'
import { getCompanyColor } from '@/lib/utils'
import ProgressBar from './ProgressBar'

interface Props {
  company: CompanyWithStats
  solvedCount: number
}

interface Stats {
  totalCount: number
  easyCount: number
  mediumCount: number
  hardCount: number
}

export default function CompanyCard({ company, solvedCount }: Props) {
  const hasStats = company.totalCount > 0
  const [stats, setStats] = useState<Stats>({
    totalCount: company.totalCount,
    easyCount: company.easyCount,
    mediumCount: company.mediumCount,
    hardCount: company.hardCount,
  })
  const [loading, setLoading] = useState(!hasStats)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hasStats) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()

        fetch(`/api/company-stats?slug=${encodeURIComponent(company.slug)}`)
          .then(r => r.json())
          .then((data: Stats) => setStats(data))
          .catch(() => {})
          .finally(() => setLoading(false))
      },
      { rootMargin: '200px' }
    )

    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [company.slug, hasStats])

  const color = getCompanyColor(company.slug)
  const { totalCount, easyCount, mediumCount, hardCount } = stats
  const total = (easyCount + mediumCount + hardCount) || 1

  return (
    <Link href={`/company/${company.slug}`}>
      <div
        ref={cardRef}
        className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-orange-500/50 transition-all duration-200 cursor-pointer h-full flex flex-col gap-3 min-h-[112px]"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {company.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{company.name}</p>
            {loading ? (
              <div className="h-2.5 w-20 bg-gray-700 rounded animate-pulse mt-1" />
            ) : totalCount > 0 ? (
              <p className="text-gray-500 text-xs tabular-nums">{totalCount} problems</p>
            ) : (
              <p className="text-gray-600 text-xs">No data</p>
            )}
          </div>
        </div>

        {loading ? (
          <>
            <div className="h-1.5 bg-gray-700 rounded-full animate-pulse" />
            <div className="h-1.5 bg-gray-800 rounded-full animate-pulse w-3/4" />
          </>
        ) : totalCount > 0 ? (
          <>
            <div className="flex rounded-full overflow-hidden h-1.5 bg-gray-800">
              <div
                className="bg-green-500"
                style={{ width: `${(easyCount / total) * 100}%` }}
                title={`Easy: ${easyCount}`}
              />
              <div
                className="bg-yellow-500"
                style={{ width: `${(mediumCount / total) * 100}%` }}
                title={`Medium: ${mediumCount}`}
              />
              <div
                className="bg-red-500"
                style={{ width: `${(hardCount / total) * 100}%` }}
                title={`Hard: ${hardCount}`}
              />
            </div>
            <ProgressBar solved={solvedCount} total={totalCount} />
          </>
        ) : null}
      </div>
    </Link>
  )
}
