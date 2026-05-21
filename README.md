# CompanyAce — LeetCode Company-Wise Interview Prep

Browse real LeetCode Premium company tags, filter by time period, and track your solved problems per company — all for free.

**Live:** [company-wise-code-ten.vercel.app](https://company-wise-code-ten.vercel.app)

---

## What it does

LeetCode Premium charges $35/month to see which companies ask which problems. This tool surfaces that data for free using a community-maintained dataset, and layers a full user system on top so you can track exactly what you've solved at each company.

---

## Features

- **662+ companies** — every company in the dataset; 50 priority companies (Google, Amazon, Meta etc.) load with stats upfront, the rest lazy-load via Intersection Observer
- **Time period filter** — switch between 30 days / 3 months / 6 months / all time per company
- **Problem table** — paginated (30/page), filterable by difficulty, searchable by title or ID
- **Frequency bar** — visual indicator of how often each problem appears in interviews
- **Solve tracking** — mark/unmark problems as solved with optimistic UI; persists to PostgreSQL
- **Progress bars** — per-company solved/total count on every card and detail page
- **Dashboard** — total solved, Easy/Medium/Hard breakdown, top companies practiced, recent activity feed, streak counter
- **Email OTP auth** — two-step sign-up: register → 6-digit OTP email → verify → auto sign-in (plain-text password never stored client-side)
- **Rate limiting** — Upstash Redis sliding-window on all sensitive routes (optional, graceful no-op if not configured)
- **Error boundaries** — graceful fallback UI if the GitHub data source is unavailable

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, ISR) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3.4 |
| Auth | NextAuth.js v5 beta — JWT strategy, Credentials provider |
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
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      src/lib/github.ts                          │
│                                                                 │
│  fetchCompanyList()           fetchProblemsWithFallback()       │
│  → parse embedded JSON        → tries: six-months              │
│  → filter directories         →       three-months             │
│                               →       all                      │
│  fetchCompanyStats(slug)      fetchProblems(slug, period)       │
│  → count Easy/Medium/Hard     → parse CSV → Problem[]          │
└────────────────────────────┬────────────────────────────────────┘
                             │  Next.js ISR (server components)
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
    app/page.tsx    app/company/[slug]  app/dashboard
    (home grid)     (problem table)     (user stats)
             │               │
             └───────────────┴──────────────────────────┐
                                                        │
┌───────────────────────────┐   ┌───────────────────────▼──────┐
│       AUTH LAYER          │   │      DATABASE LAYER           │
│                           │   │      Supabase PostgreSQL      │
│  NextAuth v5 — JWT        │   │                               │
│  Credentials provider     │   │  User                         │
│  bcrypt cost 12           │   │  OtpCode                      │
│  One-time signInToken     │   │  SolvedProblem                │
│  (post-OTP auto sign-in)  │   │                               │
└───────────────────────────┘   └───────────────────────────────┘
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

---

## Solve Tracking Flow

```
User clicks ✓ on a problem
  ├── Optimistic update: UI flips to solved instantly
  ├── POST /api/solve { problemId, problemSlug, company, difficulty }
  │     auth() required → prisma.solvedProblem.upsert()
  │     unique on (userId, problemId, company)
  ├── Success → UI stays solved
  └── Failure → UI reverts to unsolved

User clicks ✓ again (un-solve)
  └── DELETE /api/solve → prisma.solvedProblem.deleteMany()

On page load (server component)
  └── SELECT company FROM SolvedProblem WHERE userId = ?
        → Set<problemId> passed as prop to ProblemTable
```

---

## API Routes

| Method | Route | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | — | 5/hr per IP | Create OtpCode, send OTP email |
| POST | `/api/auth/verify-otp` | — | 10/10min per IP | Verify OTP, create User, return signInToken |
| POST | `/api/auth/resend-otp` | — | 3/10min per email | Regenerate OTP, reset attempt counter |
| GET | `/api/problems?slug=&period=` | — | — | Fetch problems from GitHub CSV |
| GET | `/api/company-stats?slug=` | — | CDN cached 1h | Fetch difficulty counts for a company |
| POST | `/api/solve` | Required | 60/min per user | Upsert SolvedProblem |
| DELETE | `/api/solve` | Required | 60/min per user | Delete SolvedProblem |

