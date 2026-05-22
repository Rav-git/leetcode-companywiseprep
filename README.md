# Code Company Wise — LeetCode Company-Wise Interview Prep

Browse real LeetCode Premium company tags, filter by time period, and track your solved problems per company — all for free.

**Live:** [code-company-wise.vercel.app](https://code-company-wise.vercel.app)

---

## What it does

LeetCode Premium charges $35/month to see which companies ask which problems. This tool surfaces that data for free using a community-maintained dataset, and layers a full user system on top so you can track exactly what you've solved at each company.

---

## Features

- **662+ companies** — every company in the dataset with difficulty stats (Easy / Medium / Hard counts) pre-loaded at build time; no GitHub API calls at runtime
- **All time periods pre-fetched** — 30 Days / 3 Months / 6 Months / 6+ Months / All Time problem sets are all fetched at build time per company; switching tabs is always instant with zero loading spinners
- **Problem table** — paginated (30/page), filterable by difficulty, searchable by title or ID
- **Frequency bar** — visual indicator of how often each problem appears in interviews
- **Solve tracking** — mark/unmark problems as solved with optimistic UI; persists to PostgreSQL; solved state (checkmarks, row highlights, "X solved" count) updates instantly without a page refresh
- **Progress bars** — per-company progress bar on every card (home grid) and on the company detail page; both update instantly when problems are solved
- **Instant navigation** — in-memory client cache pre-warmed on home page load; clicking any previously-solved company shows progress and checkmarks with zero delay
- **Viewport-based rendering** — home grid renders 50 cards at a time via IntersectionObserver sentinel; remaining cards load as the user scrolls
- **Dashboard** — total solved, Easy/Medium/Hard breakdown, top companies practiced, recent activity feed, streak counter
- **Email OTP auth** — two-step sign-up: register → 6-digit OTP email → verify → auto sign-in (plain-text password never stored client-side)
- **Rate limiting** — Upstash Redis sliding-window on all sensitive routes (optional, graceful no-op if not configured)
- **Error boundaries** — graceful fallback UI if the GitHub data source is unavailable

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, SSG + ISR) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3.4 |
| Auth | NextAuth.js v5 (Auth.js) — JWT strategy, Credentials provider |
| ORM | Prisma v5 |
| Database | PostgreSQL (Supabase) |
| Email | Nodemailer + Gmail SMTP |
| Rate limiting | Upstash Redis (optional) |
| Deployment | Vercel |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCE                              │
│                                                                 │
│  GitHub: snehasishroy/leetcode-companywise-interview-questions  │
│                                                                 │
│  ┌──────────────────────┐    ┌─────────────────────────────┐   │
│  │  Repo HTML page      │    │  Raw CSV files              │   │
│  │  (company list)      │    │  /{company}/{period}.csv    │   │
│  │  revalidate: 24h     │    │  revalidate: 1h             │   │
│  └──────────┬───────────┘    └──────────────┬──────────────┘   │
└─────────────┼──────────────────────────────-┼──────────────────┘
              │  Fetched at BUILD TIME only    │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      src/lib/github.ts                          │
│                                                                 │
│  fetchCompanyList()      fetchCompanyStats(slug)                │
│  → parse embedded JSON   → count Easy/Medium/Hard              │
│  → filter directories                                           │
│                          fetchProblems(slug, period)            │
│                          → parse CSV → Problem[]               │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼─────────────────────┐
         ▼                   ▼                     ▼
  app/page.tsx       app/company/[slug]      app/dashboard
  (○ static ISR)     (● SSG, 662 pages)      (dynamic, auth required)
  revalidate 24h     revalidate 1h
  no auth/DB         no auth/DB server-side
         │                   │
         │           CompanyPageClient (client)
         │           → reads progressCache first (instant)
         │           → fetches /api/user-progress on cache miss
         │           → owns solvedSet + solvedCount state
         │           → progress bar + ProblemTable share state
         │
  CompanyGrid (client)
  → fetches /api/user-progress on mount (solvedByCompany counts)
  → pre-warms progressCache for all companies with solved > 0
  → IntersectionObserver sentinel: renders 50 cards at a time

