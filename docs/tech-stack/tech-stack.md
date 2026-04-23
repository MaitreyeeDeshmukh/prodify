# Tech Stack
**Project:** Prodify
**Date:** 2026-04-22

---

## Frontend

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Target of injection, what users are building on |
| Language | TypeScript | Type safety across the full stack |
| Styling | Tailwind CSS | Standard for modern Next.js projects |

---

## Backend

| Layer | Choice | Reason |
|---|---|---|
| Database | Supabase (PostgreSQL) | Managed Postgres, built-in auth, RLS, real-time |
| Auth | Supabase Auth | Native session management, replaces NextAuth adapter overhead |
| ORM / Query | Supabase JS client (`@supabase/supabase-js`) | Direct table access, works with RLS policies |
| Migrations | Raw SQL files | Explicit, auditable, no ORM lock-in |

---

## Payments

| Layer | Choice | Reason |
|---|---|---|
| Payment processor | Stripe | Industry standard, best webhook tooling |
| Gateway abstraction | Custom `gateway.ts` (injected) | Adds idempotency, 3DS tracking, error normalization on top of Stripe |
| Webhook handling | Stripe webhook + signature verification | Prevents tampered payloads |

---

## AI / API Keys

| Layer | Choice | Reason |
|---|---|---|
| AI provider | AWS Bedrock | Managed AI APIs, no separate vendor account needed, integrates with IAM |
| API key management | AWS Bedrock (via IAM roles + AWS Secrets Manager) | Secure, auditable, no plaintext keys in code |

> AWS Bedrock access is granted via IAM roles. Keys are pulled from AWS Secrets Manager at runtime, not hardcoded in `.env`.

---

## DevOps / CI/CD

| Layer | Choice | Reason |
|---|---|---|
| Version control | GitHub | Where `prodify secrets` and CI workflow target |
| CI | GitHub Actions | Native GitHub integration, free for public repos |
| Deploy | Vercel (optional, user preference) | Native Next.js deploy, zero config |
| Secrets management | GitHub repo secrets + Vercel env vars | Synced via `prodify secrets` command |

---

## Prodify CLI (the tool itself)

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Language | TypeScript (compiled to `dist/`) |
| CLI framework | Commander.js |
| Prompts | Inquirer.js |
| Test runner | Jest |
| Build | tsc |

---

## File Structure (Injected into user's project)

```
prodify-layer/
  auth/
    [...nextauth].ts          # auth config
  db/
    supabase.ts               # supabase client
    migrations/
      001_auth_tables.sql
      002_subscription.sql
      003_payments.sql
    rls.sql                   # row level security policies
  payments/
    stripe.ts                 # checkout helpers
    gateway.ts                # secure gateway wrapper
  routes/
    api/
      auth/[...nextauth]/
        route.ts
      checkout/
        route.ts
      webhooks/stripe/
        route.ts
      portal/
        route.ts

.github/
  workflows/
    ci.yml                    # typecheck + test on every push
```

---

## Environment Variables

| Variable | Source | Side |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings | Client + Server |
| `SUPABASE_ANON_KEY` | Supabase project settings | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings | Server only |
| `STRIPE_SECRET_KEY` | Stripe dashboard | Server only |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook settings | Server only |
| `NEXTAUTH_SECRET` | Generated locally (`openssl rand -base64 32`) | Server only |
| `AWS_REGION` | AWS config | Server only |
| `AWS_BEDROCK_MODEL_ID` | AWS Bedrock console | Server only |

> `.env` is gitignored. Use `prodify secrets` to sync these to GitHub and Vercel.
