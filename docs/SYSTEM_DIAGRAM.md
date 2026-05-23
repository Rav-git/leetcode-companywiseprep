# System Architecture Diagrams — Code Company Wise

## 1 · Master Architecture — The Full Whiteboard

> *This is the one diagram you draw first. Every box is a component, every arrow is a design decision you must be able to defend.*
>
> *Interview question: "Where does GitHub fit?" — Only the weekly refresh cron touches GitHub. Zero runtime page requests go to GitHub.*

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
    subgraph BROWSER ["CLIENT BROWSER"]
        direction TB
        HP["Home  SSG\n662 company cards\n24h CDN cache"]
        CP["Company  ISR\n662 pages · all 5 periods bundled\n1h revalidation"]
        AP["Auth Pages  SSG\nsignin · signup · verify"]
        DP["Dashboard  Dynamic\nper-user · force-dynamic\n4 parallel DB queries"]
        SP["Sync Page  SSG\n/dashboard/sync\npure client · paste session cookie"]
        CG["CompanyGrid\nfetchAllCompanyProgress on mount\n1 bulk /api/user-progress call"]
        CPC["CompanyProgress\nuseCompanyProgress hook\nProgressBar + ProblemTable"]
        SBN["SolveButton\nmarkSolved(problemId)\nno company param\noptimistic update · revert on failure"]
        PC["progressCache\nmodule-level Map in RAM\nzero-flash across navigations"]
    end

    %% ── VERCEL EDGE ──────────────────────────────────────────────────────
    subgraph VEDGE ["VERCEL EDGE NETWORK"]
        CDN["Global CDN\n~666 pages pre-built\nTTFB < 100ms on cache hit"]
        MW["Edge Middleware\nJWT decode — zero DB calls\n_lat cookie dedup\nfire-and-forget activity ping"]
    end

    %% ── NEXT.JS SERVERLESS ───────────────────────────────────────────────
    subgraph FNLAYER ["SERVERLESS FUNCTIONS  (Node.js · us-east-1)"]
        NA["NextAuth v5\nCredentials Provider\nJWT → httpOnly cookie"]
        REG["POST /api/auth/register\nupsert User  emailVerified=false\nSHA-256 OTP → OtpCode\nGmail OTP email\nrate-limit: 5 / hr / IP"]
        VER["POST /api/auth/verify-otp\ncompare SHA-256 hash\nattempts ≤ 5 guard\nemailVerified = true\nsignInToken 32B · 5min TTL"]
        RES["POST /api/auth/resend-otp\ndelete old OtpCode\nnew OTP + Gmail\nrate-limit: 3 / 10min / email"]
        SOL["POST /api/solve\nauth check\nrate-limit: 60 / min / user\nupsert UserSolvedProblem(userId, problemId)"]
        DSOL["DELETE /api/solve\nauth check\nrate-limit: shared with POST\ndelete UserSolvedProblem"]
        PRG["GET /api/user-progress\n?company=slug — JOIN CompanyProblem\nno param — bulk all companies\nreturns {solvedIds} or {solvedByCompany}"]
        TRK["POST /api/internal/track-active\nx-internal-secret header guard\nlastActiveAt = NOW()"]
        UNS["GET /api/unsubscribe\nHMAC-SHA256 token verify\nemailOptOut = true\nredirect /?unsubscribe=success"]
        CRN["GET /api/cron/reengagement\nBearer CRON_SECRET guard\n$queryRaw inactive >= 7d\nLIMIT 100 / run"]
        REF["GET /api/cron/refresh-data\nBearer CRON_SECRET guard\nfetch GitHub CSVs · 15-concurrency\nupsert Company + Problem + CompanyProblem\nskipDuplicates — safe to re-run"]
        LSS["POST /api/leetcode/session-solved\npreview: LeetCode GraphQL → AC problems\nno DB writes"]
        LSY["POST /api/leetcode/sync\nauth check\nLeetCode GraphQL → AC problems\nJoin against Problem table\nbatch insert UserSolvedProblem\nreturns SyncResult"]
    end

    %% ── VERCEL CRON ──────────────────────────────────────────────────────
    subgraph VCRON ["VERCEL CRON"]
        SCH1["cron: 0 9 * * * UTC\ndaily 09:00 — re-engagement emails"]
        SCH2["cron: 0 0 * * 0 UTC\nweekly Sunday midnight — data refresh"]
    end

    %% ── DATA STORES ──────────────────────────────────────────────────────
    subgraph DSTORE ["DATA STORES"]
        direction LR
        PG["Supabase Postgres\n─────────────────────\nUser\nOtpCode\nCompany\nProblem\nCompanyProblem\nUserSolvedProblem"]
        RD["Upstash Redis\n─────────────────────\nSliding-window\nrate counters · auto-expire"]
    end

    %% ── EXTERNAL SERVICES ────────────────────────────────────────────────
    subgraph EXTSVC ["EXTERNAL SERVICES"]
        direction LR
        GH["GitHub Raw CDN\n662 company CSVs\nWeekly cron only\nNOT in runtime path"]
        GM["Gmail SMTP\nNodemailer transporter\nOTP + re-engagement emails"]
        LC["LeetCode GraphQL API\nquestionList status:AC\nUser-initiated sync only"]
    end

    %% ── CONNECTIONS ──────────────────────────────────────────────────────

    BROWSER    -->|"HTTPS"| CDN
    CDN        -->|"cache HIT — HTML < 100ms"| BROWSER
    CDN        -->|"cache MISS → rebuild from DB"| FNLAYER

    MW         -.->|"fire-and-forget\nnon-blocking POST"| TRK

    SBN        -->|"POST /api/solve { problemId }"| SOL
    SBN        -->|"DELETE /api/solve { problemId }"| DSOL
    CG & CPC   -->|"GET /api/user-progress"| PRG
    AP         -->|"signIn credentials"| NA
    SP         -->|"POST session-solved"| LSS
    SP         -->|"POST sync"| LSY

    PRG        -.->|"populate on first call"| PC
    PC         -.->|"instant read · no API call"| SBN & CPC & CG

    REG        -->|"success → redirect to verify"| VER
    VER        -->|"signIn with signInToken"| NA

    NA         --> PG
    REG        --> PG
    VER        --> PG
    RES        --> PG
    SOL        -->|"upsert UserSolvedProblem"| PG
    DSOL       -->|"delete UserSolvedProblem"| PG
    PRG        -->|"JOIN CompanyProblem"| PG
    TRK        -->|"update lastActiveAt"| PG
    UNS        -->|"emailOptOut = true"| PG
    CRN        -->|"$queryRaw + reengageSentAt"| PG
    REF        -->|"upsert all 4 entity types"| PG
    LSY        -->|"findMany + createMany"| PG

    REG        -->|"rate limit"| RD
    RES        -->|"rate limit"| RD
    SOL & DSOL -->|"rate limit"| RD

    REG & RES  -->|"OTP email"| GM
    CRN        -->|"re-engagement email"| GM

    SCH1       -->|"GET + Bearer token"| CRN
    SCH2       -->|"GET + Bearer token"| REF
    REF        -->|"ONLY connection to GitHub\nweekly · not runtime"| GH

    LSS        -->|"GraphQL AC solved list"| LC
    LSY        -->|"GraphQL AC solved list"| LC

    %% ── Apply colours ────────────────────────────────────────────────────
    class HP,CP,AP,DP,SP,CG,CPC,SBN clientCls
    class PC,RD cacheCls
    class CDN,MW edgeCls
    class NA,REG,VER,RES,SOL,DSOL,PRG,TRK,UNS,CRN,REF,LSS,LSY fnCls
    class PG dbCls
    class GH,GM,LC extCls
    class SCH1,SCH2 cronCls
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
        A12["DELETE OtpCode record\nUser.emailVerified = true\nUser.signInToken = randomBytes 32\nUser.signInTokenExpiresAt = +5 min"]
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
        C3{"password path:\nbcrypt.compare hash\n\ntoken path:\nsignInToken match?\nnot expired? (signInTokenExpiresAt)"}
        C4["consume signInToken\nset null in DB\none-time use enforced"]
        C5["return { id, email, name }\n→ NextAuth builds JWT payload"]
        C6["JWT signed with AUTH_SECRET\nstored in httpOnly cookie\nsession active"]
    end

    %% ── ERROR STATES ─────────────────────────────────────────────────────
    E1["429 Too Many Requests"]
    E2["400 OTP Expired\nor Max Attempts Reached"]
    E3["401 Invalid OTP"]
    E4["401 Unauthorized\nno user · unverified · bad creds"]

    %% ── FLOW ─────────────────────────────────────────────────────────────
    A1 --> A2 --> A3
    A3 -->|"exceeded"| E1
    A3 -->|"ok"| A4
    A4 --> A5 --> A6 --> A7 --> A8 --> A9 --> A10
    A10 -->|"yes"| E2
    A10 -->|"no"| A11
    A11 -->|"no match"| E3
    A11 -->|"match"| A12 --> A13 --> C1

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

