# High Level Design — Code Company Wise

## 1. System Overview

Code Company Wise is a full-stack web application that aggregates LeetCode company-wise interview questions from a public GitHub repository and lets authenticated users track their solving progress. It is a free alternative to LeetCode Premium's company filter feature.

**Key numbers:**
- 662 companies
- ~3,310 unique LeetCode problems across all company lists
- 5 time periods per company (30d, 3m, 6m, 6m+, all)
- ~40,936 company-problem mappings stored in the database
- ~666 statically generated pages at build time

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT BROWSER                             │
│                                                                     │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐ │
│  │  Home Page   │  │ Company Page  │  │  Auth Pages              │ │
│  │  (Static/CDN)│  │ (Static/CDN)  │  │  signin/signup/verify    │ │
│  └──────┬───────┘  └──────┬────────┘  └──────────────────────────┘ │
│         │                 │                                         │
│  ┌──────▼─────────────────▼──────────────────────────────────────┐ │
│  │              Client Components (React)                         │ │
│  │  CompanyGrid │ CompanyProgress │ ProblemTable │ SolveButton    │ │
│  └──────────────────────────┬───────────────────────────────────-┘ │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTPS API calls
┌─────────────────────────────▼───────────────────────────────────────┐
│                        VERCEL EDGE / SERVERLESS                      │
│                                                                      │
│  ┌─────────────┐   ┌────────────────────────────────────────────┐   │
│  │  Middleware  │   │              Next.js App Router             │   │
│  │  (Edge)      │   │                                             │   │
│  │  - JWT read  │   │  Server Components  │  API Routes           │   │
│  │  - Activity  │   │  (RSC, static)      │  (serverless fns)     │   │
│  │    tracking  │   └────────────────────────────────────────────┘   │
│  └─────────────┘                                                      │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │   Vercel Cron Jobs                                            │    │
│  │  0 9 * * *   UTC → /api/cron/reengagement  (daily)           │    │
│  │  0 0 * * 0   UTC → /api/cron/refresh-data  (weekly Sunday)   │    │
│  └──────────────────────────────────────────────────────────────┘    │
└───────────┬──────────────────────────────┬────────────────────────────┘
            │                              │
  ┌─────────▼──────────┐       ┌──────────▼──────────┐
  │  Supabase Postgres  │       │   Upstash Redis      │
  │                     │       │                      │
  │  User               │       │  Rate limit counters │
  │  OtpCode            │       │  (sliding window)    │
  │  Company            │       └─────────────────────┘
  │  Problem            │
  │  CompanyProblem     │       ┌─────────────────────┐
  │  UserSolvedProblem  │       │   Gmail SMTP         │
  └─────────────────────┘       │                      │
            │                   │  OTP emails          │
            │  (write path      │  Re-engagement       │
            │   only — weekly)  └─────────────────────┘
  ┌─────────▼──────────┐
  │   GitHub (raw CDN)  │
  │                     │
  │  CSV files per      │
  │  company/period     │
  │  Weekly cron only   │
  └─────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 14 (App Router) | SSG + RSC + API routes in one framework |
| Language | TypeScript | Type safety across full stack |
| Styling | Tailwind CSS | Utility-first, no runtime cost |
| Database | Supabase (PostgreSQL) | Managed Postgres, free tier, instant setup |
| ORM | Prisma 5 | Type-safe DB queries, migrations |
| Auth | NextAuth v5 (beta) | JWT sessions, credentials provider |
| Rate Limiting | Upstash Redis | Serverless-compatible sliding window |
| Email | Nodemailer + Gmail | Simple, no third-party email service needed |
| Hosting | Vercel | Zero-config Next.js, built-in cron, CDN |
| Data Source | PostgreSQL (DB-backed) | Seeded once from GitHub CSVs; zero runtime HTTP to GitHub |

---

## 4. Core Subsystems

### 4.1 Problem Data Pipeline (DB-backed)

**Critical change from v1:** The old architecture fetched GitHub CSVs at runtime using Next.js fetch cache (revalidate: 3600s). This created tight coupling to an external service and required 662 × 5 = 3,310 HTTP calls at build time. The new approach seeds all data into Postgres once and keeps it fresh via a weekly cron.

