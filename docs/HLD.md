# High Level Design — Code Company Wise

## 1. System Overview

Code Company Wise is a full-stack web application that aggregates LeetCode company-wise interview questions from a public GitHub repository and lets authenticated users track their solving progress. It is a free alternative to LeetCode Premium's company filter feature.

**Key numbers:**
- 662 companies
- ~3,000 unique LeetCode problems
- 5 time periods per company (30d, 3m, 6m, 6m+, all)
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
│  │  CompanyGrid │ CompanyPageClient │ ProblemTable │ SolveButton  │ │
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
│  ┌──────────────────────┐   ┌──────────────────────────────────────┐ │
│  │   Vercel Cron        │   │         Next.js Fetch Cache           │ │
│  │  0 9 * * * UTC       │   │  GitHub data revalidated every 1-24h  │ │
│  │  /api/cron/          │   └──────────────────────────────────────┘ │
│  │  reengagement        │                                             │
│  └──────────────────────┘                                             │
└───────────┬──────────────────────────────┬────────────────────────────┘
            │                              │
  ┌─────────▼──────────┐       ┌──────────▼──────────┐
  │  Supabase Postgres  │       │   Upstash Redis      │
  │                     │       │                      │
  │  User               │       │  Rate limit counters │
  │  OtpCode            │       │  (sliding window)    │
  │  SolvedProblem      │       └─────────────────────┘
  └─────────────────────┘
            │
  ┌─────────▼──────────┐       ┌─────────────────────┐
  │   GitHub (raw CDN)  │       │   Gmail SMTP         │
  │                     │       │                      │
  │  CSV files per      │       │  OTP emails          │
  │  company/period     │       │  Re-engagement       │
  └─────────────────────┘       └─────────────────────┘
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
| Data Source | GitHub (public repo) | Free LeetCode company-wise CSV data |

---

## 4. Core Subsystems

### 4.1 Problem Data Pipeline (Read-only, No DB)

```
GitHub Repo (CSV files)
       │
       ▼  fetch() with Next.js cache (revalidate: 3600s)
fetchProblems(slug, period)
       │
       ▼  parsed in-process
Problem[]  ──► baked into static pages at build time (generateStaticParams)
               ──► 662 company pages × 5 periods = pre-fetched at build
```

**Critical:** `generateStaticParams()` returns `{ slug }` only — ONE page per company, not one per period. All 5 period datasets are fetched in parallel at build time and bundled as props into that single page. The only DB interaction is user solve state.

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

### 4.3 Progress Tracking System (3-layer cache)

```
Layer 1: Module-level Map (progressCache)
  - Lives in browser memory for the tab session
  - Populated on first API call, updated on every solve toggle
  - Makes all subsequent navigation instant (zero flash)

Layer 2: Next.js Fetch Cache
  - GitHub CSV data cached server-side (1h revalidation)
  - No caching on user progress API (user-specific, dynamic)

Layer 3: Supabase (source of truth)
  - SolvedProblem table with index on (userId, company)
  - Written on every solve/unsolve action
```

### 4.4 Re-engagement Email Pipeline

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
| `/` | SSG (○) | 24 hours | Company list + stats baked at build |
| `/company/[slug]` | SSG (●) | 1 hour | 662 pages pre-built, revalidated hourly |
| `/auth/signin` | SSG (○) | — | Static form, no data needed |
| `/auth/signup` | SSG (○) | — | Static form |
| `/auth/verify` | SSG (○) | — | Suspense-wrapped, reads URL params client-side |
| `/dashboard` | Dynamic (ƒ) | None | User-specific data, force-dynamic |
| `/api/*` | Dynamic (ƒ) | None | All API routes are serverless functions |

**Critical insight:** The layout (`RootLayout`) is static because `Navbar` uses `useSession()` (client-side) instead of `await auth()` (server-side). This means the home page is CDN-served globally, reducing TTFB from ~3.6s to <100ms.

---

