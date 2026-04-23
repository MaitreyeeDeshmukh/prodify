# Rules for the Coding Agent
**Project:** Prodify
**Date:** 2026-04-22

---

## Security Rules (Non-Negotiable)

- Never commit `.env` or any file containing secrets to git
- `.env` must always be present in `.gitignore` before any commit is made
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only, never reference it in client components or `NEXT_PUBLIC_` vars
- Never log secrets, tokens, or API keys to the console
- Webhook endpoints must always verify the Stripe signature before processing anything
- Idempotency keys must be checked before every Stripe API call

---

## Code Style Rules

- No em dashes (`--`) in code, comments, or generated docs. Use a comma or rewrite the sentence.
- Comments must be short and human. One line max where possible.
- Only comment what is not obvious from reading the code. Skip comments like `// set the value`
- Use plain English in comments, no jargon or filler

```ts
// good
// expire keys after 24h to prevent stale cache hits
const expiresAt = new Date(Date.now() + 86400000);

// bad
// This function sets the expiration date for the idempotency key by calculating
// the current timestamp and adding the desired time-to-live value in milliseconds
const expiresAt = new Date(Date.now() + 86400000);
```

---

## File Structure Rules

Organize files by domain, not by type. Do not dump everything in one folder.

```
prodify-layer/
  auth/           # auth config only
  db/
    migrations/   # SQL files only, numbered in order
  payments/       # Stripe helpers and gateway
  routes/api/     # API route handlers only
```

Do not create files at the root of `prodify-layer/` unless they are entry points. Put everything in the right domain folder.

For the Prodify CLI source:

```
src/
  commands/       # one file per CLI command (inject, secrets)
  injectors/      # one file per injector domain (auth, db, payments, github)
  lib/            # shared utilities (logger, detector, types)
```

Do not mix command logic with injector logic. Keep each file focused on one job.

---

## Git Rules

- Never commit `.env`, `.env.local`, `.env.production`, or any dotenv variant
- Always create a new branch for injected changes, never commit directly to `main`
- Branch names follow the pattern: `prodify/inject-<timestamp>`
- Commit messages are short and descriptive, present tense
- Do not use `--no-verify` to skip hooks

---

## Supabase Rules

- Use the service role client only on the server side
- Use the anon client for anything the user's browser touches
- RLS must be enabled on every table that holds user data
- Add a policy for every table. No table should have RLS enabled with zero policies (that blocks all access)
- New tables get a migration file. Do not alter existing migration files, add a new numbered one.

---

## Stripe Rules

- Always use idempotency keys for `paymentIntents.create` and `subscriptions.create`
- Never expose raw Stripe error objects to the client. Normalize them first.
- Webhook handler must upsert `webhook_events` before processing to prevent duplicates
- Stripe customer ID is stored in `subscriptions.stripe_customer_id`, look it up from DB, never hardcode

---

## AWS Bedrock Rules

- Never hardcode AWS credentials in source files
- Access is via IAM roles in production
- For local dev, use `AWS_PROFILE` or environment variables set in `.env` (gitignored)
- Model ID is configured via `AWS_BEDROCK_MODEL_ID` env var, not hardcoded

---

## Testing Rules

- Every new injector function needs at least one unit test
- Tests go in `tests/` mirroring the `src/` structure
- Mock external services (Stripe, Supabase, GitHub API) in tests, do not hit real endpoints
- CI must pass before any PR can be merged

---

## What the Agent Must Not Do

- Do not auto-merge PRs
- Do not push directly to `main`
- Do not delete migration files
- Do not modify `.env` files
- Do not add `console.log` in production code paths, use the logger
- Do not install packages without checking if the functionality already exists in the codebase
