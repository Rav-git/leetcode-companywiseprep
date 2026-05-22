# System Architecture Diagrams — Code Company Wise

> **How to view:** VS Code → Open Preview (⇧⌘V). Mermaid renders natively since VS Code 1.80.  
> If diagrams don't show, install the **"Markdown Preview Mermaid Support"** extension.

---

## 1 · Master Architecture — The Full Whiteboard

> *This is the one diagram you draw first. Every box is a component, every arrow is a design decision you must be able to defend.*

```mermaid
flowchart TD
    %% ── Colour palette by layer ──────────────────────────────────────────
    classDef clientCls  fill:#0d1f35,stroke:#38bdf8,stroke-width:2px,color:#7dd3fc
    classDef cacheCls   fill:#1c1200,stroke:#fbbf24,stroke-width:2px,color:#fde68a
    classDef edgeCls    fill:#140a2e,stroke:#a78bfa,stroke-width:2px,color:#c4b5fd
    classDef fnCls      fill:#071c12,stroke:#34d399,stroke-width:2px,color:#6ee7b7
    classDef dbCls      fill:#1f0808,stroke:#f87171,stroke-width:2px,color:#fca5a5
    classDef extCls     fill:#111111,stroke:#9ca3af,stroke-width:2px,color:#d1d5db
    classDef cronCls    fill:#0a0a20,stroke:#818cf8,stroke-width:2px,color:#a5b4fc

    %% ── CLIENT BROWSER ───────────────────────────────────────────────────
    subgraph BROWSER ["🌐  CLIENT BROWSER"]
        direction TB
        HP["🏠 Home  SSG ○\n662 company cards\n24h CDN cache"]
        CP["🏢 Company  ISR ●\n662 pages · 1 page per company\n5 periods bundled as props\n1h revalidation"]
        AP["🔐 Auth Pages  SSG ○\nsignin · signup · verify"]
        DP["📊 Dashboard  Dynamic ƒ\nper-user · force-dynamic"]
        CG["CompanyGrid\nIntersectionObserver\n50 cards / batch"]
        CPC["CompanyProgress\nuseCompanyProgress hook\nProgressBar + ProblemTable"]
        SBN["SolveButton\nhandleSolveToggle\noptimistic update · revert on failure"]
        PC["💾 progressCache\nmodule-level Map in RAM\nzero-flash across navigations"]
    end

    %% ── VERCEL EDGE ──────────────────────────────────────────────────────
    subgraph VEDGE ["⚡  VERCEL EDGE NETWORK"]
        CDN["🌍 Global CDN\n~666 pages pre-built\nTTFB < 100ms on cache hit"]
        MW["🔀 Edge Middleware\nJWT decode — zero DB calls\n_lat cookie dedup\nfire-and-forget activity ping"]
    end

    %% ── NEXT.JS SERVERLESS ───────────────────────────────────────────────
    subgraph FNLAYER ["☁️  SERVERLESS FUNCTIONS  (Node.js · us-east-1)"]
        NA["🔑 NextAuth v5\nCredentials Provider\nJWT → httpOnly cookie"]
        REG["POST /api/auth/register\n① upsert User  emailVerified=false\n② SHA-256 OTP → OtpCode\n③ Gmail OTP email\n④ rate-limit: 5 / hr / IP"]
        VER["POST /api/auth/verify-otp\n① compare SHA-256 hash\n② attempts ≤ 5 guard\n③ emailVerified = true\n④ signInToken 32B · 5min TTL"]
        RES["POST /api/auth/resend-otp\n① user must be unverified\n② delete old OtpCode\n③ new OTP + Gmail\n④ rate-limit: 3 / 10min / email"]
        SOL["POST /api/solve\n① auth check\n② rate-limit: 60 / min / user\n③ upsert SolvedProblem"]
        PRG["GET /api/user-progress\n?company=slug  or  all\n→ {solvedIds, count}"]
        TRK["POST /api/internal/track-active\nx-internal-secret header guard\nlastActiveAt = NOW()"]
        UNS["GET /api/unsubscribe\nHMAC-SHA256 token verify\nemailOptOut = true\nredirect /?unsubscribe=success"]
        CRN["GET /api/cron/reengagement\nBearer CRON_SECRET guard\n$queryRaw inactive ≥ 7d\nLIMIT 100 / run"]
    end

    %% ── VERCEL CRON ──────────────────────────────────────────────────────
    subgraph VCRON ["⏰  VERCEL CRON"]
        SCH["cron: 0 9 ✱ ✱ ✱  UTC\ndaily trigger at 09:00"]
    end

    %% ── DATA STORES ──────────────────────────────────────────────────────
    subgraph DSTORE ["🗄️  DATA STORES"]
        direction LR
        PG["🐘 Supabase Postgres\n─────────────────────\nUser\nOtpCode\nSolvedProblem"]
        RD["⚡ Upstash Redis\n─────────────────────\nSliding-window\nrate counters · auto-expire"]
    end

    %% ── EXTERNAL SERVICES ────────────────────────────────────────────────
    subgraph EXTSVC ["🌍  EXTERNAL SERVICES"]
        direction LR
        GH["📄 GitHub Raw CDN\n662 company CSVs\n~3,000 problems\nfetch() + 1h Next.js cache"]
        GM["📧 Gmail SMTP\nNodemailer transporter\nOTP + re-engagement emails"]
    end

    %% ── CONNECTIONS ──────────────────────────────────────────────────────

    BROWSER    -->|"HTTPS"| CDN
    CDN        -->|"cache HIT — HTML < 100ms"| BROWSER
    CDN        -->|"cache MISS → rebuild"| FNLAYER
    FNLAYER    -->|"fetch CSVs · 1h cache"| GH

    MW         -.->|"fire-and-forget\nnon-blocking POST"| TRK

    SBN        -->|"POST /api/solve"| SOL
    CG & CPC   -->|"GET /api/user-progress"| PRG
    AP         -->|"signIn credentials"| NA

    PRG        -.->|"populate on first call"| PC
    PC         -.->|"instant read · no API call"| SBN & CPC & CG

    REG        -->|"success → redirect to verify"| VER
    VER        -->|"signIn with signInToken"| NA

    NA         --> PG
    REG        --> PG
    VER        --> PG
    RES        --> PG
    SOL        -->|"upsert SolvedProblem"| PG
    PRG        --> PG
    TRK        -->|"update lastActiveAt"| PG
    UNS        -->|"emailOptOut = true"| PG
    CRN        -->|"$queryRaw + update reengageSentAt"| PG

    REG        -->|"rate limit"| RD
    RES        -->|"rate limit"| RD
    SOL        -->|"rate limit"| RD

    REG & RES  -->|"OTP email"| GM
    CRN        -->|"re-engagement email"| GM

    SCH        -->|"GET + Bearer token"| CRN

    %% ── Apply colours ────────────────────────────────────────────────────
    class HP,CP,AP,DP,CG,CPC,SBN clientCls
    class PC,RD cacheCls
    class CDN,MW edgeCls
    class NA,REG,VER,RES,SOL,PRG,TRK,UNS,CRN fnCls
    class PG dbCls
    class GH,GM extCls
    class SCH cronCls
```

