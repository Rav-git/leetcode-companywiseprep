# Low Level Design — Code Company Wise

## 1. Database Schema (Detailed)

### 1.1 User Table

```sql
CREATE TABLE "User" (
  "id"                TEXT         PRIMARY KEY,        -- cuid() e.g. cmp9x3k...
  "name"              TEXT,                            -- nullable: user's display name
  "email"             TEXT         UNIQUE,             -- normalized to lowercase on write
  "password"          TEXT,                            -- bcrypt hash (cost 12), nullable for future OAuth
  "emailVerified"     BOOLEAN      NOT NULL DEFAULT false, -- false until OTP verified
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "lastActiveAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(), -- updated once/day by middleware
  "reengageSentAt"    TIMESTAMP(3),                    -- NULL = never sent
  "emailOptOut"       BOOLEAN      NOT NULL DEFAULT false, -- set via /api/unsubscribe
  "signInToken"       TEXT,                            -- 32-byte hex, single-use, 5min TTL
  "signInTokenExpiry" TIMESTAMP(3)
);

CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");
-- Used by: SELECT ... WHERE lastActiveAt < $sevenDaysAgo (cron query)
```

**Access patterns:**
| Operation | Query | Frequency |
|-----------|-------|-----------|
| Sign in | `findUnique WHERE email` | Every login |
| Register check | `findUnique WHERE email` | Every signup |
| Mark verified | `update WHERE id` | Once per user |
| Track activity | `update WHERE id SET lastActiveAt` | Once per user per day |
| Cron query | `$queryRaw WHERE lastActiveAt < 7d AND ...` | Daily |

---

### 1.2 OtpCode Table

```sql
CREATE TABLE "OtpCode" (
  "id"        TEXT         PRIMARY KEY,       -- cuid()
  "email"     TEXT         NOT NULL,          -- the email this OTP is for
  "codeHash"  TEXT         NOT NULL,          -- SHA-256(6-digit code) — never store plain OTP
  "attempts"  INTEGER      NOT NULL DEFAULT 0,-- incremented on wrong guess
  "expiresAt" TIMESTAMP(3) NOT NULL,          -- NOW() + 10 minutes
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX "OtpCode_email_idx" ON "OtpCode"("email");
```

**Lifecycle:**
```
register → deleteMany(email) + create(codeHash, expiresAt)
resend   → deleteMany(email) + create(new codeHash, expiresAt)
verify   → findFirst(email) → check attempts, expiry, codeHash → delete(id)
```

**Why SHA-256 instead of bcrypt?**
OTPs are 6-digit numbers (10^6 space). SHA-256 is fast but the OTP's entropy is protected by: 10-min expiry + 5-attempt limit + IP rate limiting. bcrypt would add unnecessary latency for no meaningful security gain here.

---

### 1.3 SolvedProblem Table

```sql
CREATE TABLE "SolvedProblem" (
  "id"        TEXT         PRIMARY KEY,   -- cuid()
  "userId"    TEXT         NOT NULL,      -- FK → User.id
  "problemId" INTEGER      NOT NULL,      -- LeetCode problem number (global, e.g. 1 = Two Sum)
  "company"   TEXT         NOT NULL,      -- company slug e.g. "amazon"
  "solvedAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "SolvedProblem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "SolvedProblem_userId_problemId_company_key"
  ON "SolvedProblem"("userId", "problemId", "company");
  -- Prevents duplicates; allows same problem solved under different companies

CREATE INDEX "SolvedProblem_userId_company_idx"
  ON "SolvedProblem"("userId", "company");
  -- Used by: SELECT WHERE userId=? AND company=? (user-progress API)
```

**Why keep `company` column?**
The home page shows "X solved" per company. Without `company` in SolvedProblem, computing this would require joining every company's problem list (fetched from GitHub) against solved IDs client-side — not feasible. The denormalization is intentional.

**Row estimate at scale:**
- 100K users × 100 avg solves × 1.5 avg companies per solved problem = **15M rows**
- With the composite index, a single user's company progress query is O(log N)

---

## 2. API Specifications

### 2.1 POST /api/auth/register

**Purpose:** Create unverified user account and send OTP email.

