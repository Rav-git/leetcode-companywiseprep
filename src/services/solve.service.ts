// Central module for all /api/solve calls — keeps fetch logic out of SolveButton

export async function markSolved(problemId: number): Promise<boolean> {
  const res = await fetch('/api/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId }),
  })
  return res.ok
}

export async function markUnsolved(problemId: number): Promise<boolean> {
  const res = await fetch('/api/solve', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId }),
  })
  return res.ok
}