┌───────────────────────────┐   ┌──────────────────────────────┐
│       AUTH LAYER          │   │      DATABASE LAYER           │
│                           │   │      Supabase PostgreSQL      │
│  Auth.js v5 — JWT         │   │                               │
│  Credentials provider     │   │  User                         │
│  bcrypt cost 12           │   │  OtpCode                      │
│  trustHost: true          │   │  SolvedProblem                │
│  One-time signInToken     │   │                               │
│  (post-OTP auto sign-in)  │   │                               │
└───────────────────────────┘   └──────────────────────────────┘
```

### Static Generation Strategy

All GitHub data is fetched at **build time**, not at request time:

| Page | Rendering | GitHub calls at runtime |
|---|---|---|
| `/` (home) | `○` Static ISR (revalidate 24h) | None — stats baked in |
| `/company/[slug]` | `●` SSG via `generateStaticParams` (revalidate 1h) | None — all 5 periods baked in |
| `/dashboard` | `ƒ` Dynamic (auth required) | None |

Each company page pre-fetches all 5 time periods (30 Days, 3 Months, 6 Months, 6+ Months, All Time) in parallel at build time. The client-side period cache is pre-seeded with all of them — tab switching is always instant.

User-specific data (solved counts, progress) is always fetched client-side after hydration via `/api/user-progress`, keeping static pages user-agnostic while still showing personalised state.

### Client-Side Progress Cache

```
src/lib/progress-cache.ts — module-level Map, persists across navigations within the same tab

Home page load
  CompanyGrid → GET /api/user-progress
  → { solvedByCompany: { amazon: 11, google: 3 } }
  → progressCache.prefetch('amazon')  ← background fetch, stored in Map
  → progressCache.prefetch('google')  ← background fetch, stored in Map

User clicks Amazon
  CompanyPageClient → progressCache.get('amazon') → HIT
  → useState initialised with cached solvedIds instantly
  → useEffect: cache hit → skips fetch entirely
  → progress bar + checkmarks appear with zero delay ✓

User solves a problem
  → React state updates instantly (optimistic)
  → progressCache.set updated in sync
  → background: fetch(url, { cache:'reload' }) — invalidates HTTP cache for hard refresh
```

---

## Database Schema

```prisma
model User {
  id                String          @id @default(cuid())
  name              String?
  email             String?         @unique
  password          String?         // bcrypt hash, cost 12
  image             String?
  createdAt         DateTime        @default(now())
  signInToken       String?         // one-time token for post-OTP auto sign-in
  signInTokenExpiry DateTime?       // expires 5 minutes after issue
  solvedProblems    SolvedProblem[]
}

// Holds pending registration until OTP is verified, then deleted
model OtpCode {
  id        String   @id @default(cuid())
  email     String
  name      String?
  password  String   // bcrypt hash stored here before User is created
  code      String   // 6-digit random OTP
  attempts  Int      @default(0)  // record deleted after 5 wrong attempts
  expiresAt DateTime               // 10 minutes from creation
  createdAt DateTime @default(now())

  @@index([email])
}

model SolvedProblem {
  id          String   @id @default(cuid())
  userId      String
  problemId   Int
  problemSlug String
  company     String
  difficulty  String
  solvedAt    DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, problemId, company])
  @@index([userId, company])
}
```

---

## Authentication Flow

```
SIGN UP
  │
  ├── POST /api/auth/register
  │     validate input → hash password (bcrypt 12)
  │     → generate 6-digit OTP → store in OtpCode (10 min expiry)
  │     → send email via Gmail SMTP
  │
  ├── User enters OTP at /auth/verify
  │
  ├── POST /api/auth/verify-otp
  │     check attempts < 5 → check expiry → compare code
  │     → create User record → generate signInToken (32 random bytes, 5 min expiry)
  │     → delete OtpCode → return { signInToken, email }
  │
  └── Client calls signIn('credentials', { email, signInToken })
        NextAuth authorize() verifies token → deletes it (single use) → issues JWT