---

## Caching Strategy

| Data | Mechanism | TTL |
|---|---|---|
| Company list | Next.js `fetch` `revalidate` | 24 hours |
| Problem CSV per company | Next.js `fetch` `revalidate` | 1 hour |
| Company stats API response | `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` | 1hr fresh / 24hr stale |
| Home page (ISR) | `export const revalidate = 86400` | 24 hours |

If GitHub is unavailable during a cache miss, the last cached build is served. User data in Supabase is never affected.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                      # Home — company grid (ISR)
│   ├── company/[slug]/
│   │   ├── page.tsx                  # Company detail — problem table (ISR)
│   │   └── error.tsx                 # Company-level error boundary
│   ├── dashboard/page.tsx            # User dashboard (dynamic)
│   ├── auth/
│   │   ├── signin/page.tsx
│   │   ├── signup/page.tsx
│   │   └── verify/page.tsx           # 6-digit OTP input
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/        # NextAuth handler
│   │   │   ├── register/
│   │   │   ├── verify-otp/
│   │   │   └── resend-otp/
│   │   ├── problems/
│   │   ├── company-stats/
│   │   └── solve/
│   └── error.tsx                     # Global error boundary
├── components/
│   ├── Navbar.tsx                    # Server — auth-aware
│   ├── CompanyGrid.tsx               # Client — live search + grid
│   ├── CompanyCard.tsx               # Client — lazy stats via IntersectionObserver
│   ├── ProblemTable.tsx              # Client — filter, search, pagination, period switching
│   ├── ProblemRow.tsx                # Table row
│   ├── SolveButton.tsx               # Client — optimistic solved toggle
│   ├── DifficultyBadge.tsx
│   ├── FrequencyBar.tsx
│   ├── ProgressBar.tsx
│   └── TimePeriodSelector.tsx
└── lib/
    ├── auth.ts                       # NextAuth config (JWT + Credentials)
    ├── github.ts                     # GitHub data fetching + CSV parsing
    ├── mailer.ts                     # Nodemailer Gmail SMTP + HTML template
    ├── prisma.ts                     # Prisma singleton (dev hot-reload safe)
    ├── ratelimit.ts                  # Upstash Redis sliding-window limiters
    └── utils.ts                      # parseCSV, formatCompanyName, getCompanyColor
```

---

## Local Setup

**Prerequisites:** Node.js 18+, a PostgreSQL database (Supabase free tier), a Gmail account

```bash
# 1. Clone
git clone https://github.com/your-username/company-wise-code.git
cd company-wise-code

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your values (see below)

# 4. Push schema to database
npx prisma db push

# 5. Start dev server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```bash
# PostgreSQL — Supabase connection string (Settings → Database → Connection string)
DATABASE_URL=""

# NextAuth
NEXTAUTH_URL="http://localhost:3000"   # your domain in production
NEXTAUTH_SECRET=""                     # generate: openssl rand -base64 32

# Upstash Redis — optional, rate limiting is silently skipped if not set
# Create a free database at console.upstash.com → copy REST URL and REST Token
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Gmail SMTP
# 1. Enable 2-Step Verification on your Google account
# 2. Go to myaccount.google.com/apppasswords
# 3. Create an App Password → select "Mail" → copy the 16-character password
GMAIL_USER="you@gmail.com"
GMAIL_APP_PASSWORD=""
```

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add all environment variables (set `NEXTAUTH_URL` to your Vercel domain)
4. Deploy — `npm run build` runs `prisma generate` then `next build` automatically

---

## Data Source

Problem data is sourced from the community-maintained repository:
[snehasishroy/leetcode-companywise-interview-questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions)

This project is not affiliated with or endorsed by LeetCode. Data accuracy depends on community contributions to the source repository.
