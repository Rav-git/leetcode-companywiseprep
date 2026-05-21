'use client'

import { useState } from 'react'
import { CompanyWithStats } from '@/types'
import CompanyCard from './CompanyCard'

interface Props {
  companies: CompanyWithStats[]
  solvedByCompany: Record<string, number>
}

export default function CompanyGrid({ companies, solvedByCompany }: Props) {
  const [search, setSearch] = useState('')

  const filtered = companies.filter(
    c => search === '' || c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-sm bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
        />
        <p className="text-gray-500 text-sm whitespace-nowrap">
          Showing {filtered.length} of {companies.length} companies
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map(company => (
          <CompanyCard
            key={company.slug}
            company={company}
            solvedCount={solvedByCompany[company.slug] ?? 0}
          />
        ))}
      </div>
    </div>
  )
}