## 3 · LeetCode Sync Flow (New Subsystem)

> *Interview question: "How do you avoid inserting duplicates during sync?" — three layers: in-code diff against existing rows, skipDuplicates on createMany, and the composite PK constraint at the DB level.*

```mermaid
flowchart TD
    classDef clientCls fill:#0d1f35,stroke:#38bdf8,stroke-width:2px,color:#7dd3fc
    classDef fnCls     fill:#071c12,stroke:#34d399,stroke-width:2px,color:#6ee7b7
    classDef dbCls     fill:#1f0808,stroke:#f87171,stroke-width:2px,color:#fca5a5
    classDef extCls    fill:#111111,stroke:#9ca3af,stroke-width:2px,color:#d1d5db
    classDef decCls    fill:#1c1000,stroke:#f59e0b,stroke-width:2px,color:#fde68a
    classDef okCls     fill:#022c12,stroke:#10b981,stroke-width:2px,color:#6ee7b7
    classDef failCls   fill:#220a0a,stroke:#ef4444,stroke-width:2px,color:#fca5a5

    U1["User opens /dashboard/sync\nPastes LEETCODE_SESSION cookie"]

    subgraph PREVIEW ["OPTIONAL PREVIEW"]
        P1["POST /api/leetcode/session-solved\n{ session }"]
        P2["fetchAllSolvedWithSession(session)\nLeetCode GraphQL questionList\nstatus: AC · paginated 100/page"]
        P3{"totalSolved\n=== 0?"}
        P4["Return preview:\n{ totalSolved, problems[] }\nNo DB writes"]
    end

    subgraph SYNC ["FULL SYNC — POST /api/leetcode/sync"]
        S1["auth() → session.user.id\n401 if unauthenticated"]
        S2["fetchAllSolvedWithSession(session)\nLeetCode GraphQL → all AC problems\nthrow if 0 results"]
        S3["prisma.problem.findMany\nWHERE titleSlug IN solvedSlugs\nSingle DB query — not 662 GitHub CSVs"]
        S4["Split into:\nmatchedProblems — in CompanyProblem DB\nnotInAnyCompany — not tracked by any company"]
        S5["prisma.userSolvedProblem.findMany\nWHERE userId = session.user.id\nexistingIds = Set of problemIds"]
        S6["newProblemIds = matched.filter\nid NOT IN existingIds\nalreadySolved = matched.length - new.length"]
        S7["for batch of 500 in newProblemIds:\nprisma.userSolvedProblem.createMany\nskipDuplicates: true\nnewlyMarked += count"]
        S8["prisma.company.count()\n$queryRaw DISTINCT companyId\nWHERE userId = ... JOIN CompanyProblem"]
        S9["Return SyncResult:\ntotalFetched · matchedInCompanies\nnotInAnyCompany · newlyMarked\nalreadySolved · companiesAffected\ndurationMs"]
    end

    FAIL1["401 — session invalid or expired\nLeetCode session expired or invalid"]
    FAIL2["401 — not authenticated\nSign in to sync your progress"]

    U1 -->|"preview first"| P1
    P1 --> P2 --> P3
    P3 -->|"yes — session expired"| FAIL1
    P3 -->|"no"| P4
    P4 -.->|"user confirms"| S1

    U1 -->|"direct sync"| S1
    S1 -->|"no session"| FAIL2
    S1 -->|"authenticated"| S2
    S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8 --> S9

    class U1 clientCls
    class P1,P2,P4,S1,S2,S3,S4,S5,S6,S7,S8,S9 fnCls
    class P3 decCls
    class S9 okCls
    class FAIL1,FAIL2 failCls
```

