'use client'

import { useState, useEffect, type MouseEvent } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { markSolved, markUnsolved } from '@/services/solve.service'

interface SolveButtonProps {
  problemId: number
  company: string
  initialSolved: boolean
  onToggle: (solved: boolean) => void
}

export default function SolveButton({ problemId, company, initialSolved, onToggle }: SolveButtonProps) {
  const [solved, setSolved] = useState(initialSolved)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Don't overwrite optimistic state mid-request — only sync when idle
    if (!loading) setSolved(initialSolved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSolved])

  const { data: session } = useSession()
  const router = useRouter()

  const handleSolveToggle = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()

    if (!session) {
      // /api/auth/signin is the NextAuth internal handler, not the UI page
      router.push('/auth/signin')
      return
    }

    const newSolved = !solved
    setSolved(newSolved)
    setLoading(true)

    try {
      const ok = newSolved
        ? await markSolved(problemId, company)
        : await markUnsolved(problemId, company)

      if (ok) {
        onToggle(newSolved)
      } else {
        setSolved(!newSolved)
      }
    } catch {
      setSolved(!newSolved)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSolveToggle}
      disabled={loading}
      title={solved ? 'Mark as unsolved' : 'Mark as solved'}
      className="flex items-center justify-center w-7 h-7 rounded-full transition-all disabled:opacity-50"
      style={solved ? {
        backgroundColor: 'rgba(0,184,163,0.15)',
        border: '1.5px solid rgba(0,184,163,0.5)',
      } : {
        border: '1.5px solid #3e3e3e',
      }}
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke={solved ? '#00B8A3' : '#555'}
        strokeWidth={solved ? 2.5 : 2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  )
}
