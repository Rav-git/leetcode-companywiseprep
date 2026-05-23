# Low Level Design — Code Company Wise

## 1. Database Schema (Detailed)

### 1.1 User Table

```sql
CREATE TABLE "User" (
  "id"                   TEXT         PRIMARY KEY,        -- cuid() e.g. cmp9x3k...
  "name"                 TEXT,                            -- nullable: user's display name
  "email"                TEXT         UNIQUE,             -- normalized to lowercase on write
  "password"             TEXT,                            -- bcrypt hash (cost 12), nullable for future OAuth
  "emailVerified"        BOOLEAN      NOT NULL DEFAULT false, -- false until OTP verified
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "lastActiveAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(), -- updated once/day by middleware
  "reengageSentAt"       TIMESTAMP(3),                    -- NULL = never sent
  "emailOptOut"          BOOLEAN      NOT NULL DEFAULT false, -- set via /api/unsubscribe
  "signInToken"          TEXT,                            -- 32-byte hex, single-use, 5min TTL
  "signInTokenExpiresAt" TIMESTAMP(3)                     -- was signInTokenExpiry in v1
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

### 1.3 Company Table

```sql
CREATE TABLE "Company" (
  "id"   INTEGER PRIMARY KEY AUTOINCREMENT,
  "slug" TEXT    NOT NULL UNIQUE,  -- "google"  (GitHub directory name)
  "name" TEXT    NOT NULL          -- "Google"  (title-cased display name)
);
```

Populated by `scripts/seed.ts` (one-time) and kept fresh by `/api/cron/refresh-data` (weekly). 662 rows in production.

---

### 1.4 Problem Table

```sql
CREATE TABLE "Problem" (
  "id"             INTEGER NOT NULL PRIMARY KEY, -- LeetCode frontendQuestionId (1 = Two Sum)
  "titleSlug"      TEXT    NOT NULL UNIQUE,      -- "two-sum"
  "title"          TEXT    NOT NULL,             -- "Two Sum"
  "difficulty"     TEXT    NOT NULL,             -- "Easy" | "Medium" | "Hard"
  "acceptanceRate" REAL    NOT NULL
);

CREATE INDEX "Problem_difficulty_idx" ON "Problem"("difficulty");
CREATE INDEX "Problem_titleSlug_idx"  ON "Problem"("titleSlug");
-- titleSlug index used by: LeetCode Sync (IN clause on 300-1000 slugs at once)
```

~3,310 unique rows in production. `id` is NOT autoincrement — it uses the LeetCode problem number directly so joins are natural and sync cross-referencing is trivial.

---

### 1.5 CompanyProblem Table (Join Table)

```sql
CREATE TABLE "CompanyProblem" (
  "companyId" INTEGER NOT NULL,  -- FK → Company.id
  "problemId" INTEGER NOT NULL,  -- FK → Problem.id
  "period"    TEXT    NOT NULL,  -- "thirty-days" | "three-months" | "six-months"
                                 -- | "more-than-six-months" | "all"
  "frequency" REAL    NOT NULL,  -- relative frequency score 0-100

  PRIMARY KEY ("companyId", "problemId", "period"),

  FOREIGN KEY ("companyId") REFERENCES "Company"("id"),
  FOREIGN KEY ("problemId") REFERENCES "Problem"("id")
);

CREATE INDEX "CompanyProblem_companyId_period_frequency_idx"
  ON "CompanyProblem"("companyId", "period", "frequency");
-- Used by: getCompanyProblems(slug, period) — ORDER BY frequency DESC

CREATE INDEX "CompanyProblem_problemId_idx" ON "CompanyProblem"("problemId");
-- Used by: dashboard top-companies query (JOIN from UserSolvedProblem)
```

~40,936 rows in production. The composite PK `(companyId, problemId, period)` is the uniqueness constraint — a problem appears once per company per period.

---

### 1.6 UserSolvedProblem Table

```sql
CREATE TABLE "UserSolvedProblem" (
  "userId"    TEXT         NOT NULL,  -- FK → User.id (cascade delete)
  "problemId" INTEGER      NOT NULL,  -- FK → Problem.id
  "solvedAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  PRIMARY KEY ("userId", "problemId"),

  FOREIGN KEY ("userId")    REFERENCES "User"("id")    ON DELETE CASCADE,
  FOREIGN KEY ("problemId") REFERENCES "Problem"("id")
);

