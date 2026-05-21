'use client'

import { useState, type MouseEvent } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Props {
  problemId: number
  problemSlug: string
  company: string
  difficulty: string
  initialSolved: boolean
}

export default function SolveButton({
  problemId,
  problemSlug,
  company,
  difficulty,
  initialSolved,
}: Props) {
  const [solved, setSolved] = useState(initialSolved)
  const [loading, setLoading] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()

    if (!session) {
      router.push('/api/auth/signin')
      return
    }

    const newSolved = !solved
    setSolved(newSolved)
    setLoading(true)

    try {
      const res = await fetch('/api/solve', {
        method: newSolved ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, problemSlug, company, difficulty }),
      })

      if (!res.ok) {
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
      onClick={handleClick}
      disabled={loading}
      title={solved ? 'Mark as unsolved' : 'Mark as solved'}
      className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors disabled:opacity-50 ${
        solved
          ? 'bg-green-600 hover:bg-green-700'
          : 'border border-gray-700 hover:border-green-600 text-gray-600 hover:text-green-500'
      }`}
    >
      <svg
        className={`w-4 h-4 ${solved ? 'text-white' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={solved ? 2.5 : 2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    </button>
  )
}