---

## 2 · Authentication Flow (Deep Dive)

> *Two paths share one NextAuth Credentials provider. Interview question: "Why not OAuth?" — this system needs email ownership proof for a free tool with no social login requirement.*

```mermaid
flowchart TD
    classDef clientCls  fill:#0d1f35,stroke:#38bdf8,stroke-width:2px,color:#7dd3fc
    classDef fnCls      fill:#071c12,stroke:#34d399,stroke-width:2px,color:#6ee7b7
    classDef dbCls      fill:#1f0808,stroke:#f87171,stroke-width:2px,color:#fca5a5
    classDef extCls     fill:#111111,stroke:#9ca3af,stroke-width:2px,color:#d1d5db
    classDef decCls     fill:#1c1000,stroke:#f59e0b,stroke-width:2px,color:#fde68a
    classDef okCls      fill:#022c12,stroke:#10b981,stroke-width:2px,color:#6ee7b7
    classDef failCls    fill:#220a0a,stroke:#ef4444,stroke-width:2px,color:#fca5a5

    %% ── PATH A: REGISTRATION ─────────────────────────────────────────────
    subgraph PATHA ["PATH A — New User Registration"]
        A1["User submits SignUp form\nemail · password · name"]
        A2["POST /api/auth/register\nnormalize email lowercase+trim"]
        A3{"IP rate limit\n5 req / hr ?"}
        A4["upsert User\nemailVerified = false\nbcrypt hash password cost 12"]
        A5["deleteMany old OtpCodes\ncreate OtpCode\ncodeHash = SHA-256 code\nexpiresAt = now + 10 min\nattempts = 0"]
        A6["Gmail SMTP\nsend 6-digit OTP email"]
        A7["Redirect → /auth/verify\nURL: ?email=..."]
        A8["User reads email\nenters OTP in form"]
        A9["POST /api/auth/verify-otp\nfind OtpCode WHERE email=..."]
        A10{"OTP expired?\nattempts > 5?"}
        A11{"SHA-256 input\n=== codeHash ?"}
        A12["DELETE OtpCode record\nUser.emailVerified = true\nUser.signInToken = randomBytes 32\nUser.signInTokenExpiry = +5 min"]
        A13["Client calls signIn\ncredentials\n{ email, signInToken }"]
    end

    %% ── PATH B: SIGN IN ──────────────────────────────────────────────────
    subgraph PATHB ["PATH B — Returning User Sign In"]
        B1["User submits SignIn form\nemail · password"]
        B2["Client calls signIn\ncredentials\n{ email, password }"]
    end

    %% ── NEXTAUTH AUTHORIZE ───────────────────────────────────────────────
    subgraph AUTHZ ["NextAuth authorize  shared by both paths"]
        C1["prisma.user.findUnique\nWHERE email = input"]
        C2{"user exists?\nemailVerified = true?"}
        C3{"password path:\nbcrypt.compare hash\n\ntoken path:\nsignInToken match?\nnot expired?"}
        C4["consume signInToken\nset null in DB\none-time use enforced"]
        C5["return { id, email, name }\n→ NextAuth builds JWT payload"]
        C6["JWT signed with AUTH_SECRET\nstored in httpOnly cookie\nsession active ✓"]
    end

    %% ── ERROR STATES ─────────────────────────────────────────────────────
    E1["❌ 429 Too Many Requests"]
    E2["❌ 400 OTP Expired\nor Max Attempts Reached"]
    E3["❌ 401 Invalid OTP"]
    E4["❌ 401 Unauthorized\nno user · unverified · bad creds"]

    %% ── FLOW ─────────────────────────────────────────────────────────────
    A1 --> A2 --> A3
    A3 -->|"exceeded"| E1
    A3 -->|"ok"| A4
    A4 --> A5 --> A6 --> A7 --> A8 --> A9 --> A10
    A10 -->|"yes"| E2
    A10 -->|"no"| A11
    A11 -->|"no match"| E3
    A11 -->|"match ✓"| A12 --> A13 --> C1

    B1 --> B2 --> C1

    C1 --> C2
    C2 -->|"no"| E4
    C2 -->|"yes"| C3
    C3 -->|"fail"| E4
    C3 -->|"signInToken path"| C4 --> C5
    C3 -->|"password path"| C5
    C5 --> C6

    class A1,A7,A8,B1 clientCls
    class A2,A4,A5,A6,A9,A12,A13,B2,C1,C4,C5 fnCls
    class C2,C3,A3,A10,A11 decCls
    class C6 okCls
    class E1,E2,E3,E4 failCls
```