SIGN IN (returning user)
  └── signIn('credentials', { email, password })
        NextAuth authorize() → bcrypt.compare → issues JWT
```

**Security decisions:**
| Concern | Solution |
|---|---|
| Password in sessionStorage | Replaced with server-issued one-time `signInToken` |
| OTP brute force | Locked after 5 wrong attempts, record deleted |
| Email / OTP spam | Upstash rate limits: 5 reg/hr, 10 verify/10min, 3 resend/10min |
| DB spam from solve toggle | Rate limit: 60 solve actions/min per user |
| signInToken replay | Single-use, consumed immediately on first valid use |
| Auth.js host validation | `trustHost: true` in config — works on Vercel and local `next start` |

---

## Solve Tracking Flow

```
User clicks ✓ on a problem
  ├── Optimistic update: SolveButton flips to solved instantly
  ├── POST /api/solve { problemId, problemSlug, company, difficulty }
  │     auth() required → rate limit → prisma.solvedProblem.upsert()
  │     unique on (userId, problemId, company)
  ├── Success
  │     → onToggle(solved) callback fires
  │     → CompanyPageClient.handleSolveToggle(problemId, solved)
  │         → setSolvedSet (updates row highlight + checkmarks)
  │         → setSolvedCount (updates progress bar count + percentage)
  │         → progressCache.set (keeps in-memory cache in sync)
  │         → fetch(url, { cache:'reload' }) (invalidates HTTP cache)
  │     All UI updates are instant, no extra API call needed
  └── Failure → SolveButton reverts to previous state

User clicks ✓ again (un-solve)
  └── DELETE /api/solve → prisma.solvedProblem.deleteMany()
        → same callback chain, decrements solvedCount

On page load (static page hydration)
  └── CompanyPageClient mounts
        → progressCache.get(slug) — synchronous lookup
        → HIT: useState initialised with cached data, no fetch
        → MISS: GET /api/user-progress?company=slug
              → stores result in progressCache for future navigations