---

## 4 · Re-engagement Email Pipeline

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
        C3["$queryRaw\nSELECT id, email, name FROM User\nWHERE emailVerified = true\nAND emailOptOut = false\nAND lastActiveAt < now - 7d\nAND (reengageSentAt IS NULL\n    OR reengageSentAt < lastActiveAt)\nLIMIT 100"]
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

## 5 · Data Refresh Pipeline — Weekly Cron

> *Interview question: "What happens if GitHub is down?" — the cron skips that week's run. All existing data stays in Postgres untouched. The site is completely unaffected because no runtime page requests go to GitHub.*

```mermaid
flowchart TD
    classDef cronCls fill:#0a0a20,stroke:#818cf8,stroke-width:2px,color:#a5b4fc
    classDef fnCls   fill:#071c12,stroke:#34d399,stroke-width:2px,color:#6ee7b7
    classDef extCls  fill:#111111,stroke:#9ca3af,stroke-width:2px,color:#d1d5db
    classDef dbCls   fill:#1f0808,stroke:#f87171,stroke-width:2px,color:#fca5a5
    classDef decCls  fill:#1c1000,stroke:#f59e0b,stroke-width:2px,color:#fde68a
    classDef okCls   fill:#022c12,stroke:#10b981,stroke-width:2px,color:#6ee7b7

    SCH["Vercel Cron: 0 0 every Sunday midnight UTC\nGET /api/cron/refresh-data\nAuthorization: Bearer CRON_SECRET"]

    S1["Fetch GitHub HTML page\nparse react-app embeddedData JSON\nextract 662 directory slugs"]
    S2["company.createMany(slugs)\nskipDuplicates: true\nbatch 500"]
    S3["company.findMany\nbuild slug → id Map"]

    subgraph POOL ["withConcurrency pool  CONCURRENCY = 15"]
        W1["for each of 662 slugs:\nfor each of 5 periods:\nfetch raw.githubusercontent.com\n  slug/period.csv\nparseCSV → RawProblem[]"]
        W2["accumulate into:\nproblemMap (id → RawProblem)\nmappingRows (companyId · problemId · period · freq)"]
    end

    S4["problem.createMany(problemMap.values())\nskipDuplicates: true · batch 500"]
    S5["deduplicate mappingRows\nby (companyId, problemId, period)\nSet-based dedup"]
    S6["companyProblem.createMany(deduped)\nskipDuplicates: true · batch 500"]
    S7["return { companies · problems · mappings · durationMs }\nconsole.log for observability"]

    SCH --> S1 --> S2 --> S3 --> POOL
    W1 --> W2
    POOL --> S4 --> S5 --> S6 --> S7

    class SCH cronCls
    class S1,S2,S3,S4,S5,S6,S7,W1,W2 fnCls
    class S7 okCls
```