CREATE INDEX "UserSolvedProblem_userId_solvedAt_idx"
  ON "UserSolvedProblem"("userId", "solvedAt");
-- Used by: recent activity query (ORDER BY solvedAt DESC LIMIT 10)
```

**Critical schema change vs v1:** The old `SolvedProblem` table had a `company` column, meaning solving "Two Sum" for Amazon was a separate row from solving "Two Sum" for Google. The new schema has `UserSolvedProblem` with composite PK `(userId, problemId)` only. Solving a problem marks it **globally**. Company cross-referencing is done at query time via JOIN through `CompanyProblem`. This eliminates duplicate rows, makes the LeetCode sync import much simpler, and makes per-company progress accurate regardless of which company page the user first visited.

**Row estimate at scale:**
- 100K users × 300 avg solves = **30M rows** (vs 45M+ in the old schema with company duplication)
- With the composite PK index, a single user's progress query is O(log N)

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
8. User.update → { emailVerified: true, signInToken, signInTokenExpiresAt: +5min }
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
-- With company param (JOIN through CompanyProblem — no company column in UserSolvedProblem):
SELECT usp."problemId"
FROM   "UserSolvedProblem" usp
JOIN   "CompanyProblem"    cp  ON cp."problemId"  = usp."problemId"
JOIN   "Company"            c   ON c.id            = cp."companyId"
WHERE  usp."userId" = $1
AND    c.slug        = $2
-- Uses index: UserSolvedProblem PK + CompanyProblem_problemId_idx

-- Without company param (single raw SQL for all companies):
SELECT c.slug, COUNT(DISTINCT usp."problemId") AS count
FROM   "UserSolvedProblem" usp
JOIN   "CompanyProblem"   cp ON cp."problemId" = usp."problemId"
JOIN   "Company"           c  ON c.id          = cp."companyId"
WHERE  usp."userId" = $1
GROUP  BY c.slug
```

---

### 2.5 POST /api/solve

**Purpose:** Mark a problem as solved globally (no company parameter).

**Auth:** Required. Returns 401 if unauthenticated.

**Rate limit:** 60 requests / 1 minute / user (keyed by userId)

**Request:**
```json
{
  "problemId": 1
}
```

**Response:**
```json
// 200 OK
{ "success": true }

// 400
{ "error": "Missing problemId" }

// 401
{ "error": "Unauthorized" }

// 429
{ "error": "Too many requests. Slow down." }

// 500
{ "error": "Failed to save progress" }
```

**DB operation:**
```sql
INSERT INTO "UserSolvedProblem" ("userId", "problemId", "solvedAt")
VALUES ($userId, $problemId, NOW())
ON CONFLICT ("userId", "problemId") DO NOTHING
-- Upsert: safe to call multiple times, idempotent
-- Composite PK (userId, problemId) is the uniqueness constraint
```

---

### 2.6 DELETE /api/solve

**Purpose:** Unmark a problem as solved.

**Auth:** Required.

**Rate limit:** Shared with POST /api/solve (60/min/user)

**Request:**
```json
{
  "problemId": 1
}
```

**Response:**
```json
{ "success": true }
```

**DB operation:**
```sql
DELETE FROM "UserSolvedProblem"
WHERE "userId" = $userId AND "problemId" = $problemId
```

---

### 2.7 POST /api/leetcode/session-solved

**Purpose:** Preview a user's LeetCode solved problems using their session cookie. No DB writes — read-only preview before committing a full sync.

**Auth:** None required (preview is public — no user data is stored).

**Request:**
```json
{
  "session": "eyJ0eXAiOiJKV1QiLCJhbGci..."
  // Accepts raw value or full "LEETCODE_SESSION=xxx" string (prefix stripped automatically)
}
```

**Response:**
```json
// 200 OK
{
  "totalSolved": 347,
  "problems": [
    { "frontendQuestionId": "1", "title": "Two Sum", "titleSlug": "two-sum", "difficulty": "Easy" },
    ...
  ]
}

// 400
{ "error": "session is required" }

// 401
{ "error": "Session invalid or expired — no solved problems returned. Please re-copy your LEETCODE_SESSION cookie." }

// 502
{ "error": "Failed to fetch from LeetCode" }
```

