<div align="center">

<br />

<h1>
  <img src="https://raw.githubusercontent.com/MaitreyeeDeshmukh/prodify/main/apps/web/public/logo.png" width="36" alt="Prodify" style="vertical-align:middle; margin-right:8px" />
  Prodify
</h1>

<p><strong>Paste your GitHub URL. Get a production-ready pull request in 5 minutes.</strong></p>

<p>
  Auth hardening · Stripe subscriptions · RLS-enabled database migrations · Email flows · CI/CD pipelines<br/>
  Injected directly into your actual codebase — not a boilerplate you have to migrate into.
</p>

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14%2F15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-ready-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-integrated-635bff?style=flat-square&logo=stripe&logoColor=white)](https://stripe.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/MaitreyeeDeshmukh/prodify/pulls)

<br/>

[**Try the web app**](https://prodify.dev) &nbsp;&nbsp;·&nbsp;&nbsp; [**Read the docs**](https://docs.prodify.dev) &nbsp;&nbsp;·&nbsp;&nbsp; [**Join Discord**](https://discord.gg/prodify) &nbsp;&nbsp;·&nbsp;&nbsp; [**Report a bug**](https://github.com/MaitreyeeDeshmukh/prodify/issues)

<br/>

</div>

---

## The problem

Lovable crossed a million users in six months. Bolt. Cursor. Every vibe-coding platform is racing to help founders build faster — but not one of them gets the founder across the finish line.

There are three million AI-built apps that cannot charge a single dollar right now. Not because the idea was bad. Because nobody had time to wire up payments, handle auth, or actually deploy it. The demo ends, the applause begins, prizes are handed out — and the project dies right there.

**Prodify fixes the last mile.**

---

## How it works

```
Your existing Next.js + Supabase repo
              │
              ▼
       ┌─────────────────────────────────────────────────────┐
       │  Step 1 — Detect stack                              │
       │            AST-based, deterministic. No guessing.   │
       │                                                     │
       │  Step 2 — Validate repo (runValidation)             │
       │            19 pre-injection safety checks run.      │
       │            Fails closed if anything is uncertain.   │
       │                                                     │
       │  Step 3 — Show the plan                             │
       │            Every file listed before anything        │
       │            is written. --dry-run stops here.        │
       │                                                     │
       │  Step 4 — Create branch                             │
       │            prodify/inject-<timestamp>               │
       │            main is never touched.                   │
       │                                                     │
       │  Step 5 — Inject (runInjection)                     │
       │            Auth → Payments → DB → UI → Email        │
       │            → CI/CD → Compliance → Env → README      │
       │            Written in sequence. Atomic or nothing.  │
       │                                                     │
       │  Step 6 — Push + open PR                            │
       │            Full activation checklist in PR body.    │
       └─────────────────────────────────────────────────────┘
              │
              ▼
     Review the diff. Merge when ready.
```

Nothing is written until the plan is shown. `--dry-run` stops after step 3.

---

## Quickstart

### Option A — Web (no install)

1. Go to **[prodify.dev](https://prodify.dev)**
2. Paste your GitHub repo URL
3. Answer 4 questions
4. Review and merge the pull request

### Option B — CLI

```bash
npm install -g prodify
# or run without installing
npx prodify inject
```

```bash
# Interactive — recommended for first run
prodify inject

# Preview the plan without writing any files
prodify inject --dry-run

# Full verbose output with per-step timing
prodify inject --verbose

# Write files locally without pushing to GitHub
prodify inject --no-git

# Sync all secrets to GitHub and optionally Vercel
prodify secrets \
  --github-token ghp_xxx \
  --repo yourname/yourrepo \
  --vercel-token xxx \
  --vercel-project-id xxx
```

---

## The 4 questions

Prodify auto-detects your stack. It only asks what it cannot infer:

| # | Question | Options |
|---|---|---|
| 1 | Pricing model | Per seat / Flat subscription / Usage-based / Credits / Hybrid |
| 2 | Who are your users | Individuals / Teams / Enterprise |
| 3 | Stack confirmation | Auto-detected — confirm or override |
| 4 | Deploy to Vercel on merge? | Yes / No |

Billing model selection drives which Stripe integration variant is injected (`flatStripe`, `perSeatStripe`, `creditsStripe`, `hybridStripe`, `oneTimeStripe`).

---

## What gets injected

### Auth

The auth injector (`buildAuthFiles`) produces a complete, hardened NextAuth.js setup tuned to your user type:

- Email/password, GitHub OAuth, Google OAuth — configured based on your answers
- Protected route middleware wired to your existing `(dashboard)` route group
- `profiles` and `projects` tables in Supabase with Row Level Security
- JWT callback with custom session shape
- Zod-validated login, signup, forgot-password, and reset-password forms
- Resend email integration for password reset flows
- Project count per user for freemium plan enforcement
- Enterprise config path for SSO/SAML (roadmap)

### Payments

Every Stripe call routes through `lib/gateway.ts`. No raw Stripe errors reach the client. Double charges are impossible.

| File injected | What it does |
|---|---|
| `app/api/checkout/route.ts` | Creates Stripe checkout sessions |
| `app/api/webhooks/stripe/route.ts` | Verifies signatures before processing any event |
| `app/api/portal/route.ts` | Opens Stripe billing portal for self-serve management |
| `lib/gateway.ts` | Wraps all Stripe calls: idempotency keys, error normalization, audit logging |

**Billing models supported:**

| Model | Injected variant |
|---|---|
| Flat subscription | `flatStripe` |
| Per seat | `perSeatStripe` |
| Credits / usage | `creditsStripe` |
| One-time payment | `oneTimeStripe` |
| Hybrid (flat + usage) | `hybridStripe` |

Every state change is appended to `payment_audit_logs`. Webhook deduplication runs via upsert-before-process. SCA results are tracked in `sca_results`.

### Database

Plain SQL migrations you own. No ORM magic. No hidden schema.

```
supabase/migrations/
  001_auth.sql          profiles, projects, RLS policies
  002_subscription.sql  subscriptions, plans, price intervals
  003_payments.sql      payment_intents, payment_methods,
                        payment_audit_logs, webhook_events,
                        idempotency_keys, sca_results
  rls.sql               Row Level Security on every payment table
```

All tables have RLS enabled. Users can only ever see their own rows. The service role key never leaves the server.

### UI components

`buildUiFiles` injects ready-to-use billing UI components in both plain HTML and shadcn/ui variants:

- `<SignInButton />` / `<SignOutButton />`
- `<BillingPortalButton />`
- `<PricingPage />` — plan cards wired to your Stripe price IDs
- `<CreditBalance />` — for usage-based billing
- Skeleton loaders, empty states, confirmation dialogs, status badges, breadcrumbs (via Sonner)

### Email

`buildEmailFiles` (via `resendClient`) injects three transactional email templates:

| Template | Trigger |
|---|---|
| `welcome.tsx` | After first sign-in |
| `receipt.tsx` | After successful payment |
| `trialEnding.tsx` | 3 days before trial expires |

All templates use React Email and are sent via Resend.

### CI/CD

`buildCiFiles` detects your package manager and deployment target, then injects the correct workflow:

| Deployment target | Workflow injected |
|---|---|
| Vercel | `vercelWorkflow()` |
| AWS | `awsWorkflow()` |
| Fly.io | `flyWorkflow()` |
| Railway | `railwayWorkflow()` |
| None | `noneWorkflow()` — typecheck + test only |

Every variant includes TypeScript typecheck and Jest test suite on every push and PR.

### Compliance

`buildComplianceFiles` injects legal copy tuned to your business type:

- Privacy Policy (GDPR + CCPA compliant)
- Terms of Service
- Cookie banner with opt-out
- CCPA notice

### Environment & secrets

`buildEnvFile` generates a fully-labeled `.env.example` with every required key organized by service. `prodify secrets` syncs them to GitHub repo secrets and optionally to Vercel project env vars in one command.

### Activation checklist

After injection, `printActivationWizard` prints a step-by-step terminal checklist. A `README-prodify.md` is also written into your repo with the same instructions for your team.

---

## Pre-injection validation

Before writing a single file, `runValidation` runs 19 safety checks. Injection is blocked if any critical check fails.

<details>
<summary>View all 19 checks</summary>

| Check | What it validates |
|---|---|
| `checkEnvVarCoverage` | All required env vars are present in `.env.example` |
| `checkMiddlewarePlacement` | Middleware is at `middleware.ts` root, not nested |
| `checkProtectedPathsExist` | `(dashboard)` route group exists before injecting middleware |
| `checkNoHardcodedUrls` | No hardcoded `localhost` or raw domain strings in source |
| `checkNoAsAny` | No `as any` casts that could hide type errors post-injection |
| `checkCiPackageManager` | CI workflow uses same package manager as `package.json` |
| `checkCiTestCommand` | CI `npm test` matches the actual test script |
| `checkCheckConstraints` | DB schema CHECK constraints are valid SQL |
| `checkCheckoutUrlNullHandling` | Checkout route handles null `url` from Stripe |
| … (+10 more) | Stack detection, conflict detection, RLS presence, secret safety |

</details>

Validation output is color-coded in the terminal. Warnings surface without blocking. Errors block with a human-readable explanation.

---

## AI-powered analysis

The `analyzeRepository` pipeline powers the web platform's smart project intake:

```
analyzeRepository()
  ├── buildFileTree()          — walks the repo, scores files by relevance
  ├── collectScoredFiles()     — BM25 ranking to prioritize meaningful files
  ├── discoverAndReadApiRoutes() — locates existing API patterns
  ├── buildBudgetedContext()   — respects AWS Bedrock token budget
  └── invokeBedrock()          — Claude-powered codebase summary + plan
```

The analyzer runs server-side via AWS Bedrock (Claude). It produces a structured summary of your stack, existing patterns, potential conflicts, and a recommended injection plan — all before a single file is written.

---

## Security model

Prodify treats security as the baseline, not a feature.

| Rule | How it is enforced |
|---|---|
| `.env` never committed | Injector blocks and warns if `.env` is git-tracked |
| Service role key server-side only | Never injected into `NEXT_PUBLIC_` variables — blocked at build |
| Webhook signature verification | Every Stripe endpoint verifies `stripe-signature` before processing |
| RLS on all payment tables | Enforced in `003_payments.sql` and `rls.sql` — not optional |
| Idempotency keys | Enforced on every Stripe call inside `gateway.ts` |
| Webhook deduplication | Upsert-before-process on all `webhook_events` |
| Full audit log | Every payment state change written to `payment_audit_logs` |
| SCA tracking | `sca_results` table records 3DS / Strong Customer Authentication outcomes |
| Error normalization | `gateway.ts` wraps all Stripe errors — no raw API errors reach the client |
| Fail closed | Injector blocks on uncertainty — never writes partial state |
| Branch isolation | Injection always targets a new branch — `main` is never touched |

---

## Supported stack

Prodify v1 is intentionally narrow. One stack done exceptionally well before expanding.

| Layer | Supported |
|---|---|
| Frontend | Next.js 14 and 15, App Router, TypeScript (strict) |
| Auth | Supabase Auth + NextAuth.js v4 (JWT strategy) |
| Database | Supabase (Postgres + RLS) |
| Payments | Stripe Subscriptions, one-time, usage-based, credits |
| Email | Resend + React Email |
| Deploy | Vercel, AWS, Fly.io, Railway |
| CI | GitHub Actions |

**Not supported in v1:** non-Next.js frontends, non-Supabase databases, custom billing providers, heavy monorepos with multiple apps sharing auth.

Multi-stack support (Express, Rails, Laravel) is on the roadmap.

---

## Architecture

```
prodify/
  apps/
    web/                          Next.js 15 web platform
      app/
        (auth)/                   Public auth pages
          login/                  Login form (Zod-validated)
          signup/                 Signup form
          forgot-password/        Password reset request
          reset-password/         Password reset confirmation
        (dashboard)/              Protected routes (middleware-gated)
          dashboard/              Project list
          projects/[id]/          Injection status + logs
          settings/               Account and billing management
        api/
          inject/                 Triggers injection job (POST)
          webhooks/stripe/        Billing webhook handler
          auth/                   Supabase OAuth callbacks
      components/
        dashboard/                Dashboard-specific components
          project-card.tsx        Project summary card
          header.tsx              Dashboard header
          sidebar.tsx             Navigation sidebar
        ui/                       Shared primitives (shadcn/ui)
          button, dialog, form,
          input, label, badge,
          avatar, checkbox, etc.
      lib/
        insforge.ts               InsForge BaaS client singleton

  packages/
    injector/                     Core injection engine (monorepo package)
      src/
        detector.ts               Stack detection — AST-based, deterministic
        injector.ts               Main orchestrator (runInjection)
        prompts.ts                Interactive CLI questions (Inquirer.js)
        logger.ts                 Color-coded terminal output
        git.ts                    Clone, branch, commit, push, PR via GitHub API
        types.ts                  Shared TypeScript types for injection config
        ai/
          analyzer.ts             AI-powered repo analysis (AWS Bedrock)
        validation/
          validator.ts            runValidation — orchestrates all checks
          checks.ts               19 individual validation check functions
          types.ts                Validation result types
        injectors/
          auth.ts                 buildAuthFiles — NextAuth + Supabase auth
          payments.ts             buildPaymentsFiles — Stripe gateway + routes
          ui.ts                   buildUiFiles — billing UI components
          design-system/
            generator.ts          DesignSystemGenerator — token + theme generation

  src/                            Standalone injector modules
    injector.ts                   runInjection orchestrator
    detector.ts                   Stack detection (shared with package)
    auto-config.ts                buildAutoRecommendation — smart defaults
    activation.ts                 printActivationWizard — post-injection checklist
    prompts.ts                    Extended CLI prompts
    types.ts                      Extended type definitions
    injectors/
      auth.ts                     buildAuthFiles (+ buildSupabaseAuthFiles)
      payments.ts                 buildPaymentsFiles (all 5 billing variants)
      db.ts                       buildDbFiles + buildSchema + buildSupabaseDbFiles
      ui.ts                       buildUiFiles (plain + shadcn variants)
      email.ts                    buildEmailFiles — Resend transactional templates
      ci.ts                       buildCiFiles — 5 deployment targets
      env.ts                      buildEnvFile — labeled .env.example
      compliance.ts               buildComplianceFiles — legal copy
      readme.ts                   Activation README generator

  supabase/
    migrations/
      001_auth.sql
      002_subscription.sql
      003_payments.sql
      rls.sql
    seed.sql

  tests/                          Jest test suite
    detector.test.ts
    validator.test.ts
    injector.test.ts
    auth.test.ts
    payments.test.ts
    db.test.ts
    env.test.ts
    ui.test.ts
    git.test.ts
    logger.test.ts
    prompts.test.ts
    middleware.test.ts
    safety.test.ts
    supabase.test.ts

  .github/
    workflows/
      ci.yml                      Typecheck + Jest on every push and PR
```

---

## Local development

```bash
git clone https://github.com/MaitreyeeDeshmukh/prodify
cd prodify
npm install
```

```bash
# Copy environment variables
cp .env.example .env.local
```

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-side only, never NEXT_PUBLIC_

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# AWS Bedrock (AI analysis)
AWS_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Auth
NEXTAUTH_SECRET=your_generated_secret   # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Email
RESEND_API_KEY=re_...

# GitHub (for injection via web)
GITHUB_TOKEN=ghp_...
```

```bash
# Run the web app
npm run dev --workspace=apps/web

# Run the full test suite
npm test

# Typecheck all packages
npm run typecheck

# Build the injector package
npm run build --workspace=packages/injector

# Build the injector standalone
npm run build --workspace=src
```

---

## Database setup

Run migrations in order in the Supabase SQL Editor or via the Supabase CLI:

```bash
# Via Supabase CLI
supabase db push

# Or manually, in order:
# 1. supabase/migrations/001_auth.sql
# 2. supabase/migrations/002_subscription.sql
# 3. supabase/migrations/003_payments.sql
# 4. supabase/migrations/rls.sql
```

> **Never edit existing migration files after they have run in production.** Add a new numbered migration file for any schema change.

---

## Testing

```bash
# Full suite
npm test

# Watch mode
npm test -- --watch

# Single file
npm test -- tests/validator.test.ts

# With coverage
npm test -- --coverage
```

The test suite covers:

- Stack detection (`detector.test.ts`)
- Pre-injection validation (`validator.test.ts`, `safety.test.ts`)
- Injection orchestration (`injector.test.ts`)
- Domain injectors (`auth.test.ts`, `payments.test.ts`, `db.test.ts`, `env.test.ts`, `ui.test.ts`)
- Git operations (`git.test.ts`)
- Logger output (`logger.test.ts`)
- CLI prompts (`prompts.test.ts`)
- Middleware generation (`middleware.test.ts`)
- Supabase integration (`supabase.test.ts`)

All external services (Stripe, GitHub, Supabase, AWS Bedrock) are mocked. No live API keys needed to run tests.

---

## Pricing

| Tier | Cost | What you get |
|---|---|---|
| **Free** | $0 | Full dry-run analysis. See the exact plan, every file, every change — before spending anything. |
| **Pay-as-you-go** | Base fee + token usage | Unlimited injections. Pay the base fee plus the actual tokens used to scan and inject your codebase. Small repos stay cheap. Larger repos cost a little more. |
| **Enterprise** | Custom | SOC2 / HIPAA compliance add-on, SSO, unlimited seats, dedicated Slack support, SLA. |

No subscription required to start. Scan your repo for free. Pay only when you ship.

---

## Roadmap

- [x] CLI injection engine (Commander.js + Inquirer.js)
- [x] AST-based deterministic stack detection
- [x] 19-check pre-injection validation
- [x] Supabase auth, RLS migrations, profile and project tables
- [x] Stripe payment gateway — 5 billing model variants
- [x] Idempotency keys, SCA tracking, full audit log
- [x] Transactional email (Resend + React Email)
- [x] GitHub Actions CI/CD injection — 5 deployment targets
- [x] Legal compliance injection (Privacy Policy, ToS, Cookie banner, CCPA)
- [x] Secrets sync to GitHub and Vercel
- [x] Design system token generation
- [x] AI-powered repo analysis (AWS Bedrock / Claude)
- [x] Web platform (paste URL, no CLI install)
- [ ] Real-time injection status and log streaming
- [ ] Dashboard project management UI
- [ ] Freemium enforcement and usage metering
- [ ] Billing via Stripe on the platform itself
- [ ] Docs site (docs.prodify.dev)
- [ ] Multi-stack support (Express, Rails, Laravel, FastAPI)
- [ ] Team and org membership models
- [ ] Injection rollback and migration history
- [ ] Marketing site

---

## Contributing

Open an issue before submitting a large PR so we can align on approach first.

```bash
# Before every commit
npm test
npm run typecheck
```

### Code rules (enforced across the whole codebase)

| Rule | Why |
|---|---|
| No em dashes in code or comments | Use hyphens. Em dashes cause encoding issues in some terminals. |
| No `.env` commits | The injector actively checks and blocks this. |
| `SUPABASE_SERVICE_ROLE_KEY` server-side only | Never in `NEXT_PUBLIC_` vars — treated as a critical security failure. |
| Files organized by domain | Not dumped flat. `injectors/payments.ts`, not `payments-injector.ts` at the root. |
| Mock all external services in tests | No live API calls in the test suite. |
| Fail closed | If a check is uncertain, block. Never write partial state. |
| Short, human-readable comments | Only where the code itself does not make it obvious. |

### Project structure rules

- New injector? Add it to `src/injectors/` and wire it into `runInjection()` in `src/injector.ts`
- New validation check? Add to `packages/injector/src/validation/checks.ts` and register it in `validator.ts`
- New migration? Add a new numbered file to `supabase/migrations/` — never edit existing ones

---

## FAQ

**Does Prodify modify my `main` branch?**
Never. Injection always targets a new `prodify/inject-<timestamp>` branch. You review the diff and merge when ready.

**What if my repo already has some Stripe or auth code?**
`runValidation` checks for conflicts before injecting. If conflicting billing or auth code is detected, injection is blocked with a clear explanation of what needs to be resolved first.

**Does the AI analysis send my source code to a third party?**
The analyzer uses AWS Bedrock (Claude), which means your code is processed by Anthropic via AWS. The analyzer uses a BM25-ranked file budget — it only sends the most relevant files, not your entire repo.

**Can I run just the validation without injecting?**
Yes. `prodify inject --dry-run` runs detection and all 19 validation checks, shows you the full plan, and exits without writing anything.

**What is `gateway.ts`?**
It is the single Stripe wrapper that every payment call goes through. It enforces idempotency keys (no double charges), normalizes errors (no raw Stripe errors to the client), and writes every state change to `payment_audit_logs`. You should never call `stripe.*` directly — always go through `gateway.ts`.

**Does Prodify support monorepos?**
Partially. The injector detects the project root automatically (`detectProjectRoot`) and handles `apps/web/` style layouts. Complex monorepos with shared auth across multiple apps are out of scope for v1.

---

## License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">

<br/>

Built by [Rudheer](https://github.com/Rudheer127) and [Maitreyee](https://github.com/MaitreyeeDeshmukh).

<br/>

*The builders have had their moment. Now it is time to get paid.*

<br/>

</div>