---

## 6 · Caching Strategy — 3 Layers

> *Interview question: "What happens if Postgres is down?" — API routes return 500. But static pages (662 company pages + home page) are already built and cached on Vercel's CDN globally — they continue serving to users. Only solve tracking breaks.*

```mermaid
flowchart LR
    classDef userCls   fill:#0d1f35,stroke:#38bdf8,stroke-width:2px,color:#7dd3fc
    classDef l1Cls     fill:#1c3d00,stroke:#84cc16,stroke-width:2px,color:#bef264
    classDef l2Cls     fill:#140a2e,stroke:#a78bfa,stroke-width:2px,color:#c4b5fd
    classDef l3Cls     fill:#1f0a0a,stroke:#f87171,stroke-width:2px,color:#fca5a5
    classDef dbCls     fill:#1f0808,stroke:#ef4444,stroke-width:2px,color:#fca5a5
    classDef notesCls  fill:#111111,stroke:#9ca3af,stroke-width:1px,color:#d1d5db

    USER["User\nBrowser"]

    subgraph L1 ["Layer 1 — Browser Module Cache"]
        PC["progressCache\nMap in JS RAM\n\nsolvedByCompany\nRecord slug to count\nPopulated: single /api/user-progress call on mount\n\nper-company\n{ solvedIds Set, count }\nPopulated: hover prefetch or direct visit\n\nLifetime: browser tab session\nUpdated: every solve toggle\nReads: synchronous — zero flash"]
    end

    subgraph L2 ["Layer 2 — Vercel CDN  Global Edge"]
        CDN["Pre-built HTML pages\n\n/  → revalidate: 86400s  24h\n/company/slug  → revalidate: 3600s  1h\n\nTTFB < 100ms on hit\n~666 pages cached globally\n662 company + home + auth + error\n\nAPI routes  → NO cache\nDashboard   → NO cache\nSync page   → SSG static shell"]
    end

    subgraph L3 ["Layer 3 — Supabase Postgres  Source of Truth"]
        PG["All data — problem data + user data\n\nCompany · Problem · CompanyProblem\nread at BUILD TIME via Prisma\n→ baked into static HTML\n\nUserSolvedProblem\nread at REQUEST TIME by API routes\n\nNO Next.js fetch cache layer\nPrisma is direct TCP — not HTTP fetch\nSo there is no fetch-cache to configure"]
    end

    subgraph L4 ["Layer 4 — Upstash Redis  Rate Limiting Only"]
        REDIS["Sliding-window counters\nauto-expire keys\n\nregistration:  5 / hr / IP\nresend-otp:    3 / 10min / email\nsolve:         60 / min / user\n\nDegrades gracefully:\nif Redis down → site still works\nrate limiting silently disabled"]
    end

    %% ── Read path (company page) ──
    USER -->|"visit /company/slug"| L2
    L2   -->|"cache HIT — instant HTML"| USER
    L2   -->|"cache MISS → rebuild from DB"| L3
    L3   -->|"problem data for page"| L2

    %% ── Read path (solved state) ──
    USER -->|"solved state?"| L1
    L1   -->|"HIT — instant render"| USER
    L1   -->|"MISS — fetch"| L3
    L3   -->|"solvedIds via JOIN"| L1

    %% ── Solve action (write path) ──
    USER -->|"mark solved"| L4
    L4   -->|"under limit"| L3
    L3   -->|"write confirmed"| L1

    class USER userCls
    class PC l1Cls
    class CDN l2Cls
    class PG l3Cls
    class REDIS l4Cls
```