---

## 3 · Re-engagement Email Pipeline

> *Interview question: "How do you avoid hammering users with emails?" — three guards: emailOptOut flag, reengageSentAt < lastActiveAt condition, and LIMIT 100 per cron run.*

```mermaid
flowchart TD
    classDef edgeCls  fill:#140a2e,stroke:#a78bfa,stroke-width:2px,color:#c4b5fd
    classDef fnCls    fill:#071c12,stroke:#34d399,stroke-width:2px,color:#6ee7b7
    classDef dbCls    fill:#1f0808,stroke:#f87171,stroke-width:2px,color:#fca5a5
    classDef extCls   fill:#111111,stroke:#9ca3af,stroke-width:2px,color:#d1d5db
    classDef cronCls  fill:#0a0a20,stroke:#818cf8,stroke-width:2px,color:#a5b4fc
    classDef decCls   fill:#1c1000,stroke:#f59e0b,stroke-width:2px,color:#fde68a
    classDef okCls    fill:#022c12,stroke:#10b981,stroke-width:2px,color:#6ee7b7
    classDef skipCls  fill:#1a1a1a,stroke:#6b7280,stroke-width:1px,color:#9ca3af

    %% ── ACTIVITY TRACKING ────────────────────────────────────────────────
    subgraph TRACK_PHASE ["PHASE 1 — Activity Tracking  runs on every page visit"]
        T1["User visits any page"]
        T2["Edge Middleware runs\n(Edge Runtime — no Prisma)"]
        T3{"JWT session\nexists?"}
        T4{"_lat cookie\n= today?"}
        T5["fire-and-forget\nPOST /api/internal/track-active\n{ userId }\nDoes NOT block page load"]
        T6["Set cookie: _lat = today\nmaxAge=86400 httpOnly"]
        T7["POST handler\ncheck x-internal-secret header"]
        T8{"secret\nvalid?"}
        T9["UPDATE User\nSET lastActiveAt = NOW()\nWHERE id = userId"]
        SKIP1["skip · pass through"]
        SKIP2["skip · already tracked today"]
        SKIP3["403 Forbidden\nno DB write"]
    end

    %% ── CRON PHASE ───────────────────────────────────────────────────────
    subgraph CRON_PHASE ["PHASE 2 — Daily Cron  09:00 UTC every day"]
        C1["Vercel Cron triggers\nGET /api/cron/reengagement\nAuthorization: Bearer CRON_SECRET"]
        C2{"Bearer token\nvalid?"}
        C3["$queryRaw\nSELECT id, email, name FROM User\nWHERE emailVerified = true\nAND emailOptOut = false\nAND lastActiveAt < now - 7d\nAND reengageSentAt IS NULL\n    OR reengageSentAt < lastActiveAt\nLIMIT 100"]
        C4["Promise.allSettled\nprocess each user concurrently"]
        C5["sendReengagementEmail\nPersonalised HTML\nSubject: firstName your prep is waiting\nUnsubscribe link: HMAC-SHA256 signed URL"]
        C6["Gmail SMTP\nsend email"]
        C7["UPDATE User\nSET reengageSentAt = NOW()\nWHERE id = userId"]
        C8["return { sent, failed }\nlog results"]
        SKIP4["401 Unauthorized"]
    end

    %% ── UNSUBSCRIBE PHASE ────────────────────────────────────────────────
    subgraph UNSUB_PHASE ["PHASE 3 — Unsubscribe  user-triggered"]
        U1["User clicks unsubscribe\nin email footer"]
        U2["GET /api/unsubscribe\n?email=...&token=..."]
        U3{"HMAC-SHA256\nexpected === token?"}
        U4["UPDATE User\nSET emailOptOut = true\nWHERE email = input"]
        U5["redirect\n/?unsubscribe=success"]
        U6["redirect\n/?unsubscribe=invalid"]
    end

    %% ── FLOW ─────────────────────────────────────────────────────────────
    T1 --> T2 --> T3
    T3 -->|"no session"| SKIP1
    T3 -->|"has session"| T4
    T4 -->|"yes"| SKIP2
    T4 -->|"no"| T5
    T5 --> T6
    T5 -->|"async"| T7 --> T8
    T8 -->|"invalid"| SKIP3
    T8 -->|"valid"| T9

    C1 --> C2
    C2 -->|"invalid"| SKIP4
    C2 -->|"valid"| C3 --> C4
    C4 --> C5 --> C6
    C4 --> C7
    C6 & C7 --> C8

    U1 --> U2 --> U3
    U3 -->|"invalid"| U6
    U3 -->|"valid"| U4 --> U5

    C5 -.->|"email with\nunsubscribe link"| U1

    class T2 edgeCls
    class T5,T7,T9,C1,C3,C4,C5,C7,C8,U2,U4 fnCls
    class T9,C7,U4 dbCls
    class C6 extCls
    class T3,T4,T8,C2,U3 decCls
    class U5,C8 okCls
    class SKIP1,SKIP2,SKIP3,SKIP4,U6 skipCls
```