```
ONE-TIME SEED (scripts/seed.ts):
  GitHub Raw CDN (662 company directories × 5 period CSVs)
       │  fetch() with 15-concurrency worker pool
       ▼
  parseCSV() → [Company, Problem, CompanyProblem]
       │
       ▼  batch upsert in chunks of 500
  Postgres: 662 companies · 3,310 problems · 40,936 CompanyProblem rows

WEEKLY REFRESH (/api/cron/refresh-data — every Sunday 00:00 UTC):
  Same pipeline, incremental — skipDuplicates means safe to re-run
  Concurrency: 15 parallel GitHub CDN requests
  Returns: { companies, problems, mappings, durationMs }

RUNTIME (src/lib/companies.ts — ZERO GitHub HTTP calls):
  getCompanyList()              → prisma.company.findMany()
  getCompanyProblems(slug, per) → JOIN CompanyProblem + Problem WHERE company+period
  getCompanyStats(slug)         → difficulty counts, fallback period order
  getAllCompaniesWithStats()     → single $queryRaw for all 662 companies (home page)
```

### 4.2 Authentication System

Two sign-in paths share the same NextAuth Credentials provider:

```
Path A — New Registration:
  SignUp → POST /api/auth/register
         → User(emailVerified=false) created in DB
         → OtpCode(codeHash=SHA256(code)) stored
         → Email sent via Gmail
         → Redirect to /auth/verify
         → POST /api/auth/verify-otp
         → emailVerified=true, signInToken=randomBytes(32) generated
         → Client calls signIn('credentials', { email, signInToken })
         → NextAuth validates token, consumes it (single-use), returns JWT
         → JWT cookie set → authenticated

Path B — Returning User:
  SignIn → signIn('credentials', { email, password })
         → NextAuth bcrypt.compare(password, hash)
         → JWT cookie set → authenticated
```

### 4.3 Progress Tracking System (2-layer cache)

```
Layer 1: Module-level Map (progressCache)
  - Lives in browser memory for the tab session
  - Populated by single bulk API call on mount (fetchAllCompanyProgress)
  - Updated on every solve toggle
  - Makes all subsequent navigation instant (zero flash)

Layer 2: Supabase Postgres (source of truth)
  - UserSolvedProblem table with composite PK (userId, problemId)
  - Solving a problem marks it GLOBALLY — no company column
  - Company cross-reference done via JOIN through CompanyProblem at query time
  - Written on every solve/unsolve action
```

### 4.4 LeetCode Sync Subsystem (New)

Users who already have a LeetCode account can import their full solving history with one click.

```
User visits /dashboard/sync
  → pastes their LEETCODE_SESSION cookie value
  → POST /api/leetcode/sync { session }

  Server flow:
  1. LeetCode GraphQL API (questionList, status: AC, paginated 100/page)
     → full list of all accepted problems for the session
  2. prisma.problem.findMany({ where: { titleSlug: { in: solvedSlugs } } })
     → cross-reference against DB — single query, instant after seeding
  3. diff against existing UserSolvedProblem rows for this user
  4. batch insert new rows (500/batch, skipDuplicates: true)
  5. return SyncResult: { totalFetched, matchedInCompanies, notInAnyCompany,
                          newlyMarked, alreadySolved, companiesAffected, durationMs }

Preview endpoint (POST /api/leetcode/session-solved):
  Same LeetCode GraphQL call, NO DB writes — lets users preview before committing
```

### 4.5 Re-engagement Email Pipeline

```
User visits page
       │
       ▼
Middleware (Edge) reads JWT cookie
       │ if session exists AND _lat cookie ≠ today
       ▼
POST /api/internal/track-active  (fire-and-forget, doesn't block page)
       │
       ▼
User.lastActiveAt = NOW()
       │
       │  (next day, 09:00 UTC)
       ▼
Vercel Cron → GET /api/cron/reengagement
       │
       ▼  Raw SQL: lastActiveAt < 7d ago AND (reengageSentAt IS NULL OR reengageSentAt < lastActiveAt)
       │
       ▼
sendReengagementEmail() → Gmail SMTP
       │
       ▼
User.reengageSentAt = NOW()
```

