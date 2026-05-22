'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CompanyWithStats } from '@/types'
import { getCompanyColor } from '@/lib/utils'
import { progressCache } from '@/lib/progress-cache'

interface CompanyCardProps {
  company: CompanyWithStats
  solvedCount: number
}

export default function CompanyCard({ company, solvedCount }: CompanyCardProps) {
  const color = getCompanyColor(company.slug)
  const { totalCount, easyCount, mediumCount, hardCount } = company
  const total = (easyCount + mediumCount + hardCount) || 1
  const solvedPercent = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0

  const router = useRouter()
  // hasPrefetched guards against duplicate prefetch calls on repeated mouseenter
  const hasPrefetched = useRef(false)
  const handleMouseEnter = () => {
    if (hasPrefetched.current) return
    hasPrefetched.current = true
    router.prefetch(`/company/${company.slug}`)
    progressCache.prefetch(company.slug)
  }

  return (
    <Link href={`/company/${company.slug}`} prefetch={false} onMouseEnter={handleMouseEnter}>
      <div
        className="group relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#FFA116]/40 hover:bg-[#1e1e1e] transition-all duration-200 cursor-pointer h-full flex flex-col gap-3"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
      >
        {/* Header — avatar + name + count */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{
              backgroundColor: color + '1a',
              border: `1.5px solid ${color}55`,
              color,
            }}
          >
            {company.name.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate leading-tight">
              {company.name}
            </p>
            {totalCount > 0 ? (
              <p className="text-[#FFA116] text-xs tabular-nums mt-0.5 font-medium">
                {totalCount} problems
              </p>
            ) : (
              <p className="text-[#444] text-xs mt-0.5">No data</p>
            )}
          </div>
        </div>

        {/* Body */}
        {totalCount > 0 && (
          <>
            {/* Difficulty bar */}
            <div className="flex rounded-full overflow-hidden h-1.5 bg-[#2a2a2a]">
              <div
                style={{ width: `${(easyCount / total) * 100}%`, backgroundColor: '#00B8A3' }}
                title={`Easy: ${easyCount}`}
              />
              <div
                style={{ width: `${(mediumCount / total) * 100}%`, backgroundColor: '#FFB800' }}
                title={`Medium: ${mediumCount}`}
              />
              <div
                style={{ width: `${(hardCount / total) * 100}%`, backgroundColor: '#FF375F' }}
                title={`Hard: ${hardCount}`}
              />
            </div>

            {/* E / M / H counts */}
            <div className="flex items-center gap-2 text-xs tabular-nums">
              <span style={{ color: '#00B8A3' }} className="font-medium">{easyCount}</span>
              <span className="text-[#333]">/</span>
              <span style={{ color: '#FFB800' }} className="font-medium">{mediumCount}</span>
              <span className="text-[#333]">/</span>
              <span style={{ color: '#FF375F' }} className="font-medium">{hardCount}</span>

              {solvedCount > 0 && (
                <>
                  <span className="flex-1" />
                  <span className="text-green-400/80 font-medium">
                    {solvedCount} solved
                  </span>
                </>
              )}
            </div>

            {/* Progress bar — only shown when user has solved something */}
            {solvedCount > 0 && (
              <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden -mt-1">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${solvedPercent}%`, backgroundColor: '#00B8A3' }}
                />
              </div>
            )}
          </>
        )}

        {/* Hover glow */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,161,22,0.15)' }}
        />
      </div>
    </Link>
  )
}
