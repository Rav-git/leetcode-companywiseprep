'use client'

import { useState, type ChangeEvent } from 'react'
import Link from 'next/link'

interface UnmatchedProblem { frontendQuestionId: string; title: string; titleSlug: string; difficulty: string }
interface SyncResult {
  totalFetched: number; companiesIndexed: number; matchedInCompanies: number
  notInAnyCompany: UnmatchedProblem[]; newlyMarked: number; alreadySolved: number
  companiesAffected: number; durationMs: number
}

const DIFF_COLOR: Record<string, string> = { Easy: '#00B8A3', Medium: '#FFB800', Hard: '#FF375F' }

export default function SyncPage() {
  const [session,    setSession]    = useState('')
  const [stage,      setStage]      = useState<'idle' | 'syncing' | 'synced'>('idle')
  const [error,      setError]      = useState('')
  const [result,     setResult]     = useState<SyncResult | null>(null)
  const [search,     setSearch]     = useState('')

  const handleSync = async () => {
    setStage('syncing'); setError(''); setResult(null)
    try {
      const res  = await fetch('/api/leetcode/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: session.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setResult(data); setStage('synced')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
      setStage('idle')
    }
  }

  const filteredNotIn = (result?.notInAnyCompany ?? []).filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.frontendQuestionId.includes(search)
  )

  return (
    <main className="min-h-screen pt-14" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">

        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm mb-5 px-3 py-2 -ml-3 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'rgba(235,235,245,0.45)' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">LeetCode Sync</h1>
          <p className="text-sm" style={{ color: 'rgba(235,235,245,0.45)' }}>Import your solved problems and mark them across every matching company</p>
        </div>

        {/* Input */}
        {stage === 'idle' && (
          <div className="rounded-xl p-6 mb-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <p className="text-sm font-semibold text-white mb-1">Paste your LEETCODE_SESSION cookie</p>
            <p className="text-xs mb-4" style={{ color: 'rgba(235,235,245,0.4)' }}>
              leetcode.com → F12 → Application → Cookies → copy the value of <span style={{ color: '#FFA116' }}>LEETCODE_SESSION</span>
            </p>
            <div className="flex gap-2">
              <input
                type="password" value={session}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSession(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && session.trim() && handleSync()}
                placeholder="Paste here…"
                className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ backgroundColor: '#111', border: '1px solid #2a2a2a', color: 'rgba(235,235,245,0.9)' }}
              />
              <button onClick={handleSync} disabled={!session.trim()}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ backgroundColor: '#FFA116', color: '#000' }}>
                Sync
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl px-4 py-3 mb-5 text-sm" style={{ backgroundColor: 'rgba(255,55,95,0.08)', border: '1px solid rgba(255,55,95,0.2)', color: '#FF375F' }}>
            {error}
          </div>
        )}

        {/* Syncing */}
        {stage === 'syncing' && (
          <div className="rounded-xl p-10 flex flex-col items-center gap-3" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#FFA116', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'rgba(235,235,245,0.45)' }}>Syncing your solved problems…</p>
          </div>
        )}

        {/* Results */}
        {stage === 'synced' && result && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {([
                ['Newly Marked',       result.newlyMarked,            '#FFA116'],
                ['Already Solved',     result.alreadySolved,          '#00B8A3'],
                ['Companies Updated',  result.companiesAffected,      '#A78BFA'],
                ['Matched in Cos.',    result.matchedInCompanies,     'rgba(235,235,245,0.4)'],
                ['Not in Any Company', result.notInAnyCompany.length, 'rgba(235,235,245,0.4)'],
                ['Total Fetched',      result.totalFetched,           'rgba(235,235,245,0.4)'],
              ] as const).map(([label, value, color]) => (
                <div key={label} className="rounded-xl p-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                  <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: 'rgba(235,235,245,0.3)' }}>{label}</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            <p className="text-xs mb-5" style={{ color: 'rgba(235,235,245,0.2)' }}>
              Completed in {(result.durationMs / 1000).toFixed(1)}s
            </p>

            <button onClick={() => { setResult(null); setStage('idle'); setSession('') }}
              className="px-5 py-2.5 rounded-lg text-sm font-medium mb-6 transition-colors hover:bg-white/5"
              style={{ border: '1px solid #2a2a2a', color: 'rgba(235,235,245,0.5)' }}>
              ← Sync Again
            </button>

            {result.notInAnyCompany.length > 0 && (
              <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-semibold text-white text-sm">Not in any company list ({result.notInAnyCompany.length})</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(235,235,245,0.3)' }}>These problems aren&apos;t in any company&apos;s interview list.</p>
                  </div>
                  <input type="text" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    placeholder="Search…" className="rounded-lg px-3 py-1.5 text-sm outline-none w-36"
                    style={{ backgroundColor: '#111', border: '1px solid #2a2a2a', color: 'rgba(235,235,245,0.9)' }} />
                </div>
                <div className="divide-y" style={{ borderColor: '#222' }}>
                  {filteredNotIn.map(p => (
                    <div key={p.frontendQuestionId} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs tabular-nums flex-shrink-0 w-10 text-right" style={{ color: 'rgba(235,235,245,0.2)' }}>#{p.frontendQuestionId}</span>
                        <a href={`https://leetcode.com/problems/${p.titleSlug}/`} target="_blank" rel="noopener noreferrer"
                          className="text-sm truncate hover:text-white transition-colors" style={{ color: 'rgba(235,235,245,0.5)' }}>
                          {p.title}
                        </a>
                      </div>
                      <span className="text-xs font-medium flex-shrink-0" style={{ color: DIFF_COLOR[p.difficulty] ?? '#888' }}>{p.difficulty}</span>
                    </div>
                  ))}
                  {filteredNotIn.length === 0 && <p className="py-6 text-center text-sm" style={{ color: 'rgba(235,235,245,0.3)' }}>No matches</p>}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </main>
  )
}
