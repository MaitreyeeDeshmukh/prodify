# User Workflow
**Project:** Prodify
**Date:** 2026-04-22

---

## Overview

This document describes the end-to-end journey a developer takes from installing Prodify to having a fully working, deployed SaaS with payments and auth.

---

## Step 1 — Install Prodify

```bash
npm install -g prodify
```

---

## Step 2 — Set Up External Services (one time)

Before running `prodify inject`, get your API keys. Do these in order:

### 2a. Supabase
1. Go to supabase.com, create a new project
2. Wait ~2 minutes for the project to spin up
3. Go to Project Settings > API
4. Copy: Project URL, anon key, service_role key

### 2b. Stripe
1. Go to dashboard.stripe.com
2. Enable Test Mode (top right toggle)
3. Go to Developers > API keys, copy the secret key
4. Go to Developers > Webhooks > Add endpoint
5. Add your app URL + `/api/webhooks/stripe`, select these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `customer.subscription.deleted`
6. Copy the webhook signing secret

### 2c. GitHub Personal Access Token
1. GitHub > Settings > Developer settings > Fine-grained tokens
2. Create token with Secrets: Read and write on your repo
3. Copy the token (shown once)

### 2d. Vercel (optional, only if deploying to Vercel)
1. Vercel > Account Settings > Tokens > Create
2. Copy token
3. Open your project > Settings > General > copy Project ID

### 2e. Generate NEXTAUTH_SECRET
```bash
openssl rand -base64 32
```

---

## Step 3 — Create `.env` File

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Auth
NEXTAUTH_SECRET=your_generated_secret

# AWS Bedrock
AWS_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=your_model_id
```

> This file stays local. Never commit it. `prodify secrets` handles syncing.

---

## Step 4 — Run `prodify inject`

```bash
prodify inject
```

Answer the 4 prompts:

```
? Pricing model?
  > per-seat / flat / usage-based

? User type?
  > individuals / teams / enterprise

? Stack?
  > Next.js / ...

? Deploy to Vercel when merged to main?
  > Yes / No
```

Prodify will:
- Inject all infrastructure files into `prodify-layer/`
- Create branch `prodify/inject-<timestamp>`
- Commit and push to GitHub
- If "Yes" to Vercel: open a PR to `main` automatically

---

## Step 5 — Sync Secrets

```bash
# GitHub only
prodify secrets \
  --github-token ghp_xxx \
  --repo yourname/yourrepo

# GitHub + Vercel
prodify secrets \
  --github-token ghp_xxx \
  --repo yourname/yourrepo \
  --vercel-token xxx \
  --vercel-project-id xxx
```

This pushes all env vars to GitHub repo secrets and optionally to Vercel.

---

## Step 6 — Review and Merge the PR

- Open the PR on GitHub (or the auto-opened one if you chose Vercel)
- CI runs automatically: TypeScript typecheck + Jest tests
- If CI passes, review the injected files
- Merge to `main`
- If Vercel is connected: deploy triggers automatically

---

## Step 7 — Run Database Migrations

After deploy, run the SQL migrations against your Supabase project:

1. Open Supabase Dashboard > SQL Editor
2. Run each migration in order:
   - `001_auth_tables.sql`
   - `002_subscription.sql`
   - `003_payments.sql`
3. Run `rls.sql` to enable Row Level Security

---

## Step 8 — Verify Everything Works

Checklist:
- [ ] Auth: sign in with Google or GitHub works
- [ ] Checkout: clicking "Subscribe" redirects to Stripe checkout
- [ ] Webhook: Stripe sends test events, they appear in `webhook_events` table
- [ ] Portal: billing portal link works
- [ ] CI: push a commit, GitHub Actions passes
- [ ] Secrets: no `.env` file in git history

---

## Ongoing Workflow (after initial setup)

```
Write code
  --> push to branch
  --> CI runs (typecheck + tests)
  --> open PR to main
  --> merge
  --> Vercel deploys
  --> prisma / supabase migrations run (if any schema changes)
```

For schema changes: add a new numbered migration file (e.g. `004_...sql`) and run it manually via Supabase SQL Editor or automate via a deploy hook.

---

## `prodify inject --dry-run`

Use this at any time to preview what would be injected without writing any files:

```bash
prodify inject --dry-run
```