**Auth:** None required.

**Rate limit:** 5 requests / 1 hour / IP (Upstash sliding window)

**Request:**
```json
{
  "name": "Ravi Singh",      // optional
  "email": "ravi@gmail.com", // required
  "password": "secret123"    // required, min 6 chars
}
```

**Response:**
```json
// 200 OK
{ "success": true, "email": "ravi@gmail.com" }

// 400 Bad Request
{ "error": "Email and password are required" }
{ "error": "Password must be at least 6 characters" }

// 409 Conflict
{ "error": "An account with this email already exists" }
// Only when emailVerified=true. emailVerified=false → upsert (retry allowed)

// 429 Too Many Requests
{ "error": "Too many requests. Try again later." }

// 500 Internal Server Error
{ "error": "Failed to send verification email. Try again." }
```

**Internal logic:**
```
1. Rate limit check (IP)
2. Validate email + password
3. Normalize email (toLowerCase + trim)
4. findUnique(email) → if emailVerified=true → 409
5. hash(password, 12) via bcryptjs
6. generateOtp() → 6-digit random number
7. User.upsert(email) → creates if new, updates name+password if retrying
8. OtpCode.deleteMany(email) + OtpCode.create(codeHash=SHA256(otp), expiresAt=+10min)
9. sendOtpEmail(email, otp) via Gmail
10. Return { success: true, email }
```

---

### 2.2 POST /api/auth/verify-otp

**Purpose:** Verify OTP, mark user as verified, issue one-time sign-in token.

**Auth:** None required.

**Rate limit:** 10 requests / 10 minutes / IP

**Request:**
```json
{
  "email": "ravi@gmail.com",
  "code": "482910"
}
```

**Response:**
```json
// 200 OK
{ "success": true, "signInToken": "a3f2...(64 hex chars)", "email": "ravi@gmail.com" }

// 400
{ "error": "Email and code are required" }
{ "error": "Invalid code. 4 attempts remaining." }
{ "error": "Invalid code. No attempts remaining." }

// 404
{ "error": "No verification code found. Please sign up again." }
{ "error": "Account not found. Please sign up again." }

// 410 Gone
{ "error": "Code expired. Request a new one." }

// 429
{ "error": "Too many failed attempts. Go back and sign up again to get a new code." }
{ "error": "Too many attempts. Try again later." }
```

**Internal logic:**
```
1. Rate limit check (IP)
2. OtpCode.findFirst(email, orderBy: createdAt desc)
3. If attempts >= 5 → delete OtpCode → 429
4. If expired → delete OtpCode → 410
5. SHA256(code) !== record.codeHash → increment attempts → 400
6. User.findUnique(email) → 404 if not found
7. signInToken = randomBytes(32).toString('hex')
8. User.update → { emailVerified: true, signInToken, signInTokenExpiry: +5min }
9. OtpCode.delete(id)
10. Return { success: true, signInToken, email }
```

**Client flow after verify-otp:**
```
client receives { signInToken, email }
  → signIn('credentials', { email, signInToken })
  → NextAuth authorize() validates token, consumes it (sets to null)
  → JWT issued → cookie set → redirect to /
```

---

### 2.3 POST /api/auth/resend-otp

**Purpose:** Regenerate OTP for a pending (unverified) user.

**Auth:** None required.

**Rate limit:** 3 requests / 10 minutes / email address

**Request:**
```json
{ "email": "ravi@gmail.com" }
```

**Response:**
```json
// 200 OK
{ "success": true }

// 400
{ "error": "Email required" }

// 404
{ "error": "No pending registration found. Please sign up again." }
// Returned when user doesn't exist OR emailVerified=true

// 429
{ "error": "Too many resend requests. Wait a few minutes." }

// 500
{ "error": "Failed to resend email. Try again." }
```

---

### 2.4 GET /api/user-progress

**Purpose:** Fetch solved problem IDs for a company, or solved counts per company.

**Auth:** Required (JWT session). Returns empty data if not authenticated.

**Rate limit:** None (reads only).

**Request variants:**

```
GET /api/user-progress?company=amazon
→ Returns per-company solve state

GET /api/user-progress
→ Returns all company solve counts (home page)
```

