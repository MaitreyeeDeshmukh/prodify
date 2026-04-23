# Prodify Platform Design Spec
**Date:** 2026-04-22
**Status:** Approved — building now

---

## What We Are Building

Prodify as a full web platform. Founders paste a GitHub repo URL, Prodify injects production-ready auth + payments infrastructure, and opens a PR back to their repo. No CLI install needed.

Hero user: early-stage founders (vibe-coders using Cursor, Lovable, Bolt).
Secondary user: developers who want to skip SaaS boilerplate.
Business model: freemium — 3 projects free, unlimited on paid.

---

## Build Order

1. Auth + accounts (building now)
2. Dashboard + project management
3. Web-based injector (GitHub URL → clone → inject → open PR)
4. Billing (Stripe, freemium)
5. Docs site
6. Marketing site (last, not a priority)

---

## Monorepo Structure

```
prodify-platform/
  apps/
    web/                            # Next.js 14 (App Router)
      app/
        (dashboard)/                # protected routes, requires login
          dashboard/page.tsx        # project list
          projects/[id]/page.tsx    # injection detail
          settings/page.tsx         # account + billing
        api/
          inject/route.ts           # triggers injection job
          webhooks/stripe/route.ts  # billing webhooks
          auth/                     # Supabase auth handlers
      components/
        dashboard/                  # dashboard UI components
        ui/                         # buttons, inputs, shared primitives
    docs/                           # Mintlify docs site
  packages/
    injector/                       # core injection engine
      src/
        detector.ts                 # stack detection
        injectors/                  # auth, db, payments, github injectors
        gateway/                    # GitHub API (clone, PR, push)
  supabase/
    migrations/                     # SQL files, numbered
    seed.sql
  .github/
    workflows/
      ci.yml                        # typecheck + jest on every push
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Backend | Supabase (Postgres + Auth + RLS) |
| AI / API keys | AWS Bedrock via IAM + Secrets Manager |
| Payments | Stripe |
| Deploy | Vercel |
| CI | GitHub Actions |

---

## Sub-project 1: Auth + Accounts

### What it covers
- Supabase Auth: email/password + GitHub OAuth + Google OAuth
- Protected route group `(dashboard)` -- redirects to login if no session
- User profile stored in Supabase `profiles` table
- Project count tracked per user (for freemium limit enforcement)

### Routes
```
/login              -- sign in page
/signup             -- create account
/auth/callback      -- Supabase OAuth callback handler
/dashboard          -- first protected page (redirects here after login)
```

### Database (supabase/migrations/001_auth.sql)
```sql
-- profiles extends Supabase auth.users
create table profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  name        text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- project count for freemium enforcement
create table projects (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  name        text not null,
  repo_url    text,
  status      text default 'pending',
  created_at  timestamptz default now()
);

alter table profiles enable row level security;
alter table projects enable row level security;

create policy "users own their profile"
  on profiles for all using (auth.uid() = id);

create policy "users own their projects"
  on projects for all using (auth.uid() = user_id);
```

### Agent Rules (enforced during build)
- Never commit .env or .env.local
- No em dashes in code or comments
- Comments short and human, only where not obvious
- Service role key server-side only, never in NEXT_PUBLIC_ vars
- Files organized by domain, not dumped flat

---

## Git Identity

All commits: `Maitreyee <maitreyee721@gmail.com>`
GitHub: MaitreyeeDeshmukh
