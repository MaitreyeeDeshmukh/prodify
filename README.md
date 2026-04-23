# Prodify

> One command. Production-ready SaaS infrastructure injected into your existing codebase.

Prodify scans your project, asks three targeted questions, and injects a complete, production-ready SaaS layer — auth, payments, database schema, and environment config — directly into your codebase.

## What it injects

| Layer | Technology | What you get |
|-------|-----------|-------------|
| **Auth** | NextAuth.js | OAuth providers tuned to your user type |
| **Payments** | Stripe | Checkout session, webhook handler, customer portal |
| **Database** | Prisma | Schema with users, subscriptions, (org/membership if teams) |
| **Env** | `.env.example` | Every required key, labeled by service |
| **Docs** | `README-prodify.md` | Activation checklist for your team |

## Installation

```bash
npm install -g prodify
# or run directly
npx prodify inject
```

## Usage

```bash
# Interactive injection (recommended)
prodify inject

# Preview without writing files
prodify inject --dry-run

# Detailed logging
prodify inject --verbose

# Skip git commit/push
prodify inject --no-git
```

## The 3 questions

1. **What are you charging for?** — per seat / flat subscription / usage-based
2. **Who are your users?** — individuals / teams / enterprise
3. **What stack are you on?** — auto-detected, confirm or override

## Supported stacks

- **Next.js** (primary target — full App Router routes injected)
- Express, FastAPI, Rails (detection only; Next.js templates injected)

## After injection

See `prodify-layer/README-prodify.md` in your project for the activation checklist.

## Development

```bash
git clone https://github.com/maitreyee/prodify
cd prodify
npm install
npm test          # run all tests
npm run build     # compile TypeScript
npm run typecheck # type-check without emitting
```

## License

MIT