**Response:**
```json
// With ?company=amazon
{
  "solvedCount": 12,
  "solvedIds": [1, 2, 5, 11, 15, 20, 21, 42, 70, 88, 121, 141]
}

// Without company param
{
  "solvedByCompany": {
    "amazon": 12,
    "google": 7,
    "meta": 3
  }
}

// Unauthenticated (both variants)
{ "solvedCount": 0, "solvedIds": [], "solvedByCompany": {} }
```

**DB queries:**
```sql
-- With company param:
SELECT "problemId" FROM "SolvedProblem"
WHERE "userId" = $1 AND "company" = $2
-- Uses index: SolvedProblem_userId_company_idx

-- Without company param:
SELECT "company" FROM "SolvedProblem"
WHERE "userId" = $1
-- Uses index: SolvedProblem_userId_company_idx (prefix match)
-- Grouped in JS, not SQL
```

---

### 2.5 POST /api/solve

**Purpose:** Mark a problem as solved for a specific company.

**Auth:** Required. Returns 401 if unauthenticated.

**Rate limit:** 60 requests / 1 minute / user

**Request:**
```json
{
  "problemId": 1,
  "company": "amazon"
}
```

**Response:**
```json
// 200 OK
{ "success": true }

// 400
{ "error": "Missing fields" }

// 401
{ "error": "Unauthorized" }

// 429
{ "error": "Too many requests. Slow down." }
```

**DB operation:**
```sql
INSERT INTO "SolvedProblem" ("id","userId","problemId","company","solvedAt")
VALUES ($id, $userId, $problemId, $company, NOW())
ON CONFLICT ("userId","problemId","company") DO NOTHING
-- Upsert: safe to call multiple times, idempotent
```

---

### 2.6 DELETE /api/solve

**Purpose:** Unmark a problem as solved.

**Auth:** Required.

**Rate limit:** Shared with POST /api/solve (60/min/user)

**Request:**
```json
{
  "problemId": 1,
  "company": "amazon"
}
```

**Response:**
```json
{ "success": true }
```

---

### 2.7 GET /api/problems

**Purpose:** Fetch problems for a company+period. Fallback when client-side cache misses.

**Auth:** None required.

**Request:**
```
GET /api/problems?slug=amazon&period=six-months
```

Valid periods: `thirty-days`, `three-months`, `six-months`, `more-than-six-months`, `all`

**Response:**
```json
{
  "problems": [
    {
      "id": 1,
      "url": "https://leetcode.com/problems/two-sum/",
      "slug": "two-sum",
      "title": "Two Sum",
      "difficulty": "Easy",
      "acceptance": 49.1,
      "frequency": 88.5
    }
    // ...
  ]
}
```

**Note:** In practice, this endpoint is rarely called. All 5 periods are pre-fetched at build time and baked into the page. The `ProblemTable` only calls this if a period isn't in its pre-seeded `ref` cache (shouldn't happen in normal usage).

---

### 2.8 POST /api/internal/track-active

**Purpose:** Update `lastActiveAt` for a user. Called fire-and-forget from middleware.

**Auth:** `x-internal-secret` header must match `process.env.INTERNAL_SECRET`

**Request:**
```json
{ "userId": "cmp9x3k..." }
```

**Response:**
```json
{ "ok": true }

// 403 if secret missing or wrong
{ "error": "Forbidden" }
```

**Why a separate endpoint and not inline in middleware?**
Next.js middleware runs on the Edge Runtime which cannot import Prisma (Node.js only). The fire-and-forget fetch from middleware to this serverless function solves the runtime constraint with zero impact on page load time.

---

### 2.9 GET /api/cron/reengagement

**Purpose:** Send re-engagement emails to inactive users. Triggered daily by Vercel cron.

**Auth:** `Authorization: Bearer <CRON_SECRET>` header

**Response:**
```json
{ "sent": 42, "failed": 0 }
```

**Core SQL query:**
```sql
SELECT id, email, name FROM "User"
WHERE
  "emailVerified" = true
  AND "emailOptOut" = false
  AND "lastActiveAt" < $sevenDaysAgo     -- inactive for 7+ days
  AND (
    "reengageSentAt" IS NULL             -- never emailed
    OR "reengageSentAt" < "lastActiveAt" -- emailed before their last visit (they came back, went inactive again)
  )
LIMIT 100
```