**Internal logic:**
```
1. Strip "LEETCODE_SESSION=" prefix if present
2. fetchAllSolvedWithSession(session) → LeetCode GraphQL
   questionList(filters: { status: "AC" }, limit: 100, skip: 0..N)
   paginated until all pages fetched
3. If totalSolved === 0 → 401 (expired session)
4. Return { totalSolved, problems[] }
```

---

### 2.8 POST /api/leetcode/sync

**Purpose:** Full sync — import all accepted LeetCode solutions into UserSolvedProblem. This is the write path; it runs the full service and persists to DB.

**Auth:** Required. Returns 401 if unauthenticated.

**Request:**
```json
{
  "session": "eyJ0eXAiOiJKV1QiLCJhbGci..."
}
```

**Response:**
```json
// 200 OK
{
  "totalFetched":       347,   // problems returned by LeetCode
  "companiesIndexed":   662,   // total companies in DB
  "matchedInCompanies": 289,   // solved problems found in ≥1 company
  "notInAnyCompany": [
    { "frontendQuestionId": "2834", "title": "Find the Minimum Possible Sum...", "titleSlug": "...", "difficulty": "Medium" }
  ],
  "newlyMarked":        143,   // new UserSolvedProblem rows inserted this run
  "alreadySolved":      146,   // problems already in DB before this sync
  "companiesAffected":  38,    // unique companies with ≥1 of user's solved problems
  "durationMs":         2140
}

// 400
{ "error": "session is required." }

// 401
{ "error": "Sign in to sync your progress." }
{ "error": "LeetCode session expired or invalid — re-copy your LEETCODE_SESSION cookie." }

// 500
{ "error": "No solved problems returned. Session may be expired." }
```

**Internal logic (leetcode-sync.service.ts):**
```
1. fetchAllSolvedWithSession(session)
   → LeetCode GraphQL, paginated 100/page → list of AC problems
   → throw if 0 results (expired session)

2. prisma.problem.findMany({ where: { titleSlug: { in: solvedSlugs } } })
   → cross-reference against DB in one query (single-query, O(log N) on titleSlug index)
   → matchedProblems[] + notInAnyCompany[] (difference)

3. prisma.userSolvedProblem.findMany({ where: { userId } })
   → existing solved rows for this user → existingIds Set

4. newProblemIds = matchedIds.filter(id => !existingIds.has(id))
   → diff computed in JS; no DB round-trip

5. for batch of 500 in newProblemIds:
     prisma.userSolvedProblem.createMany({ data: batch, skipDuplicates: true })
   → skipDuplicates is a second safety net after the in-code diff

6. prisma.company.count()  +  $queryRaw for companiesAffected
   → final stats

No duplicate rows: (a) in-code diff, (b) skipDuplicates, (c) composite PK constraint
DB_BATCH_SIZE = 500
```

---

### 2.9 GET /api/cron/refresh-data

**Purpose:** Incremental weekly refresh of all company/problem/mapping data from GitHub CSVs into Postgres.

**Auth:** `Authorization: Bearer <CRON_SECRET>` header

**Triggered by:** Vercel Cron, `0 0 * * 0` (every Sunday midnight UTC)

**Response:**
```json
{ "companies": 662, "problems": 3310, "mappings": 40936, "durationMs": 48200 }

// 401 if secret missing or wrong
{ "error": "Unauthorized" }

// 500 on GitHub parse or DB failure
{ "error": "Could not parse GitHub page" }
```

**Internal logic:**
```
1. Fetch GitHub HTML → parse react-app embeddedData JSON → extract directory slugs
2. company.createMany(slugs, skipDuplicates: true)  [batch 500]
3. withConcurrency(tasks, CONCURRENCY=15):
   for each slug, for each period:
     fetch raw.githubusercontent.com/{slug}/{period}.csv
     parseCSV() → RawProblem[]
     accumulate into problemMap + mappingRows[]
4. problem.createMany(problemMap.values(), skipDuplicates: true)  [batch 500]
5. deduplicate mappingRows by (companyId, problemId, period)
6. companyProblem.createMany(deduped, skipDuplicates: true)  [batch 500]
```

**Why skipDuplicates everywhere?** This cron is designed to be idempotent — safe to re-run manually at any time. A transient GitHub failure mid-run doesn't corrupt data; re-running picks up where it left off.

---

### 2.10 POST /api/internal/track-active

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