---

## 7 · Database Schema (Entity-Relationship)

> *Interview question: "Why is there no company column in UserSolvedProblem?" — in v1, solving 'Two Sum' for Amazon and Google were separate rows. That caused duplication and made sync hard. Now solve is global; company coverage is queried via JOIN through CompanyProblem at read time.*

```mermaid
erDiagram
    User {
        String   id                    PK   "cuid()"
        String   email                 UK   "unique, nullable"
        String   name                       "nullable display name"
        String   password                   "bcrypt cost-12, nullable"
        Boolean  emailVerified              "default false — auth gate"
        DateTime createdAt                  "default now()"
        DateTime lastActiveAt          IDX  "default now() — INDEX for cron"
        DateTime reengageSentAt             "nullable — compared vs lastActiveAt"
        Boolean  emailOptOut                "default false — GDPR exit"
        String   signInToken                "nullable — 32-byte single-use"
        DateTime signInTokenExpiresAt       "nullable — 5-minute TTL"
    }

    OtpCode {
        String   id         PK   "cuid()"
        String   email      IDX  "not FK — lookup by email string"
        String   codeHash        "SHA-256 hex — plaintext never stored"
        Int      attempts        "default 0 — max 5 guard"
        DateTime expiresAt       "now + 10 minutes"
        DateTime createdAt       "default now()"
    }

    Company {
        Int    id    PK   "autoincrement"
        String slug  UK   "google"
        String name       "Google"
    }

    Problem {
        Int    id             PK   "LeetCode frontendQuestionId — NOT autoincrement"
        String titleSlug      UK   "two-sum — IDX for sync lookup"
        String title               "Two Sum"
        String difficulty          "Easy or Medium or Hard"
        Float  acceptanceRate      "49.1"
    }

    CompanyProblem {
        Int    companyId  PK,FK  "composite PK with problemId and period"
        Int    problemId  PK,FK  "composite PK"
        String period     PK     "thirty-days or three-months or six-months or more-than-six-months or all"
        Float  frequency         "relative frequency 0-100"
    }

    UserSolvedProblem {
        String   userId    PK,FK  "composite PK with problemId — cascade delete"
        Int      problemId PK,FK  "composite PK — NO company column"
        DateTime solvedAt         "default now() — IDX with userId for recent activity"
    }

    User            ||--o{ UserSolvedProblem : "has solved"
    Problem         ||--o{ UserSolvedProblem : "solved by"
    Company         ||--o{ CompanyProblem    : "has problems"
    Problem         ||--o{ CompanyProblem    : "appears at companies"
```

