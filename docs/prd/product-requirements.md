# Product Requirements Document
**Project:** Prodify
**Date:** 2026-04-22
**Status:** Active

---

## 1. Problem Statement

Setting up production-ready SaaS infrastructure (auth, payments, database, CI/CD) from scratch takes days. Developers copy-paste boilerplate, misconfigure secrets, skip security hardening, and repeat the same mistakes. Prodify solves this with one CLI command.

---

## 2. Goals

- Inject production-ready SaaS infrastructure into any existing Next.js project in under 5 minutes
- Eliminate manual boilerplate for auth, payments, database schema, and CI/CD
- Give the maintainer full control over when and how changes are deployed
- Be secure by default, not as an afterthought

---

## 3. Non-Goals

- Not a hosting platform
- Not a no-code tool
- Not a framework (does not wrap or replace Next.js)
- Not a managed service (Prodify injects files, it does not run infrastructure)

---

## 4. Users

| User | Description |
|---|---|
| Solo developer | Building a SaaS side project, wants fast setup |
| Small team lead | Setting up a new product repo, wants consistency |
| Technical founder | Needs production-grade setup without a DevOps hire |

---

## 5. Core Features

### F1 — `prodify inject`
- Detects project stack automatically
- Asks 4 prompts: pricing model, user type, stack, deploy to Vercel?
- Injects all infrastructure files into `prodify-layer/`
- Commits to a new branch `prodify/inject-<timestamp>`
- Pushes branch to GitHub
- If "Deploy to Vercel?" = Yes: opens a PR to `main` automatically
- If No: pushes branch only, maintainer merges when ready

### F2 — Supabase Database Layer
- Generates SQL migration files (not Prisma) for full payment schema
- Migrations cover: auth tables, subscriptions, payment methods, payment intents, SCA results, audit logs, refunds, idempotency keys
- Row Level Security (RLS) policies injected so users can only access their own data

### F3 — Secure Payment Gateway
- Wraps all Stripe calls in `gateway.ts`
- Idempotency key enforcement (prevents double charges)
- 3D Secure / SCA result tracking
- Full payment audit log on every state change
- Webhook signature verification
- Error normalization (no raw Stripe errors exposed to client)

### F4 — GitHub Actions CI
- Injects `.github/workflows/ci.yml`
- Runs TypeScript typecheck and Jest tests on every push and PR
- Vercel handles deploy natively on merge to `main`

### F5 — `prodify secrets`
- CLI command to sync all required env vars
- Syncs to GitHub repo secrets via GitHub API
- Optionally syncs to Vercel project env vars
- Secrets: Supabase URL, anon key, service role key, Stripe keys, NextAuth secret

---

## 6. Requirements

### Security
- `.env` file must never be committed to GitHub
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed client-side
- All webhook endpoints must verify Stripe signatures
- RLS must be enabled on all payment tables

### Developer Experience
- All injected files include short, human-readable comments
- No em dashes in any code or docs
- File structure is organized by domain, not dumped flat
- `prodify inject --dry-run` shows what would be injected without writing files

### Reliability
- Idempotency keys prevent duplicate payment processing
- Webhook events are deduplicated via upsert before processing
- All payment state changes are written to `payment_audit_logs`

---

## 7. Success Criteria

- A developer can run `prodify inject` and have a working payment + auth setup in under 10 minutes
- Zero secrets committed to git by default
- Payment audit log captures every state change end to end
- CI passes on every push before any deploy happens

---

## 8. Out of Scope for v1

- Multi-currency support
- Tax calculation
- Invoice PDF generation
- Mobile SDKs