### 2.11 GET /api/cron/reengagement

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
  Day 1:  User visits   → lastActiveAt=Day1
  Day 8:  Cron runs     → emails user, reengageSentAt=Day8
  Day 9:  User visits   → lastActiveAt=Day9  (now > reengageSentAt)
  Day 16: Cron runs     → reengageSentAt(Day8) < lastActiveAt(Day9) → sends again ✓
  Day 16: reengageSentAt=Day16
  Day 17: Cron runs     → reengageSentAt(Day16) > lastActiveAt(Day9) → skips ✓
```

---

### 2.12 GET /api/unsubscribe

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
    validate token matches, not expired (signInTokenExpiresAt)
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

/ (Home) — server, SSG, revalidate: 86400
├── getAllCompaniesWithStats() → prisma.$queryRaw (single query, all 662 companies)
└── CompanyGrid (client)
    ├── fetchAllCompanyProgress() on mount → single /api/user-progress call
    ├── IntersectionObserver (virtual scroll: 50 cards at a time)
    ├── Search filter (local state)
    └── CompanyCard[] (client)
        ├── Link with prefetch={false}  (prevents 662 RSC prefetch requests on load)
        └── onMouseEnter → router.prefetch(slug) + progressCache.prefetch(slug)
            (hover = user intent signal; no scroll-triggered requests)

/company/[slug] — server, SSG, revalidate: 3600
├── getCompanyProblems(slug, period) × all periods → Prisma (not GitHub)
└── CompanyProgress (client)
    ├── useCompanyProgress(slug) → { solvedSet, solvedCount, handleSolveToggle }
    │   ├── progressCache read (sync, zero-flash)
    │   └── API fetch (only if cache miss)
    ├── ProgressBar (design system colors)
    └── ProblemTable (client)
        ├── TimePeriodSelector (client)
        ├── Difficulty filter buttons
        ├── TextInput (shared component)
        ├── Spinner (on period tab switch)
        ├── Pagination (PAGE_SIZE = 30)
        └── ProblemRow[]
            └── SolveButton (client)
                ├── useSession() for auth gate
                ├── optimistic update via handleSolveToggle
                └── markSolved(problemId) / markUnsolved(problemId)
                    [NO company parameter — solve is global]

/dashboard — server, force-dynamic
├── 4 parallel DB queries via Promise.all:
│   ├── $queryRaw difficulty counts (Easy/Medium/Hard) via GROUP BY
│   ├── $queryRaw top 8 companies by unique solved problems (JOIN CompanyProblem)
│   ├── prisma.userSolvedProblem.findMany (recent 10, with problem join)
│   └── $queryRaw all solved dates for streak calculation
└── streak calculated server-side (calculateStreak utility)

/dashboard/sync — SSG (client component, no server data)
├── paste LEETCODE_SESSION cookie
├── POST /api/leetcode/session-solved → preview solved count
└── POST /api/leetcode/sync → full import → show SyncResult stats

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

// Write paths:
// 1. CompanyGrid.fetchAllCompanyProgress() → sets solvedByCompany bulk
// 2. progressCache.prefetch(slug) → sets per-company on hover
// 3. handleSolveToggle → increments/decrements in-place

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
| CompanyGrid | `solvedByCompany`, `displayCount`, `search` | Single bulk API fetch on mount, scroll, user input |
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
  (newSolved ? markSolved : markUnsolved)(problemId)   // no company param
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
  frequency: number   // relative frequency within company 0-100 (from CompanyProblem)
}

interface Company {
  slug: string        // DB slug e.g. "amazon"
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

// leetcode-sync.service.ts
interface SyncResult {
  totalFetched:       number
  companiesIndexed:   number
  matchedInCompanies: number
  notInAnyCompany:    UnmatchedProblem[]
  newlyMarked:        number
  alreadySolved:      number
  companiesAffected:  number
  durationMs:         number
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

### 7.2 Parse Logic (shared between seed script and weekly cron)

```ts
// Handles titles with commas (e.g. "Min Stack, Max Stack")
// by slicing from both ends: [0]=id, [1]=url, [-1]=freq, [-2]=acceptance, [-3]=difficulty
// Everything in between = title

