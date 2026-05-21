'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function CompanyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 pt-14">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-white text-lg font-semibold mb-2">Could not load problems</h2>
        <p className="text-gray-400 text-sm mb-6">
          GitHub data source may be temporarily unavailable. Try again or go back to browse companies.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-[#FFA116] hover:bg-[#FFB84D] text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Back to companies
          </Link>
        </div>
      </div>
    </main>
  )
}
