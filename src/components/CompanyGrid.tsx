'use client'

import { useState, useEffect } from 'react'
import { CompanyWithStats } from '@/types'
import CompanyCard from './CompanyCard'

interface Props {
  companies: CompanyWithStats[]
}

export default function CompanyGrid({ companies }: Props) {
  const [search, setSearch] = useState('')
  const [solvedByCompany, setSolvedByCompany] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/user-progress')
      .then(r => r.json())
      .then(d => { if (d.solvedByCompany) setSolvedByCompany(d.solvedByCompany) })
      .catch(() => {})
  }, [])

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
          className="flex-1 max-w-sm rounded-lg px-4 py-2 text-sm text-white outline-none transition-all"
          style={{ backgroundColor: '#282828', border: '1px solid #3e3e3e' }}
          onFocus={e => (e.currentTarget.style.borderColor = '#FFA116')}
          onBlur={e => (e.currentTarget.style.borderColor = '#3e3e3e')}
        />
        <p className="text-sm whitespace-nowrap" style={{ color: 'rgba(235,235,245,0.35)' }}>
          Showing {filtered.length} of {companies.length} companies
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
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