---

## 4 · Caching Strategy — 4 Layers

> *Interview question: "What happens if GitHub goes down?" — Layer 3 serves stale cache, users see old (but valid) data. Static pages still work. Only live API calls break.*

```mermaid
flowchart LR
    classDef userCls   fill:#0d1f35,stroke:#38bdf8,stroke-width:2px,color:#7dd3fc
    classDef l1Cls     fill:#1c3d00,stroke:#84cc16,stroke-width:2px,color:#bef264
    classDef l2Cls     fill:#140a2e,stroke:#a78bfa,stroke-width:2px,color:#c4b5fd
    classDef l3Cls     fill:#1c1200,stroke:#fbbf24,stroke-width:2px,color:#fde68a
    classDef l4Cls     fill:#1f0a0a,stroke:#f87171,stroke-width:2px,color:#fca5a5
    classDef dbCls     fill:#1f0808,stroke:#ef4444,stroke-width:2px,color:#fca5a5
    classDef extCls    fill:#111111,stroke:#9ca3af,stroke-width:2px,color:#d1d5db

    USER["👤 User\nBrowser"]

    subgraph L1 ["Layer 1 — Browser Module Cache"]
        PC["progressCache\nMap in JS RAM\n\nsolvedByCompany\nRecord&lt;slug, count&gt;\n\nper-company\n{ solvedIds Set, count }\n\nLifetime: browser tab session\nPopulated: first API call\nUpdated: every solve toggle"]
    end

    subgraph L2 ["Layer 2 — Vercel CDN  Global Edge"]
        CDN["Pre-built HTML pages\n\n/  → revalidate: 86400s  24h\n/company/slug  → revalidate: 3600s  1h\n\nTTFB < 100ms on hit\n~666 pages cached globally\n662 company + home + auth + error\n\nAPI routes  → NO cache\nDashboard   → NO cache"]
    end

    subgraph L3 ["Layer 3 — Next.js Server Fetch Cache"]
        NFC["fetch() results cached in\nNext.js data cache\n\nfetchCompanyList()       → 24h\nfetchProblems(slug,per)  → 1h\nfetchCompanyStats()      → 24h\n\nUser-progress API    → no-store\nDynamic pages        → no-store\n\nShared across all requests\nto the same server instance"]
    end

    subgraph L4 ["Layer 4 — Upstash Redis  Rate Limiting only"]
        REDIS["Sliding-window counters\nauto-expire keys\n\nregistration:   5 / hr / IP\nresend-otp:     3 / 10min / email\nsolve:          60 / min / user\n\nDegrades gracefully:\nif Redis down → rate limiting\ndisabled, site still works"]
    end

    PG["🐘 Supabase Postgres\nSource of truth\nfor all user data"]

    GH["📄 GitHub CDN\nSource of truth\nfor problem data"]

    %% ── Read path (solved state) ──
    USER -->|"solved state for company?"| L1
    L1   -->|"HIT — instant render"| USER
    L1   -->|"MISS — fetch"| L2
    L2   -->|"page HIT"| USER
    L2   -->|"MISS → rebuild page"| L3
    L3   -->|"problem data HIT"| L2
    L3   -->|"MISS — fetch"| GH
    GH   -->|"CSV data"| L3

    %% ── Solve action (write path) ──
    USER -->|"mark solved"| L4
    L4   -->|"under limit"| PG
    PG   -->|"write confirms"| L1
    L1   -.->|"cache updated"| USER

    %% ── User progress read ──
    USER -->|"GET /api/user-progress"| PG
    PG   -->|"solvedIds"| L1

    class USER userCls
    class PC l1Cls
    class CDN l2Cls
    class NFC l3Cls
    class REDIS l4Cls
    class PG dbCls
    class GH extCls
```