const parts = line.split(',')
const id         = parseInt(parts[0])
const url        = parts[1].trim()
const frequency  = parseFloat(parts[parts.length - 1])
const acceptance = parseFloat(parts[parts.length - 2])
const difficulty = parts[parts.length - 3].trim()
const title      = parts.slice(2, parts.length - 3).join(',').trim()
const titleSlug  = url.split('/problems/')[1]?.replace(/\/$/, '')
```

### 7.3 Company List Discovery (weekly cron and seed)

```ts
// Fetches the GitHub HTML page, parses the embedded JSON (react-app embeddedData)
// to get the repository tree (list of directory names)
// Filters: contentType === 'directory' AND !name.startsWith('src')
const slugs = JSON.parse(match[1])
  .payload.codeViewRepoRoute.tree.items
  .filter(i => i.contentType === 'directory' && !i.name.startsWith('src'))
  .map(i => i.name)
```

### 7.4 Concurrency Control (withConcurrency)

```ts
// Custom pool — not Promise.all (which would fire all 662 × 5 = 3310 requests at once)
// Maintains exactly CONCURRENCY=15 in-flight requests at a time
async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number) {
  // Worker pool: each worker grabs the next task index atomically
}
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
- Footer with unsubscribe link (HMAC-SHA256 signed, no login needed)
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
  req.cookies.get('_lat')?.value === '2026-05-23'?
    YES → NextResponse.next()  (no work done)
    NO  → fire fetch to /api/internal/track-active
          set cookie: _lat=2026-05-23, maxAge=86400, httpOnly, sameSite=lax
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
```

---

## 11. Build-time Optimisations

### 11.1 Static Generation

```ts
// /company/[slug]/page.tsx

export async function generateStaticParams() {
  const companies = await getCompanyList()  // prisma.company.findMany() — NOT GitHub
  return companies.map(c => ({ slug: c.slug }))  // ONE page per company
}

// At build time, for EACH of the 662 pages:
// 1. getCompanyProblems(slug, period) × 5 periods in parallel (Prisma queries)
// 2. getCompanyStats(slug) (Prisma query)
// Total: 662 × 6 Prisma queries at build — all against Postgres, no GitHub HTTP calls
// Result: 662 pre-rendered HTML pages — each contains ALL 5 period datasets
//         Zero runtime DB queries for the happy path (static HTML served from CDN)
```

### 11.2 Memory optimization (OOM prevention)

```json
// package.json
"build": "prisma generate && node --max-old-space-size=4096 node_modules/next/dist/bin/next build"
```

Default Node.js heap is ~1.5GB. Building 662 pages concurrently exhausts this. Setting 4GB prevents OOM crashes.

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
  progressCache.prefetch(company.slug)           // API prefetch (/api/user-progress?company=slug)
}
```

### 11.4 Single bulk progress request

```tsx
// CompanyGrid — on mount (once, not per card):
const data = await fetch('/api/user-progress')        // all companies at once
progressCache.setSolvedByCompany(data.solvedByCompany) // populate for all 662

// Old approach: one /api/user-progress?company=X request per visible card on scroll
// New approach: one request for all 662 companies on mount
// Result: 520 requests → 1 request on home page load
```

---

## 12. Error Handling Strategy

| Layer | Approach |
|-------|---------|
| Prisma queries (build-time) | Returns `[]` or `{}` on error — pages show "No data" gracefully |
| API routes | Structured `{ error: string }` responses with appropriate HTTP status |
| Rate limiter | Null-safe: if Redis down, rate limiting disabled, site continues |
| Email send | Caught in try/catch, returns 500 with user-facing message |
| progressCache | `.catch(() => {})` on all prefetch calls — silent failures |
| SolveButton | Reverts optimistic update on network error or non-ok response |
| Cron job (reengagement) | `Promise.allSettled()` — one email failure doesn't block others |
| Cron job (refresh-data) | `skipDuplicates: true` — partial runs don't corrupt existing data |
| LeetCode Sync | Session error → descriptive user-facing message; network error → 502 |
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
| Home page API calls on load | 520+ (scroll prefetch) | 1 (bulk user-progress) | 99% reduction |
| Build-time GitHub calls | 3,972 HTTP requests | 0 HTTP requests | Build uses DB |
| LeetCode Sync DB lookup | N/A (old: 662 GitHub CSVs) | 1 Prisma query (titleSlug IN) | Instant |
| UserSolvedProblem row count | 1 row per (user, problem, company) | 1 row per (user, problem) | No duplication |