**Index summary:**

| Table | Index | Type | Purpose |
|---|---|---|---|
| User | `email` | UNIQUE | fast lookup on sign-in |
| User | `lastActiveAt` | B-Tree | cron query: `WHERE lastActiveAt < 7d` |
| OtpCode | `email` | B-Tree | find OTP during verify flow |
| Problem | `titleSlug` | UNIQUE | LeetCode Sync: `WHERE titleSlug IN (...)` |
| Problem | `difficulty` | B-Tree | filter queries by difficulty |
| CompanyProblem | `(companyId, period, frequency)` | B-Tree | `getCompanyProblems()` — ORDER BY frequency |
| CompanyProblem | `problemId` | B-Tree | dashboard: JOIN from UserSolvedProblem |
| UserSolvedProblem | `(userId, problemId)` | UNIQUE PK | upsert idempotency, fast lookup |
| UserSolvedProblem | `(userId, solvedAt)` | B-Tree | recent activity query ORDER BY solvedAt |

---

## 8 · Solve a Problem — End-to-End Flow

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

    U1["User clicks checkbox\nSolveButton component"]
    U2["Optimistic update\nsetSolved !prev  immediately\nUI reflects change in < 16ms"]
    U3["POST /api/solve\n{ problemId }\nNO company field"]

    subgraph SERVER ["Server-side — /api/solve"]
        S1["auth  read JWT from cookie\nsession.user.id"]
        S2{"session\nexists?"}
        S3["Upstash Redis\nslidingWindow 60 / 1 min\nper userId"]
        S4{"rate limit\nok?"}
        S5["prisma.userSolvedProblem.upsert\nWHERE userId + problemId\ncreate if not exists · update noop\ncomposite PK guarantees idempotency"]
        S6["return 200\n{ success: true }"]
    end

    subgraph CLIENT_CACHE ["Client — progressCache update"]
        CC1["progressCache.solvedIds\nadd or delete problemId"]
        CC2["progressCache.solvedCount\nincrement or decrement"]
        CC3["CompanyGrid card count\nupdates without API call\n(reads from progressCache)"]
    end

    FAIL1["401 → revert UI\nsetSolved prev\nshow: sign in required"]
    FAIL2["429 → revert UI\nsetSolved prev\nshow: slow down"]
    FAIL3["500 → revert UI\nsetSolved prev\nshow: try again"]

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