---

## 5. Page Rendering Strategy

| Page | Strategy | Cache TTL | Reason |
|------|----------|-----------|--------|
| `/` | SSG (○) | 24 hours | getAllCompaniesWithStats() DB query baked at build |
| `/company/[slug]` | SSG (●) | 1 hour | 662 pages pre-built from DB; all 5 periods bundled |
| `/dashboard` | Dynamic (ƒ) | None | 4 parallel user-specific DB queries, force-dynamic |
| `/dashboard/sync` | SSG (○) | — | Pure client component, no server data |
| `/auth/signin` | SSG (○) | — | Static form, no data needed |
| `/auth/signup` | SSG (○) | — | Static form |
| `/auth/verify` | SSG (○) | — | Suspense-wrapped, reads URL params client-side |
| `/api/*` | Dynamic (ƒ) | None | All API routes are serverless functions |

**Critical insight:** The layout (`RootLayout`) is static because `Navbar` uses `useSession()` (client-side) instead of `await auth()` (server-side). This means the home page is CDN-served globally, reducing TTFB from ~3.6s to <100ms.

**Build behaviour:** `generateStaticParams()` calls `getCompanyList()` (Prisma, not GitHub), so build-time data comes from the DB. This means build output is correct even if GitHub is temporarily unreachable.

---