**The `reengageSentAt < lastActiveAt` condition explained:**
```
Timeline:
  Day 1: User visits   → lastActiveAt=Day1
  Day 8: Cron runs     → emails user, reengageSentAt=Day8
  Day 9: User visits   → lastActiveAt=Day9  (now > reengageSentAt)
  Day 16: Cron runs    → reengageSentAt(Day8) < lastActiveAt(Day9) → sends again ✓
  Day 16: reengageSentAt=Day16
  Day 17: Cron runs    → reengageSentAt(Day16) > lastActiveAt(Day9) → skips ✓
```

---

### 2.10 GET /api/unsubscribe

**Purpose:** Opt a user out of re-engagement emails via signed link.

**Auth:** HMAC-signed token in URL (no session needed — must work from email clients)

**Request:**
```
GET /api/unsubscribe?email=ravi@gmail.com&token=<hmac>
```

**Token generation (in mailer.ts):**
```ts
const token = createHmac('sha256', process.env.AUTH_SECRET).update(email).digest('hex')
```

**Verification:**
```ts
const expected = createHmac('sha256', process.env.AUTH_SECRET).update(email).digest('hex')
if (expected !== token) → redirect /?unsubscribe=invalid
```

**Response:** HTTP redirect (302)
```
Success: /?unsubscribe=success
Invalid: /?unsubscribe=invalid
```

---

## 3. Authentication Flow (Detailed)

### 3.1 JWT Session Structure

```ts
// JWT token payload (stored in httpOnly cookie)
{
  sub: "cmp9x3k...",   // user.id
  iat: 1234567890,
  exp: 1234567890,
  jti: "...",
}

// Session object (derived from JWT, no DB call)
{
  user: {
    id: "cmp9x3k...",
    email: "ravi@gmail.com",
    name: "Ravi Singh",
    image: null
  }
}
```

### 3.2 NextAuth Authorize Logic

```
authorize(credentials) {
  if (!credentials.email) → null

  user = db.findUnique(email)
  if (!user) → null
  if (!user.emailVerified) → null  ← blocks pending registrations

  if (credentials.signInToken) {
    // Post-OTP path
    validate token matches, not expired
    consume token (set to null in DB)
    return user
  }

  if (credentials.password) {
    // Normal sign-in path
    bcrypt.compare(password, user.password)
    return user or null
  }
}
```

### 3.3 Middleware Auth Flow

```
Every non-API page request:
  middleware(req)
    read _lat cookie → if today → skip (already tracked)
    auth(req) → reads JWT from authjs.session-token cookie
    if session → POST /api/internal/track-active (fire-and-forget)
    set _lat cookie = today (maxAge: 86400)
    NextResponse.next()
```

---

## 4. Component Architecture

```
RootLayout (server)
├── AuthProvider (client) — wraps SessionProvider from next-auth
├── Navbar (client) — useSession() for auth state
└── {children}

/ (Home) — server, SSG
└── CompanyGrid (client)
    ├── IntersectionObserver (virtual scroll: 50 cards at a time)
    ├── Search filter (local state)
    └── CompanyCard[] (client)
        ├── Link with prefetch={false}
        └── onMouseEnter → router.prefetch() + progressCache.prefetch()

/company/[slug] — server, SSG
└── CompanyProgress (client) ← replaced CompanyPageClient; uses useCompanyProgress hook
    ├── useCompanyProgress(slug) → { solvedSet, solvedCount, handleSolveToggle }
    │   ├── progressCache read (sync, zero-flash)
    │   └── API fetch (only if cache miss)
    ├── ProgressBar (ui/ProgressBar — design system colors)
    └── ProblemTable (client)
        ├── TimePeriodSelector (client)
        │   └── inset box-shadow tab indicator (not border-bottom, avoids clip)
        ├── Difficulty filter buttons (DIFFICULTY_FILTER_COLORS)
        ├── TextInput (ui/TextInput — shared focus behavior)
        ├── Spinner (ui/Spinner — on period tab switch load)
        ├── Pagination (PAGE_SIZE = 30)
        └── ProblemRow[]
            └── SolveButton (client)
                ├── useSession() for auth gate
                ├── optimistic update via handleSolveToggle
                └── markSolved / markUnsolved (solve.service.ts)

/dashboard — server, force-dynamic
├── prisma.solvedProblem.findMany(userId)
├── fetchProblems(company, 'all') × N companies (GitHub cache)
├── Streak calculation
└── Top companies + recent activity

/auth/signup — client
└── fetch /api/auth/register → redirect /auth/verify

/auth/verify — client (Suspense-wrapped)
└── useSearchParams() reads ?email
    └── fetch /api/auth/verify-otp → signIn() → redirect /

/auth/signin — client
└── signIn('credentials') → redirect /
```

