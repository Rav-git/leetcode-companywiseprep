# LeetCode Company Interview Prep

Browse 662+ companies and their LeetCode interview questions. Track which problems you've solved, filter by difficulty and time period, and see your progress per company.

## Tech Stack

Next.js 14 · TypeScript · Tailwind CSS · NextAuth v5 · Prisma · PostgreSQL (Supabase)

## Setup

1. **Clone and install**
   ```bash
   git clone <your-repo>
   cd leetcode-prep
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier)
   - Go to Settings → Database → Connection string (URI)
   - Copy the connection string

3. **Create a GitHub OAuth App** at [github.com/settings/developers](https://github.com/settings/developers)
   - Application name: LeetCode Prep (or anything)
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
   - Copy Client ID and Client Secret

4. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `.env.local`:
   ```
   DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="<run: openssl rand -base64 32>"
   GITHUB_CLIENT_ID="<from step 3>"
   GITHUB_CLIENT_SECRET="<from step 3>"
   ```

5. **Push database schema**
   ```bash
   npm run db:push
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Data Source

Real LeetCode Premium company interview questions scraped from:
[snehasishroy/leetcode-companywise-interview-questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions)

- 662 companies
- 50,000+ problems
- Updated Feb 2026
- Available time periods: 30 days, 3 months, 6 months, 6+ months, All time

## Features

- Browse all 662 companies dynamically (no hardcoding)
- Filter problems by difficulty (Easy / Medium / Hard)
- Filter by time period (how recently the question was asked)
- Search problems by title or ID
- Sign in with GitHub to track solved problems
- Progress bar per company
- Paginated problem table (30 per page)
- Click any problem to open it on LeetCode

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables from `.env.local`
4. Change `NEXTAUTH_URL` to your Vercel deployment URL
5. Update GitHub OAuth app callback URL to `https://your-domain.vercel.app/api/auth/callback/github`
6. Deploy
