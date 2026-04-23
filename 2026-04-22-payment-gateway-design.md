# Prodify — Payment Gateway & GitHub CI Design Spec
**Date:** 2026-04-22  
**Status:** Approved

---

## 1. Overview

Extend Prodify's `inject` command to produce four new capabilities:

1. **Supabase-backed payment schema** — SQL migrations + Row Level Security for a full payment data model (methods, intents, SCA/3DS, audit logs, refunds, idempotency keys)
2. **Secure payment gateway module** — `prodify-layer/payments/gateway.ts` wrapping all Stripe calls with idempotency, 3DS tracking, input validation, and audit logging
3. **GitHub Actions CI workflow** — typecheck + Jest on every push/PR; Vercel deploys natively on merge to `main`
4. **`prodify secrets` CLI command** — syncs all required env vars to GitHub repo secrets and optionally to Vercel project env vars

Additionally, the `inject` flow changes to:
- Always commit injected files to a **new branch** (`prodify/inject-<timestamp>`)
- Prompt the maintainer: **"Deploy to Vercel?"**
  - **Yes** → open a PR from the branch to `main` (merging triggers Vercel auto-deploy)
  - **No** → push branch only; maintainer merges manually when ready

---

## 2. New Prompt (4th question in `runPrompts`)

```
? Deploy to Vercel when merged to main?
  ❯ Yes — open a PR automatically after injection
    No  — push branch only, I'll open the PR myself
```

Stored in `ProdifyConfig` as `answers.deployToVercel: boolean`.

---

## 3. Database Layer — Supabase (replaces Prisma)

### 3.1 Client Setup

Injected file: `prodify-layer/db/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-side only
);
```

### 3.2 SQL Migrations

**`prodify-layer/db/migrations/001_auth_tables.sql`**
- `users` — id, name, email, email_verified, image, created_at
- `accounts` — OAuth provider accounts linked to users
- `sessions` — active user sessions

**`prodify-layer/db/migrations/002_subscription.sql`**
- `subscriptions` — stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_end
- `webhook_events` — stripe_event_id (unique), type, payload, processed_at

**`prodify-layer/db/migrations/003_payments.sql`**

| Table | Key columns |
|---|---|
| `payment_methods` | stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default |
| `payment_intents` | stripe_payment_intent_id, amount (cents), currency, status, idempotency_key_id |
| `sca_results` | payment_intent_id (unique), status, three_ds_version, authenticated_at |
| `payment_audit_logs` | payment_intent_id, event, metadata (jsonb), created_at |
| `refunds` | stripe_refund_id (unique), amount, status, reason |
| `idempotency_keys` | key (unique), user_id, response (jsonb), expires_at |

### 3.3 Row Level Security (`prodify-layer/db/rls.sql`)

Every payment table has RLS enabled:
```sql
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON payment_intents
  FOR ALL USING (auth.uid() = user_id);
```
Same pattern applied to `payment_methods`, `sca_results`, `payment_audit_logs`, `refunds`.  
`idempotency_keys` — service role only (no user-facing RLS).  
`webhook_events` — service role only.

---

## 4. Secure Payment Gateway (`prodify-layer/payments/gateway.ts`)

### 4.1 `createPaymentIntent(params)`

1. Check `idempotency_keys` table — return cached response if key exists and not expired
2. Validate: amount > 0, currency is ISO 4217, userId is present
3. Call `stripe.paymentIntents.create(...)` with `idempotencyKey` header
4. Insert row into `payment_intents`
5. Insert row into `idempotency_keys` (expires in 24h)
6. Insert `"created"` entry into `payment_audit_logs`
7. Return normalized result

### 4.2 `handleWebhook(req)`

1. Verify `stripe-signature` header — reject if invalid (400)
2. Upsert into `webhook_events` (prevents duplicate processing)
3. Route on `event.type`:
   - `checkout.session.completed` → update `subscriptions`, write audit log
   - `payment_intent.succeeded` → update `payment_intents`, upsert `sca_results`, write audit log
   - `payment_intent.payment_failed` → update `payment_intents` status, write audit log
   - `charge.refunded` → insert into `refunds`, write audit log
   - `customer.subscription.deleted` → set subscription status to `cancelled`, write audit log

### 4.3 Security Controls

| Control | Implementation |
|---|---|
| Webhook signature verification | `stripe.webhooks.constructEvent` — rejects tampered payloads |
| Idempotency | DB-level key check before every Stripe call |
| 3DS/SCA tracking | `sca_results` row upserted on `payment_intent.succeeded` |
| Full audit trail | Every state change written to `payment_audit_logs` |
| Error normalization | Stripe errors caught, mapped to safe `{ code, message }` — raw API errors never reach the client |
| RLS | Users cannot read other users' payment data at the DB level |

---

## 5. GitHub Actions CI Workflow

**Injected file:** `.github/workflows/ci.yml`

```
Trigger: push to any branch, PR to main

Jobs:
  typecheck  → tsc --noEmit
  test       → jest --ci

On merge to main → Vercel auto-deploys (native GitHub integration)
```

No Vercel-specific steps in the workflow. Vercel's GitHub app handles deploy on merge.  
If `deployToVercel = false`, workflow is identical — deploy is just never triggered because no PR is opened automatically.

---

## 6. `prodify secrets` Command

```bash
prodify secrets \
  --github-token <PAT> \
  --repo <owner/repo> \
  [--vercel-token <token> --vercel-project-id <id>]
```

**Secrets synced:**

| Secret | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | GitHub + Vercel (if opted in) |
| `SUPABASE_ANON_KEY` | GitHub + Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub + Vercel |
| `STRIPE_SECRET_KEY` | GitHub + Vercel |
| `STRIPE_WEBHOOK_SECRET` | GitHub + Vercel |
| `NEXTAUTH_SECRET` | GitHub + Vercel |