---

## 5. Client-side State Management

No global state library (Redux/Zustand). State is managed at three levels:

### 5.1 Module-level cache (progressCache)

```ts
// src/lib/progress-cache.ts
// Singleton: created once per browser tab, persists across navigations

const store = new Map<string, CompanyProgress>()   // per-company solved IDs
let solvedByCompany: Record<string, number> | null = null  // home page counts

// Write path: after fetch OR after solve toggle
progressCache.set(slug, { solvedCount, solvedIds })

// Read path: synchronous, used to initialise React state
const cached = progressCache.get(slug)  // null if not yet fetched
useState(cached ? new Set(cached.solvedIds) : new Set())
```

**Why module-level instead of React Context or localStorage?**
- Context: causes re-renders across the whole tree
- localStorage: async read, causes flash, 5MB limit, not tab-isolated
- Module Map: synchronous, zero re-renders, tab-isolated, no size limit

### 5.2 Component-local state

| Component | State | Updated by |
|-----------|-------|------------|
| CompanyGrid | `solvedByCompany`, `displayCount`, `search` | API fetch (progress.service), scroll, user input |
| CompanyProgress | `solvedSet`, `solvedCount` via `useCompanyProgress` hook | API fetch, handleSolveToggle callbacks |
| ProblemTable | `problems`, `period`, `search`, `selectedDifficulty`, `page` | User interaction |
| SolveButton | `solved`, `loading` | `handleSolveToggle` click + `initialSolved` prop sync |

### 5.3 SolveButton optimistic update pattern

```
handleSolveToggle():
  newSolved = !solved
  setSolved(newSolved)     ← optimistic: UI updates instantly
  setLoading(true)
  
  // solve.service.ts — markSolved / markUnsolved
  (newSolved ? markSolved : markUnsolved)(problemId, company)
    .then(ok => {
      if (ok) onToggle(newSolved)      ← propagate to parent
      else setSolved(!newSolved)        ← revert on failure
    })
    .catch(() => setSolved(!newSolved)) ← revert on network error
    .finally(() => setLoading(false))

// Prop sync (handles case where API returns solved IDs after mount):
useEffect(() => {
  if (!loading) setSolved(initialSolved)
}, [initialSolved])
// eslint-disable-next-line: intentional — only sync when initialSolved changes
```

---

## 6. Data Models (TypeScript)

```ts
// src/types/index.ts

type Difficulty = 'Easy' | 'Medium' | 'Hard'

type TimePeriod =
  | 'thirty-days'
  | 'three-months'
  | 'six-months'
  | 'more-than-six-months'
  | 'all'

interface Problem {
  id: number          // LeetCode problem number (global unique)
  url: string         // full leetcode.com URL
  slug: string        // URL slug e.g. "two-sum"
  title: string       // display title e.g. "Two Sum"
  difficulty: Difficulty
  acceptance: number  // percentage e.g. 49.1
  frequency: number   // relative frequency within company 0-100
}

interface Company {
  slug: string        // GitHub directory name e.g. "amazon"
  name: string        // formatted e.g. "Amazon"
}

interface CompanyWithStats extends Company {
  totalCount: number
  easyCount: number
  mediumCount: number
  hardCount: number
}

// progress-cache.ts
interface CompanyProgress {
  solvedCount: number
  solvedIds: number[]
}
```

---

## 7. Problem Data Pipeline (Detailed)