## 6. Caching Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CACHING LAYERS                            │
│                                                             │
│  Browser Tab Memory (progressCache module)                  │
│  ├── solvedByCompany: Record<slug, count>                   │
│  └── per-company: { solvedCount, solvedIds[] }              │
│      Populated on first visit, persists across navigations  │
│                                                             │
│  Vercel CDN / Edge Cache                                    │
│  ├── / → 24h (revalidate: 86400)                           │
│  └── /company/[slug] → 1h (revalidate: 3600)               │
│                                                             │
│  Next.js Server Fetch Cache                                 │
│  ├── fetchCompanyList() → 24h                              │
│  ├── fetchProblems(slug, period) → 1h                      │
│  └── fetchCompanyStats(slug) → 24h                         │
│                                                             │
│  Upstash Redis (rate limiting only)                        │
│  └── Sliding window counters, auto-expire                  │
└─────────────────────────────────────────────────────────────┘
```

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
| Cron endpoint abuse | `Authorization: Bearer <CRON_SECRET>` required |
| Email unsubscribe forgery | HMAC-SHA256 signed token (keyed with AUTH_SECRET) |
| SQL injection | Prisma parameterized queries throughout; raw queries use tagged template literals |
| XSS | React's JSX escaping + no `dangerouslySetInnerHTML` |

---

## 8. External Service Dependencies

| Service | Usage | Failure Mode |
|---------|-------|-------------|
| GitHub (raw CDN) | Problem CSV data | Next.js returns stale cache or empty array — site still works, shows no problems |
| Supabase Postgres | User/solve data | API routes return 500; static pages unaffected |
| Upstash Redis | Rate limiting | `createRateLimiter()` returns null — rate limiting disabled, site still works |
| Gmail SMTP | OTP + re-engagement emails | Registration fails gracefully with error message |
| Vercel Cron | Daily re-engagement | Emails skip that day — no data loss |

---

## 9. Scalability Analysis

| Scale | Bottleneck | Solution |
|-------|-----------|---------|
| 1K users | None — static pages handle any load | — |
| 10K users | Supabase free tier connection limits | Upgrade to Supabase Pro, connection pooler already configured |
| 100K users | SolvedProblem table (10M rows at avg 100 solves/user) | Index on (userId, company) already exists; read is O(log n) |
| 100K users | Daily cron emails (100 batch limit) | `LIMIT 100` per run means backlog builds up; increase batch or run more frequently |
| 1M users | GitHub CSV fetching | Mirror CSVs to own S3/CDN, remove GitHub dependency |
| 1M users | Single Postgres instance | Read replicas, or move to PlanetScale/Neon with branching |

---

## 10. Deployment Architecture

```
GitHub (main branch)
       │  push
       ▼
Vercel CI/CD
  ├── npm run build (prisma generate + next build)
  ├── Generates ~666 static pages (662 company + home + auth + error pages)
  └── Deploys to Vercel Edge Network (global CDN)
       │
       ├── Static pages → served from CDN nodes globally
       ├── API routes → Node.js serverless functions (us-east-1 default)
       └── Middleware → Edge runtime (runs at CDN edge)

Vercel Cron Jobs:
  └── /api/cron/reengagement → 0 9 * * * (daily 09:00 UTC)

Environment:
  Production: Vercel (env vars in Vercel dashboard)
  Development: .env.local (DATABASE_URL, DIRECT_URL, GMAIL_*, AUTH_SECRET, etc.)
```

---

## 11. Data Flow Diagrams

### Home Page Load
```
Browser → Vercel CDN
  CDN hit? → serve HTML instantly (<100ms TTFB)
  CDN miss? → Next.js revalidates: fetchCompanyList() + fetchCompanyStats(×662) → rebuild page

Browser renders → CompanyGrid (client component)
  → fetch('/api/user-progress') [if logged in]
  → populate solvedByCompany in progressCache
  → render solved counts on company cards
```

### Company Page Load
```
Browser → Vercel CDN
  → serve pre-built HTML (all 5 periods baked in)

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
  → POST /api/solve { problemId, company }
      → auth() check
      → rate limit check (Upstash)
      → prisma.solvedProblem.upsert()
  → progressCache.set() updated in memory
  → HTTP cache invalidation (fetch with cache:'reload')
```