```

---

## API Routes

| Method | Route | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | — | 5/hr per IP | Create OtpCode, send OTP email |
| POST | `/api/auth/verify-otp` | — | 10/10min per IP | Verify OTP, create User, return signInToken |
| POST | `/api/auth/resend-otp` | — | 3/10min per email | Regenerate OTP, reset attempt counter |
| GET | `/api/problems?slug=&period=` | — | — | Fetch problems from GitHub CSV (used on period switch if not pre-seeded) |
| GET | `/api/user-progress?company=` | Required | — | Return solvedIds + solvedCount for a company; omit param for solvedByCompany map |
| POST | `/api/solve` | Required | 60/min per user | Upsert SolvedProblem |
| DELETE | `/api/solve` | Required | 60/min per user | Delete SolvedProblem |

---

## Caching Strategy

| Data | Mechanism | TTL |
|---|---|---|
| Company list | Next.js `fetch` cache | 24 hours |
| Problem CSV per company/period | Next.js `fetch` cache | 1 hour |
| Home page (all company stats) | `export const revalidate = 86400` — full ISR | 24 hours |
| Company detail pages (662+) | `generateStaticParams` + `revalidate = 3600` — SSG | Pre-built + 1h ISR |
| Per-company solved progress | `progressCache` module-level Map (client) | Tab lifetime |
| User progress (HTTP) | Client-side fetch on mount | Always fresh on cache miss |

All GitHub data is fetched at build time or during ISR background revalidation — never on a user's request. User data in Supabase is never affected by ISR.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                      # Home — static ISR, all 662 company stats pre-loaded
│   ├── company/[slug]/
│   │   ├── page.tsx                  # Company detail — SSG, all 5 time periods pre-fetched
│   │   └── error.tsx                 # Company-level error boundary
│   ├── dashboard/page.tsx            # User dashboard (dynamic, auth required)
│   ├── auth/
│   │   ├── signin/page.tsx
│   │   ├── signup/page.tsx
│   │   └── verify/page.tsx           # 6-digit OTP input
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/        # Auth.js handler
│   │   │   ├── register/
│   │   │   ├── verify-otp/
│   │   │   └── resend-otp/
│   │   ├── problems/                 # GitHub CSV proxy (period switching fallback)
│   │   ├── user-progress/            # User solved IDs + counts (client-side hydration)
│   │   └── solve/                    # Mark / unmark solved
│   └── error.tsx                     # Global error boundary
├── components/
│   ├── Navbar.tsx                    # Server — auth-aware
│   ├── CompanyGrid.tsx               # Client — search, infinite scroll, pre-warms progressCache
│   ├── CompanyCard.tsx               # Pure render — stats from props, no lazy fetching
│   ├── CompanyPageClient.tsx         # Client — reads progressCache; owns solvedSet + solvedCount
│   ├── ProblemTable.tsx              # Client — filter, search, pagination; period cache pre-seeded
│   ├── ProblemRow.tsx                # Table row — isSolved drives highlight + title color
│   ├── SolveButton.tsx               # Client — optimistic toggle; syncs with parent solved state
│   ├── DifficultyBadge.tsx
│   ├── FrequencyBar.tsx
│   ├── ProgressBar.tsx
│   └── TimePeriodSelector.tsx
└── lib/
    ├── auth.ts                       # Auth.js config (JWT + Credentials, trustHost)
    ├── github.ts                     # GitHub data fetching + CSV parsing
    ├── mailer.ts                     # Nodemailer Gmail SMTP + HTML template
    ├── prisma.ts                     # Prisma singleton (dev hot-reload safe)
    ├── progress-cache.ts             # Module-level Map: client-side solved progress cache
    ├── ratelimit.ts                  # Upstash Redis sliding-window limiters
    └── utils.ts                      # parseCSV, formatCompanyName, getCompanyColor
```

---

## Local Setup

**Prerequisites:** Node.js 18+, a PostgreSQL database (Supabase free tier), a Gmail account

```bash
# 1. Clone
git clone https://github.com/your-username/code-company-wise.git
cd code-company-wise

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your values (see below)

# 4. Push schema to database
npx prisma db push

# 5. Start dev server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

> **Note:** `npm run build` fetches stats for all 662+ companies from GitHub at build time. This takes 30–90 seconds depending on your connection but only runs once per deployment.

---

## Environment Variables

```bash
# PostgreSQL — Supabase connection string (Settings → Database → Connection string)
# Use the transaction pooler (port 6543) for runtime; direct connection for migrations
DATABASE_URL=""
DIRECT_URL=""          # only needed for prisma db push / migrations

# Auth.js v5
AUTH_SECRET=""         # generate: openssl rand -base64 32
# AUTH_URL is not required — trustHost: true handles all environments

# Upstash Redis — optional, rate limiting is silently skipped if not set
# Create a free database at console.upstash.com → copy REST URL and REST Token
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Gmail SMTP
# 1. Enable 2-Step Verification on your Google account
# 2. Go to myaccount.google.com/apppasswords
# 3. Create an App Password → copy the 16-character password
GMAIL_USER="you@gmail.com"
GMAIL_APP_PASSWORD=""
```

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add all environment variables in the Vercel dashboard
4. Deploy — `npm run build` runs `prisma generate && next build` automatically

Build output will show:
- `○` for the home page (static ISR — no server rendering per request)
- `●` for all 662+ company pages (SSG — pre-rendered at build time)
- `ƒ` only for dashboard and API routes (dynamic by design)

---

## Data Source

Problem data is sourced from the community-maintained repository:
[snehasishroy/leetcode-companywise-interview-questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions)

This project is not affiliated with or endorsed by LeetCode. Data accuracy depends on community contributions to the source repository.