### 7.1 GitHub Data Structure

```
GitHub repo: snehasishroy/leetcode-companywise-interview-questions
├── amazon/
│   ├── thirty-days.csv
│   ├── three-months.csv
│   ├── six-months.csv
│   ├── more-than-six-months.csv
│   └── all.csv
├── google/
│   └── ...
└── (662 company directories)

CSV format (header row + data):
ID, URL, Title, Difficulty, Acceptance, Frequency
1, https://leetcode.com/problems/two-sum/, Two Sum, Easy, 49.1, 88.5
```

### 7.2 Parse Logic

```ts
// src/lib/utils.ts → parseCSVLine()
// Handles titles with commas (e.g. "Min Stack, Max Stack")
// by slicing from both ends: parts[0]=id, parts[1]=url, parts[-1]=freq, parts[-2]=acceptance, parts[-3]=difficulty
// Everything in between = title

const parts = line.split(',')
const id = parseInt(parts[0])
const url = parts[1].trim()
const frequency = parseFloat(parts[parts.length - 1])
const acceptance = parseFloat(parts[parts.length - 2])
const difficulty = parts[parts.length - 3].trim()
const title = parts.slice(2, parts.length - 3).join(',').trim()
const slug = url.split('/problems/')[1]?.replace(/\/$/, '')
```

### 7.3 Company List Discovery

```ts
// src/lib/github.ts → fetchCompanyList()
// Fetches the GitHub HTML page, parses the embedded JSON (react-app embeddedData)
// to get the repository tree (list of directory names)
// Filters: contentType === 'directory' AND !name.startsWith('src')
```

---

## 8. Rate Limiting Implementation

```ts
// src/lib/ratelimit.ts
// Uses Upstash Redis sliding window algorithm

// Graceful degradation: if Redis env vars missing, createRateLimiter() returns null
// All rate limit checks: if (limiter) { check } — site works without Redis

const limiters = {
  register:  createRateLimiter(5,  '1 h'),   // 5 signups/hr/IP
  verifyOtp: createRateLimiter(10, '10 m'),  // 10 verify attempts/10min/IP
  resendOtp: createRateLimiter(3,  '10 m'),  // 3 resends/10min/email
  solve:     createRateLimiter(60, '1 m'),   // 60 solve actions/min/user
}

// Usage pattern in API routes:
if (solveLimiter) {
  const { success } = await solveLimiter.limit(session.user.id)
  if (!success) return NextResponse.json({ error: '...' }, { status: 429 })
}
```

**Rate limit keys:**
- `register`: IP address
- `verifyOtp`: IP address
- `resendOtp`: email address (not IP — prevents one IP from blocking multiple users)
- `solve`: user ID (not IP — allows multiple users from same IP, e.g. office)

---

## 9. Email System

### 9.1 OTP Email

```
Subject: "482910 is your LeetCode Companies verification code"
From: "LeetCode Companies" <gmail_user>

Content: Branded dark HTML email
- Logo header
- Heading: "Verify your email" / "New verification code"
- Large OTP digits in monospace box (#FFA116 color)
- Expires in 10 minutes notice
```

### 9.2 Re-engagement Email

```
Subject: "Ravi, your interview prep is waiting"
From: "Code Company Wise" <gmail_user>

Content:
- Personalized greeting with first name
- "Top companies like Google, Amazon, and Meta are hiring right now"
- "Even one problem a day keeps the momentum alive"
- CTA button → homepage
- Footer with unsubscribe link (HMAC-signed, no login needed)
```

### 9.3 Unsubscribe Token

```ts
// Signing (mailer.ts):
const token = createHmac('sha256', AUTH_SECRET).update(email).digest('hex')
const url = `${NEXTAUTH_URL}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`

// Verification (unsubscribe/route.ts):
const expected = createHmac('sha256', AUTH_SECRET).update(email).digest('hex')
if (expected !== token) → redirect /?unsubscribe=invalid

// Tamper-proof: changing the email in the URL invalidates the HMAC
// No DB lookup needed to verify — stateless
```

---

## 10. Activity Tracking (Detailed)

### 10.1 Cookie-based deduplication