---

## 5 · Database Schema (Entity–Relationship)

> *Interview question: "Why store company in SolvedProblem?" — a user can solve the same problem in different company contexts; (userId, problemId, company) is the true unique key.*

```mermaid
erDiagram
    User {
        String  id              PK  "cuid()"
        String  email           UK  "unique · nullable for OAuth future"
        String  name                "nullable display name"
        String  password            "bcrypt cost-12 · nullable"
        Boolean emailVerified       "default false · gate for auth"
        DateTime createdAt          "default now()"
        DateTime lastActiveAt   IDX "default now() · INDEX for cron query"
        DateTime reengageSentAt     "nullable · compared vs lastActiveAt"
        Boolean emailOptOut         "default false · GDPR exit"
        String  signInToken         "nullable · 32-byte random · single-use"
        DateTime signInTokenExpiry  "nullable · 5-minute TTL"
    }

    OtpCode {
        String  id        PK  "cuid()"
        String  email     IDX "not a FK — looked up by email string"
        String  codeHash      "SHA-256 hex — plaintext never stored"
        Int     attempts      "default 0 · max 5 guard"
        DateTime expiresAt    "now + 10 minutes"
        DateTime createdAt    "default now()"
    }

    SolvedProblem {
        String  id        PK  "cuid()"
        String  userId    FK  "cascade delete"
        Int     problemId     "LeetCode problem number"
        String  company       "company slug e.g. google"
        DateTime solvedAt     "default now()"
    }

    User         ||--o{ SolvedProblem : "has solved"
    User         ||--o{ OtpCode       : "requests OTP via email match"
```