## 9 · Request Lifecycle Decision Tree

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
    STATIC["Static page\nHome · Company · Auth · Sync\nPre-built HTML from CDN\nData comes from DB at build"]
    DYNAMIC["Dynamic page\nDashboard only\nServer render per request\n4 parallel Prisma queries"]
    CDNHIT["Return cached HTML\nTTFB < 100ms\nglobally distributed"]
    CDNMISS["Next.js rebuilds page\ngetCompanyList() or getCompanyStats()\nvia Prisma — not GitHub\nrefill CDN cache"]
    AUTH_CHECK["auth  validate JWT\nif invalid → redirect /auth/signin"]

    REQ --> MW --> D1
    D1 -->|"yes"| ASSET
    D1 -->|"no"| D2
    D2 -->|"yes"| API
    D2 -->|"no"| D3
    D3 -->|"Dashboard"| AUTH_CHECK --> DYNAMIC
    D3 -->|"Home · Company · Auth · Sync"| D4
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

## 10 · Security Threat Model

> *Interview question: "Walk me through your auth security." — five layers: rate limiting, OTP hashing, bcrypt, single-use tokens, and emailVerified gate. No single failure compromises the account.*

```mermaid
flowchart LR
    classDef threatCls  fill:#2d0808,stroke:#ef4444,stroke-width:2px,color:#fca5a5
    classDef guardCls   fill:#022c12,stroke:#10b981,stroke-width:2px,color:#6ee7b7

    subgraph THREATS ["THREATS"]
        T1["Brute-force\nregistration"]
        T2["OTP brute-force"]
        T3["OTP interception\nin DB breach"]
        T4["Password exposure\nin DB breach"]
        T5["signInToken\ntheft or replay"]
        T6["Unverified\naccount sign-in"]
        T7["Solve spam\nflooding"]
        T8["Resend OTP\nflooding"]
        T9["Cron endpoints\nabuse (both crons)"]
        T10["Internal endpoint\nabuse"]
        T11["Unsubscribe\nforgery"]
        T12["SQL injection"]
    end

    subgraph GUARDS ["MITIGATIONS"]
        G1["Rate limit: 5 req / hr / IP\nUpstash sliding window"]
        G2["5 attempt limit per OtpCode\n+ rate limit: 10 req / 10min / IP"]
        G3["SHA-256 hash stored\n10-minute expiry\nno plaintext ever written"]
        G4["bcrypt cost-12\nnever logged · never returned"]
        G5["32-byte random token\n5-minute TTL (signInTokenExpiresAt)\nnullified on first use"]
        G6["emailVerified = false\nblocks authorize() entirely"]
        G7["Rate limit: 60 req / min / userId"]
        G8["Rate limit: 3 req / 10min / email"]
        G9["Authorization: Bearer CRON_SECRET\napplied to both cron routes\nVercel env var · not in code"]
        G10["x-internal-secret header\nVercel env var · not in code"]
        G11["HMAC-SHA256 signed token\nkeyed with AUTH_SECRET\nstateless verification"]
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
| **1 · Master Architecture** | 0–20 min | What are all the components? Why this tech stack? Where does GitHub fit at runtime? |
| **7 · DB Schema** | 20–35 min | Why 4 tables now? Why no company column in UserSolvedProblem? What are the indexes? |
| **2 · Auth Flow** | 35–55 min | How does OTP work? Why SHA-256 not bcrypt for OTP? What is signInToken? |
| **6 · Caching** | 55–70 min | How do you get TTFB < 100ms? What happens when Postgres is down? No GitHub at runtime? |
| **4 · Re-engagement** | 70–80 min | How does lastActiveAt get updated? Why fire-and-forget? How do you avoid email spam? |
| **5 · Data Refresh** | 80–90 min | How is problem data kept fresh? Why skipDuplicates? What if GitHub is down during cron? |
| **3 · LeetCode Sync** | 90–100 min | How does sync avoid duplicates (three layers)? Why is sync a single DB query not 662 fetches? |
| **8 · Solve Flow** | 100–110 min | Why optimistic update? How do you keep the cache consistent? Why no company in POST /api/solve? |
| **9 · Request Lifecycle** | 110–115 min | How does Next.js decide static vs dynamic? Why is the layout static? |
| **10 · Security** | 115–120 min | Walk through each threat vector and mitigation |