```
Request arrives → middleware
  req.cookies.get('_lat')?.value === '2026-05-22'?
    YES → NextResponse.next()  (no work done)
    NO  → fire fetch to /api/internal/track-active
          set cookie: _lat=2026-05-22, maxAge=86400, httpOnly, sameSite=lax
          NextResponse.next()

Cookie properties:
  httpOnly: true   → JS can't read or tamper with it
  sameSite: lax    → sent on same-site navigations, blocks CSRF
  maxAge: 86400    → expires after 24 hours
  path: /          → sent on all routes
```

### 10.2 Why fire-and-forget?

```
Problem: Middleware runs before page render. If we await the DB update,
         every page load for logged-in users adds ~50-100ms.

Solution: fetch() without await.
  - The fetch is initiated but the middleware doesn't wait for the response
  - The page response is returned to the browser immediately
  - The DB update happens in the background (Vercel serverless function)
  - If it fails → no problem, next request will retry (cookie not set yet)

Note: In Next.js middleware, fire-and-forget fetch works because the
      serverless function (track-active) has its own lifecycle.
```

---

## 11. Build-time Optimisations

### 11.1 Static Generation

```ts
// /company/[slug]/page.tsx

export async function generateStaticParams() {
  const companies = await fetchCompanyList()  // 662 companies
  return companies.map(c => ({ slug: c.slug }))  // ONE page per company
}

// At build time, for EACH of the 662 pages:
// 1. fetchProblems(slug, period) × 5 periods in parallel (all bundled as props)
// 2. fetchCompanyStats(slug)
// Total: 662 × 6 fetch calls = ~3,972 GitHub requests at build
// (deduped by Next.js fetch cache — same URL hits cache on second call)
// Result: 662 pre-rendered HTML pages — each contains ALL 5 period datasets
//         Zero runtime GitHub calls for the happy path
```

### 11.2 Memory optimization (OOM prevention)

```json
// package.json
"build": "prisma generate && node --max-old-space-size=4096 node_modules/next/dist/bin/next build"
```

Default Node.js heap is ~1.5GB. Building 662 pages × 5 periods concurrently exhausts this. Setting 4GB prevents OOM crashes.

### 11.3 Hover-based prefetch (instead of viewport-based)

```tsx
// CompanyCard.tsx
// prefetch={false} → disables Next.js auto-prefetch on viewport entry
// (prevents 662 RSC requests on home page load)

// Manual prefetch on hover (user intent signal):
const handleMouseEnter = () => {
  if (hasPrefetched.current) return  // guard against duplicate calls on re-hover
  hasPrefetched.current = true
  router.prefetch(`/company/${company.slug}`)   // RSC prefetch
  progressCache.prefetch(company.slug)           // API prefetch
}
```

---

## 12. Error Handling Strategy

| Layer | Approach |
|-------|---------|
| GitHub fetch | Returns `[]` on any error — pages show "No data" gracefully |
| API routes | Structured `{ error: string }` responses with appropriate HTTP status |
| Rate limiter | Null-safe: if Redis down, rate limiting disabled, site continues |
| Email send | Caught in try/catch, returns 500 with user-facing message |
| progressCache | `.catch(() => {})` on all prefetch calls — silent failures |
| SolveButton | Reverts optimistic update on network error or non-ok response |
| Cron job | `Promise.allSettled()` — one email failure doesn't block others; counts logged |
| DB queries | Uncaught → Next.js 500 page (acceptable for unexpected errors) |

---

## 13. Performance Metrics (Achieved)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Home page TTFB | ~3,600ms | <100ms | 97% faster |
| Home page Speed Index | 2.7s | <1s | ~65% faster |
| Home page render | Dynamic (ƒ) | Static (○) | CDN-served |
| Company page tab switch | ~500ms (GitHub fetch) | 0ms (pre-built) | Instant |
| Solve count flash | ~300ms (API fetch) | 0ms (cache hit) | Zero flash |
| Home page API calls on load | 50+ (Link prefetch) | 1 (user-progress) | 98% reduction |
| SolvedProblem table redundancy | 3 extra columns | 0 extra columns | Cleaner schema |
| OTP security | Plain text | SHA-256 hashed | Secure |