**Index summary:**

| Table | Index | Type | Purpose |
|---|---|---|---|
| User | `email` | UNIQUE | fast lookup on sign-in |
| User | `lastActiveAt` | B-Tree | cron query: `WHERE lastActiveAt < 7d` |
| OtpCode | `email` | B-Tree | find OTP during verify flow |
| SolvedProblem | `(userId, problemId, company)` | UNIQUE | upsert idempotency |
| SolvedProblem | `(userId, company)` | B-Tree | fetch all solved for a company |

---

## 6 · Solve a Problem — End-to-End Flow

> *Interview question: "Why optimistic update?" — 60ms network latency per click feels sluggish at 100 rapid marks. Optimistic UI removes perceived lag; revert on failure keeps correctness.*

```mermaid
flowchart TD
    classDef clientCls fill:#0d1f35,stroke:#38bdf8,stroke-width:2px,color:#7dd3fc
    classDef cacheCls  fill:#1c1200,stroke:#fbbf24,stroke-width:2px,color:#fde68a
    classDef fnCls     fill:#071c12,stroke:#34d399,stroke-width:2px,color:#6ee7b7
    classDef dbCls     fill:#1f0808,stroke:#f87171,stroke-width:2px,color:#fca5a5
    classDef decCls    fill:#1c1000,stroke:#f59e0b,stroke-width:2px,color:#fde68a
    classDef okCls     fill:#022c12,stroke:#10b981,stroke-width:2px,color:#6ee7b7
    classDef failCls   fill:#220a0a,stroke:#ef4444,stroke-width:2px,color:#fca5a5

    U1["👤 User clicks checkbox\nSolveButton component"]
    U2["Optimistic update\nsetSolved !prev  immediately\nUI reflects change in < 16ms"]
    U3["POST /api/solve\n{ problemId, company }"]

    subgraph SERVER ["Server-side — /api/solve"]
        S1["auth  read JWT from cookie\nsession.user.id"]
        S2{"session\nexists?"}
        S3["Upstash Redis\nslidingWindow 60 / 1 min\nper userId"]
        S4{"rate limit\nok?"}
        S5["prisma.solvedProblem.upsert\nWHERE userId+problemId+company\ncreate if not exists · update noop"]
        S6["return 200\n{ solved: true }"]
    end

    subgraph CLIENT_CACHE ["Client — progressCache update"]
        CC1["progressCache.solvedIds\nadd or delete problemId"]
        CC2["progressCache.solvedCount\nincrement or decrement"]
        CC3["CompanyGrid card count\nupdates without API call"]
    end

    FAIL1["❌ 401 → revert UI\nsetSolved prev\nshow toast: sign in required"]
    FAIL2["❌ 429 → revert UI\nsetSolved prev\nshow toast: slow down"]
    FAIL3["❌ 500 → revert UI\nsetSolved prev\nshow toast: try again"]

    U1 --> U2
    U2 -->|"async — does not await"| U3
    U3 --> S1 --> S2
    S2 -->|"no session"| FAIL1
    S2 -->|"ok"| S3 --> S4
    S4 -->|"exceeded"| FAIL2
    S4 -->|"ok"| S5 --> S6
    S6 -->|"200 success"| CC1
    CC1 --> CC2 --> CC3
    S6 -->|"network error"| FAIL3

    class U1,U2 clientCls
    class CC1,CC2,CC3 cacheCls
    class S1,S3,S5,S6 fnCls
    class S5 dbCls
    class S2,S4 decCls
    class CC3 okCls
    class FAIL1,FAIL2,FAIL3 failCls
```