## 6. Caching Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CACHING LAYERS                            │
│                                                             │
│  Browser Tab Memory (progressCache module)                  │
│  ├── solvedByCompany: Record<slug, count>                   │
│  │   Populated by single /api/user-progress call on mount   │
│  └── per-company: { solvedCount, solvedIds[] }              │
│      Populated on company hover prefetch / page visit       │
│      Persists across navigations within the tab             │
│                                                             │
│  Vercel CDN / Edge Cache                                    │
│  ├── / → 24h (revalidate: 86400)                           │
│  └── /company/[slug] → 1h (revalidate: 3600)               │
│                                                             │
│  Supabase Postgres (source of truth — no fetch cache)       │
│  ├── Problem data — read by Server Components at build      │
│  ├── User progress — read by API routes at request time     │
│  └── No Next.js fetch cache needed: Prisma is direct TCP    │
│                                                             │
│  Upstash Redis (rate limiting only)                        │
│  └── Sliding window counters, auto-expire                  │
└─────────────────────────────────────────────────────────────┘
```

**Note:** The old architecture had a "Next.js Server Fetch Cache" layer for GitHub CSV data. This layer no longer exists for problem data. All problem data reads go directly to Postgres via Prisma.

---

## 7. Security Architecture

| Threat | Mitigation |
|--------|-----------|
| Brute force registration | Rate limit: 5 req/hr per IP (Upstash) |
| OTP brute force | 5 attempt limit per OTP record + rate limit: 10 req/10min per IP |
| OTP interception | SHA-256 hashed before DB storage, 10-minute expiry |
| Password exposure | bcrypt (cost 12) before storage, never logged |
| signInToken theft | 32-byte random token, 5-minute expiry, single-use (consumed on first use) |
| Unverified sign-in | `emailVerified=false` blocks auth entirely |
| Solve spam | Rate limit: 60 req/min per user |
| Resend flooding | Rate limit: 3 req/10min per email |
| Internal endpoint abuse | `x-internal-secret` header required on `/api/internal/*` |
| Cron endpoint abuse | `Authorization: Bearer <CRON_SECRET>` required (both cron routes) |
| Email unsubscribe forgery | HMAC-SHA256 signed token (keyed with AUTH_SECRET) |
| SQL injection | Prisma parameterized queries throughout; raw queries use tagged template literals |
| XSS | React's JSX escaping + no `dangerouslySetInnerHTML` |

---

## 8. External Service Dependencies

| Service | Usage | Failure Mode |
|---------|-------|-------------|
| GitHub (raw CDN) | Weekly data refresh cron only — NOT in the runtime request path | Cron run skips; DB retains previous data; site fully functional |
| Supabase Postgres | All problem data + user/solve data | API routes return 500; pre-built static pages still served from CDN |
| Upstash Redis | Rate limiting | `createRateLimiter()` returns null — rate limiting disabled, site still works |
| Gmail SMTP | OTP + re-engagement emails | Registration fails gracefully with error message |
| Vercel Cron | Daily re-engagement + weekly data refresh | Emails/refresh skip that run — no data loss |
| LeetCode GraphQL | LeetCode Sync feature only — user-initiated | Sync endpoint returns 401/502; rest of app unaffected |

---

## 9. Scalability Analysis

| Scale | Bottleneck | Solution |
|-------|-----------|---------|
| 1K users | None — static pages handle any load | — |
| 10K users | Supabase free tier connection limits | Upgrade to Supabase Pro, connection pooler already configured |
| 100K users | UserSolvedProblem table (100K users × 300 avg solves = 30M rows) | Composite PK index `(userId, problemId)` already exists; reads are O(log n) |
| 100K users | Daily cron emails (100 batch limit per run) | `LIMIT 100` per run means backlog builds up; increase batch or schedule more frequently |
| 1M users | Single Postgres instance | Read replicas, or move to PlanetScale/Neon with branching |
| Any scale | GitHub CSV dependency (weekly cron) | Mirror CSVs to own S3/CDN if GitHub rate-limits the cron |

---

## 10. Deployment Architecture

```
GitHub (main branch)
       │  push
       ▼
Vercel CI/CD
  ├── npm run build (prisma generate + next build)
  ├── generateStaticParams() → getCompanyList() → Prisma → 662 company slugs
  ├── Generates ~666 static pages (662 company + home + auth + error pages)
  └── Deploys to Vercel Edge Network (global CDN)
       │
       ├── Static pages → served from CDN nodes globally
       ├── API routes → Node.js serverless functions (us-east-1 default)
       └── Middleware → Edge runtime (runs at CDN edge)

Vercel Cron Jobs (vercel.json):
  ├── /api/cron/reengagement → 0 9 * * *   (daily 09:00 UTC)
  └── /api/cron/refresh-data → 0 0 * * 0   (weekly Sunday midnight UTC)

Environment:
  Production: Vercel (env vars in Vercel dashboard)
  Development: .env.local (DATABASE_URL, DIRECT_URL, GMAIL_*, AUTH_SECRET,
               INTERNAL_SECRET, CRON_SECRET, UPSTASH_*, NEXTAUTH_URL)
```

---

## 11. Data Flow Diagrams

### Home Page Load
```
Browser → Vercel CDN
  CDN hit? → serve HTML instantly (<100ms TTFB)
  CDN miss? → Next.js revalidates: getAllCompaniesWithStats() (single Prisma $queryRaw)
              → rebuild page → fill CDN cache

Browser renders → CompanyGrid (client component, logged in)
  → fetch('/api/user-progress')                  [single request for ALL 662 companies]
  → populate solvedByCompany in progressCache
  → render solved counts on company cards
  → on card hover: progressCache.prefetch(slug) + router.prefetch(slug)
                   [no scroll-triggered requests]
```

### Company Page Load
```
Browser → Vercel CDN
  → serve pre-built HTML (all 5 periods baked in from DB at build time)

Browser renders → CompanyProgress (via useCompanyProgress hook)
  progressCache.get(slug)?
    YES → render solved state instantly (zero API call)
    NO  → fetch('/api/user-progress?company=slug')
          → populate cache → render solved state
```

### Solve a Problem
```
User clicks SolveButton
  → optimistic update (UI shows solved immediately)
  → POST /api/solve { problemId }   [no company field]
      → auth() check
      → rate limit check (Upstash)
      → prisma.userSolvedProblem.upsert(userId, problemId)
  → progressCache updated in memory (solvedIds + solvedCount)
  → if error: revert optimistic update
```

### LeetCode Sync
```
User visits /dashboard/sync → pastes LEETCODE_SESSION
  → POST /api/leetcode/sync { session }
      → LeetCode GraphQL: all AC problems (paginated 100/page)
      → prisma.problem.findMany(titleSlug IN solvedSlugs)
      → diff against existing UserSolvedProblem for this user
      → batch insert new rows (500/batch, skipDuplicates: true)
      → return SyncResult stats
  → UI shows: newlyMarked / alreadySolved / companiesAffected
```