Uses:
- GitHub: `PUT /repos/{owner}/{repo}/actions/secrets/{name}` (requires `repo` PAT scope)
- Vercel: `POST /v10/projects/{id}/env` (requires Vercel API token)

---

## 7. Branch & Deploy Flow

```
prodify inject
  │
  ├── Detect stack
  ├── Ask 4 prompts (pricing model, user type, stack, deploy to Vercel?)
  ├── Inject all files
  ├── git checkout -b prodify/inject-<timestamp>
  ├── git add + commit
  ├── git push origin prodify/inject-<timestamp>
  │
  └── if deployToVercel = true:
        gh pr create --base main --head prodify/inject-<timestamp>
        (merging this PR triggers Vercel auto-deploy)
      else:
        print: "Branch pushed. Open a PR when you're ready to deploy."
```

---

## 8. New Injector Files Summary

| File | Injector |
|---|---|
| `prodify-layer/db/supabase.ts` | `db.ts` injector |
| `prodify-layer/db/migrations/001_auth_tables.sql` | `db.ts` injector |
| `prodify-layer/db/migrations/002_subscription.sql` | `db.ts` injector |
| `prodify-layer/db/migrations/003_payments.sql` | `db.ts` injector |
| `prodify-layer/db/rls.sql` | `db.ts` injector |
| `prodify-layer/payments/gateway.ts` | `payments.ts` injector |
| `.github/workflows/ci.yml` | new `github.ts` injector |
| `prodify-layer/payments/stripe.ts` | `payments.ts` injector (existing, unchanged) |
| `prodify-layer/routes/api/checkout/route.ts` | `payments.ts` injector (existing) |
| `prodify-layer/routes/api/webhooks/stripe/route.ts` | `payments.ts` injector (hardened) |

New CLI command: `prodify secrets` (new `secrets.ts` module in `src/commands/`)

---

## 9. API Keys — How to Get Each One

### 9.1 Supabase Keys

**`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_ANON_KEY`**
1. Go to [supabase.com](https://supabase.com) → sign up / log in
2. Click **"New project"** → enter name, database password, region → Create
3. Wait ~2 minutes for the project to spin up
4. Go to **Project Settings** (gear icon, bottom left) → **API**
5. Under **Project URL** — copy this as `NEXT_PUBLIC_SUPABASE_URL`
6. Under **Project API keys** → `anon` `public` — copy as `SUPABASE_ANON_KEY`

**`SUPABASE_SERVICE_ROLE_KEY`**
- Same page → **Project API keys** → `service_role` `secret` — copy as `SUPABASE_SERVICE_ROLE_KEY`
- **Keep this secret.** It bypasses RLS. Never expose it client-side.

---

### 9.2 Stripe Keys

**`STRIPE_SECRET_KEY`**
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → sign up / log in
2. In the top bar, make sure you're in **Test mode** (toggle top right)
3. Click **Developers** (top right) → **API keys**
4. Under **Secret key** → click **Reveal test key** → copy as `STRIPE_SECRET_KEY`
5. For production: flip the toggle to **Live mode** and repeat

**`STRIPE_WEBHOOK_SECRET`**
1. In Stripe Dashboard → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Enter your endpoint URL: `https://your-app.vercel.app/api/webhooks/stripe`
4. Under **"Select events"** → add:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `customer.subscription.deleted`
5. Click **Add endpoint**
6. On the webhook detail page → **Signing secret** → click **Reveal** → copy as `STRIPE_WEBHOOK_SECRET`

---

### 9.3 GitHub Personal Access Token (for `prodify secrets`)

**`--github-token`**
1. Go to [github.com](https://github.com) → your avatar (top right) → **Settings**
2. Scroll to bottom → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
3. Click **Generate new token**
4. Set **Repository access** → select your repo
5. Under **Permissions** → **Repository permissions** → set **Secrets** to `Read and write`
6. Click **Generate token** → copy immediately (shown only once)

---

### 9.4 Vercel API Token (for `prodify secrets --vercel-token`)

**`--vercel-token`**
1. Go to [vercel.com](https://vercel.com) → log in
2. Click your avatar (top right) → **Account Settings**
3. Left sidebar → **Tokens**
4. Click **Create** → give it a name (e.g., `prodify`) → set scope to your team/account → **Create token**
5. Copy the token immediately (shown only once)

**`--vercel-project-id`**
1. In Vercel Dashboard → open your project
2. Go to **Settings** → **General**
3. Scroll down to **Project ID** → copy it

---

### 9.5 `NEXTAUTH_SECRET`

This is not obtained from any service — you generate it yourself:
```bash
openssl rand -base64 32
```
Copy the output as `NEXTAUTH_SECRET`. It must be a strong random string (32+ bytes).

---

## 10. Files Changed in Prodify Source

| Source file | Change |
|---|---|
| `src/prompts.ts` | Add 4th prompt: `deployToVercel` |
| `src/types.ts` | Add `deployToVercel: boolean` to `ProdifyAnswers` |
| `src/injectors/db.ts` | Full rewrite — Supabase SQL migrations instead of Prisma schema |
| `src/injectors/payments.ts` | Add `gateway.ts` template; update webhook handler to use Supabase client |
| `src/injectors/github.ts` | New — injects `.github/workflows/ci.yml` |
| `src/injector.ts` | Wire in `github.ts` injector |
| `src/git.ts` | Change: commit to new branch + conditionally open PR |
| `src/commands/secrets.ts` | New — `prodify secrets` command implementation |
| `src/index.ts` | Register `prodify secrets` command |