---

## 7 · Request Lifecycle Decision Tree

> *Interview question: "How do you decide what to SSG vs SSR vs dynamic?" — if the page content depends on who's viewing it, it must be dynamic. Everything else should be static.*

```mermaid
flowchart TD
    classDef edgeCls   fill:#140a2e,stroke:#a78bfa,stroke-width:2px,color:#c4b5fd
    classDef staticCls fill:#0d1f35,stroke:#38bdf8,stroke-width:2px,color:#7dd3fc
    classDef dynCls    fill:#071c12,stroke:#34d399,stroke-width:2px,color:#6ee7b7
    classDef decCls    fill:#1c1000,stroke:#f59e0b,stroke-width:2px,color:#fde68a
    classDef cacheCls  fill:#1c1200,stroke:#fbbf24,stroke-width:2px,color:#fde68a

    REQ["Incoming HTTP Request"]
    MW["Edge Middleware runs first\nJWT decode · _lat cookie check\napplies to non-API, non-static routes"]
    D1{"Is it a\nstatic asset?"}
    D2{"Is it an\nAPI route?"}
    D3{"Which page?"}
    D4{"CDN cache\nhit?"}

    ASSET["Serve from CDN\n_next/static files\nfavicons · images"]
    API["Route to serverless function\nNode.js runtime\nus-east-1"]
    STATIC["Static page\nHome · Company · Auth\nPre-built HTML from CDN"]
    DYNAMIC["Dynamic page\nDashboard only\nServer render per request"]
    CDNHIT["Return cached HTML\nTTFB < 100ms\nglobally distributed"]
    CDNMISS["Next.js rebuilds page\nfetchCompanyList or fetchProblems\nrefill CDN cache"]
    AUTH_CHECK["auth  validate JWT\nif invalid → redirect /auth/signin"]

    REQ --> MW --> D1
    D1 -->|"yes"| ASSET
    D1 -->|"no"| D2
    D2 -->|"yes"| API
    D2 -->|"no"| D3
    D3 -->|"Dashboard"| AUTH_CHECK --> DYNAMIC
    D3 -->|"Home · Company · Auth"| D4
    D4 -->|"hit"| CDNHIT
    D4 -->|"miss or stale"| CDNMISS
    CDNMISS -->|"rebuilt page"| CDNHIT

    class MW edgeCls
    class CDNHIT,ASSET,STATIC staticCls
    class API,DYNAMIC,AUTH_CHECK dynCls
    class D1,D2,D3,D4 decCls
    class CDNMISS cacheCls
```

---

## 8 · Security Threat Model

> *Interview question: "Walk me through your auth security." — five layers: rate limiting, OTP hashing, bcrypt, single-use tokens, and emailVerified gate. No single failure compromises the account.*

```mermaid
flowchart LR
    classDef threatCls  fill:#2d0808,stroke:#ef4444,stroke-width:2px,color:#fca5a5
    classDef guardCls   fill:#022c12,stroke:#10b981,stroke-width:2px,color:#6ee7b7
    classDef layerCls   fill:#0d1f35,stroke:#38bdf8,stroke-width:2px,color:#7dd3fc

    subgraph THREATS ["🔴  THREATS"]
        T1["Brute-force\nregistration"]
        T2["OTP brute-force"]
        T3["OTP interception\nin DB breach"]
        T4["Password exposure\nin DB breach"]
        T5["signInToken\ntheft or replay"]
        T6["Unverified\naccount sign-in"]
        T7["Solve spam\nflooding"]
        T8["Resend OTP\nflooding"]
        T9["Cron endpoint\nabuse"]
        T10["Internal endpoint\nabuse"]
        T11["Unsubscribe\nforgery"]
        T12["SQL injection"]
    end

    subgraph GUARDS ["🟢  MITIGATIONS"]
        G1["Rate limit: 5 req / hr / IP\nUpstash sliding window"]
        G2["5 attempt limit per OtpCode\n+ rate limit: 10 req / 10min / IP"]
        G3["SHA-256 hash stored\n10-minute expiry\nno plaintext ever written"]
        G4["bcrypt cost-12\nnever logged · never returned"]
        G5["32-byte random token\n5-minute TTL\nnullified on first use"]
        G6["emailVerified = false\nblocks authorize() entirely"]
        G7["Rate limit: 60 req / min / userId"]
        G8["Rate limit: 3 req / 10min / email"]
        G9["Authorization: Bearer CRON_SECRET\nVercel env var · not in code"]
        G10["x-internal-secret header\nVercel env var · not in code"]
        G11["HMAC-SHA256 signed token\nkeyed with AUTH_SECRET"]
        G12["Prisma parameterized queries\n$queryRaw uses tagged templates"]
    end

    T1  -->|"blocked by"| G1
    T2  -->|"blocked by"| G2
    T3  -->|"mitigated by"| G3
    T4  -->|"mitigated by"| G4
    T5  -->|"mitigated by"| G5
    T6  -->|"blocked by"| G6
    T7  -->|"blocked by"| G7
    T8  -->|"blocked by"| G8
    T9  -->|"blocked by"| G9
    T10 -->|"blocked by"| G10
    T11 -->|"blocked by"| G11
    T12 -->|"blocked by"| G12

    class T1,T2,T3,T4,T5,T6,T7,T8,T9,T10,T11,T12 threatCls
    class G1,G2,G3,G4,G5,G6,G7,G8,G9,G10,G11,G12 guardCls
```

---

## Interview Discussion Map

| Diagram | Interview Time | Key Questions It Answers |
|---|---|---|
| **1 · Master Architecture** | 0–20 min | What are all the components? Why this tech stack? |
| **5 · DB Schema** | 20–35 min | Why these tables? What are the indexes? Why not store difficulty in DB? |
| **2 · Auth Flow** | 35–55 min | How does OTP work? Why SHA-256 not bcrypt for OTP? What is signInToken? |
| **4 · Caching** | 55–70 min | How do you get TTFB < 100ms? What breaks when GitHub is down? |
| **3 · Re-engagement** | 70–85 min | How does lastActiveAt get updated? Why fire-and-forget? How do you avoid email spam? |
| **6 · Solve Flow** | 85–95 min | Why optimistic update? How do you keep cache consistent? |
| **7 · Request Lifecycle** | 95–105 min | How does Next.js decide static vs dynamic? Why is the layout static? |
| **8 · Security** | 105–120 min | Walk through each threat vector and mitigation |
