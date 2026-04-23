Got it, you want a **full, long-form `product-info.md`** that captures the entire picture so Claude never loses the context. Here is a more complete version.

***

# SaaSify Product Info

## 1. What SaaSify is

SaaSify is a **CLI-first retrofit tool** that walks up to an already-built codebase, detects a supported stack, and injects a production-ready SaaS infrastructure layer into it.

It is designed for founders and teams who already have a working app and now need:

- Authentication that is safe and consistent.
- Stripe subscriptions and billing flows.
- Webhook handling and subscription lifecycle.
- Entitlements and access control.
- Supabase schema changes and RLS.
- Deployment readiness on Vercel.

**Core promise:**  
Boilerplates help you start. SaaSify helps you monetize what you already built.

SaaSify is **not** a boilerplate, framework, or AI app builder. It is a **repo retrofit engine**.

***

## 2. The problem in detail

### 2.1 The new reality

AI tools, templates, and builders have made it easy to create prototypes quickly:

- Lovable and Bolt can generate full-stack apps.
- Cursor and other AI coding tools can scaffold features quickly.
- Next.js + Supabase + Stripe + Vercel stacks are heavily documented and used. [vercel](https://vercel.com/templates/next.js/stripe-supabase-saas-starter-kit)

As a result:
- Many teams reach “demo” in days.
- The bottleneck has moved from building the first version to **making that version production-ready and monetizable**.

### 2.2 The actual gap

Turning a prototype into a SaaS product requires:

- Hardening **auth** and sessions.
- Adding **Stripe subscriptions** and handling:
  - checkout flows,
  - trial logic,
  - upgrades and downgrades,
  - cancellations.
- Managing **webhooks** and async events:
  - subscription created/updated/deleted,
  - payment succeeded/failed. [docs.stripe](https://docs.stripe.com/billing/subscriptions/webhooks)
- Mapping billing state to **entitlements and access**:
  - which routes are free,
  - which features are paid-only,
  - who belongs to which plan.
- Updating **database schema** and enabling **RLS**.
- Ensuring **deployment-ready environments** and secrets.

Today, most options assume you start from a **clean template** that already has this wired.

There is almost nothing that says:
“Give me the repo you already have and I will upgrade it safely.”

That is the gap.

***

## 3. Product thesis

If you can:

1. Detect a known stack.
2. Recognize a known repo pattern.
3. Plan the necessary SaaS infrastructure changes.
4. Apply those changes on a branch with a diff-first workflow.

Then you can turn a large class of **existing** apps into real SaaS products without forcing a complete rebuild on a boilerplate.

SaaSify is that tool for a narrow initial stack.

***

## 4. Supported v1 stack

SaaSify v1 will support **one specific stack**:

- **Frontend:** Next.js 14/15 with App Router.
- **Backend/data:** Supabase (Postgres + Auth).
- **Payments:** Stripe subscriptions.
- **Deployment:** Vercel.

This stack is already a de facto standard in:
- Next.js SaaS starter kits.
- “Fastest way to build a SaaS” guides.
- AI-assisted app builder exports. [github](https://github.com/nextjs/saas-starter)

SaaSify will **not** support other stacks in v1. That is deliberate.

***

## 5. What SaaSify actually does, step by step

For a supported repo, SaaSify will:

1. **Scan and detect stack.**
   - Confirm it is a Next.js + Supabase repo with App Router and no conflicting billing code.

2. **Classify repo pattern.**
   - Recognize a supported layout pattern:
     - basic app with Supabase auth,
     - dashboard app with protected routes,
     - CRUD app with user profiles,
     - AI-built app that still follows conventional Next.js structure.

3. **Collect business model input.**
   - Product name,
   - free tier or not,
   - paid plans (names, prices, intervals),
   - which routes/features should be gated.

4. **Generate a retrofit plan.**
   - Files to create,
   - files to modify,
   - new tables,
   - RLS policies,
   - new routes (checkout, webhooks, portal),
   - env var requirements,
   - deployment checklist.

5. **Show the plan.**
   - Before any repo mutation, show the plan in detail.
   - Support `--dry-run` to only show, not apply.

6. **Create a new branch.**
   - Never touch the main branch directly.
   - Use a `saasify/retrofit-...` naming convention.

7. **Apply changes.**
   - Add Stripe checkout session route.
   - Add Stripe webhook handler with signature verification.
   - Add subscription and plan tables/migrations in Supabase.
   - Add entitlements and access-check utilities.
   - Add route and component gating helpers.
   - Add billing portal route.
   - Adjust auth middleware if needed.

8. **Show diffs and docs.**
   - Print a grouped diff.
   - Create a `saasify-diff.md` summary.
   - Create a `.saasify/pr-summary.md` with:
     - what changed,
     - required manual steps,
     - testing steps.

9. **Generate env and deploy checklist.**
   - `.env.local.saasify` template with required variables.
   - Checklist for Stripe products, webhooks, Supabase migrations, and Vercel env setup.

10. **Help validate.**
    - Optionally run `npx saasify check` to verify:
      - env vars present,
      - build passes,
      - webhook endpoint configured.

The developer still reviews everything, runs migrations, tests flows, and decides when to merge and deploy.

***

## 6. Target users

### 6.1 Primary user

**Solo founder or 1–3 person team** that:

- Has a working Next.js app.
- Uses Supabase today (auth or data).
- Wants to add or fix Stripe subscriptions.
- Deploys on Vercel (or plans to).
- Does not want to rebuild from a boilerplate.

Often they:
- used Lovable, Bolt, Cursor, or similar tools,
- hand-wired parts of the app,
- and now need production-grade SaaS wiring.

### 6.2 Secondary user

**Small startup engineering team** that:

- Built an internal or external app quickly.
- Needs recurring revenue and gated access.
- Wants to avoid manual Stripe integration yet again.
- Wants a safer and faster upgrade path.

### 6.3 Non-target for v1

- Non-Next.js apps.
- Apps without Supabase.
- Complex enterprise environments.
- Existing, heavily customized billing systems.
- Apps with mixed monorepo frameworks.

***

## 7. Competitive landscape

### 7.1 Boilerplates and starter kits

These are “start here” tools.

#### ShipFast, SupaStarter, Next-Forge, etc.

- **What they do:**
  - Create a brand-new SaaS scaffold:
    - Next.js app,
    - Auth,
    - Stripe (or other billing),
    - Database,
    - Admin or dashboard UI.
- **How they work:**
  - You start a **new project** from them.
  - Then you build your app on top of their structure.
- **Strengths:**
  - Great for new projects.
  - Good built-in patterns and features.
- **Limitations:**
  - Do not walk into your existing code.
  - Migrating to them later means:
    - moving routes,
    - porting components,
    - redoing data wiring,
    - reconciling state and logic.
- **SaaSify’s difference:**
  - SaaSify lets you keep the app you already have.
  - It injects infrastructure without a full rewrite.

#### Wasp

- **What it is:**
  - A framework/DSL that generates full-stack apps with auth and payments. [blog.openreplay](https://blog.openreplay.com/a-dive-into-wasp/)
- **How it works:**
  - You design with Wasp and let it generate the app.
  - Migration tools are for upgrading Wasp versions, not for upgrading foreign repos. [wasp](https://wasp.sh/docs/migration-guides/migrate-from-0-11-to-0-12)
- **Difference:**
  - Wasp owns the whole framework.
  - SaaSify leaves you in plain Next.js and Supabase, modifying your existing code.

#### Divjoy

- **What it is:**
  - React app generator with Stripe, Firebase, etc.
- **How it works:**
  - You configure options and export a fresh codebase.
- **Difference:**
  - Divjoy is “generate a repo.”
  - SaaSify is “modify the repo you already have.”

#### create-t3-app

- **What it is:**
  - CLI to scaffold a new T3 stack project. [create.t3](https://create.t3.gg)
- **Notable detail:**
  - Users requested running it on existing projects to add pieces.
  - This was explicitly scoped out as not supported. [github](https://github.com/t3-oss/create-t3-app/issues/116)
- **Difference:**
  - It is explicitly a **new-project scaffolder**.
  - SaaSify is explicitly an **existing-project upgrader**.

### 7.2 AI app builders

These are “let us build the app for you” tools.

#### Lovable

- **What it does:**
  - Helps build apps with AI, often using Next.js + Supabase.
  - Good Supabase integration and step-by-step auth setup. [docs.lovable](https://docs.lovable.dev/integrations/supabase)
- **How it works:**
  - You work inside Lovable.
  - It generates and refines your app.
- **Overlaps:**
  - Can generate apps with auth and payments.
- **Limits:**
  - Once you export and heavily edit a repo, you might leave the happy path.
  - No dedicated “upgrade this arbitrary GitHub repo into a SaaS” feature.
- **Difference:**
  - Lovable is for building.
  - SaaSify is for upgrading exported or hand-built repos.

#### Bolt

- **What it does:**
  - AI builder with Supabase and Stripe integrations. [support.bolt](https://support.bolt.new/integrations/stripe)
- **How it works:**
  - You describe the app, Bolt generates it.
  - It often requires staying in its own structure and flow.
- **Difference:**
  - Bolt is a place to build.
  - SaaSify is something you run **on** the repo after your building is done.

### 7.3 Infrastructure platforms

These are **foundations**, not direct competitors.

#### Stripe

- **What Stripe provides:**
  - Subscriptions,
  - checkout,
  - billing portal,
  - invoices,
  - webhooks,
  - extensive documentation. [docs.stripe](https://docs.stripe.com/billing/subscriptions/overview)
- **What Stripe does not do:**
  - Inspect your app code.
  - Modify your routes.
  - Apply schema changes in Supabase.
  - Inject gating and entitlements into your component tree.
- **Relationship:**
  - SaaSify uses Stripe.
  - SaaSify does not replace Stripe.

#### Supabase

- **What Supabase provides:**
  - Postgres,
  - auth,
  - storage,
  - RLS,
  - edge functions.
- **What Supabase does not do:**
  - Walk into your Next.js repo.
  - Decide how to integrate Stripe.
  - Add plan-based access checks into your existing pages.
- **Relationship:**
  - SaaSify uses Supabase as the data/auth layer and updates it.

#### Vercel

- **What Vercel provides:**
  - Hosting,
  - builds,
  - previews,
  - env management.
- **What Vercel does not do:**
  - Add billing and entitlements into your codebase.
- **Relationship:**
  - SaaSify aims to make repos Vercel-ready with the right envs and routes.

***

## 8. Why SaaSify is not just a thin wrapper

There is real risk of being “just another layer” if SaaSify is:

- only prompting an LLM to generate Stripe code,
- not pattern-aware,
- not safe,
- not deterministic.

To avoid this, SaaSify should:

- Use deterministic scanning and classification.
- Maintain a **pattern library** for supported repo shapes.
- Use AST/codemod-style transforms rather than blind text replacements where possible.
- Always work on git branches and show diffs.
- Always expose a plan before apply.
- Always run preflight security checks.
- Accumulate knowledge of real-world repo patterns and failures over time.

This is what makes it a **product**, not simply a prompt pack.

***

## 9. Security philosophy

Because SaaSify touches billing and auth, it must adopt a security-first posture:

- Never commit `.env` or secrets.
- Never expose server keys to client code.
- Enforce RLS for user-owned data.
- Validate auth and authorization on the server.
- Verify Stripe webhooks.
- Validate inputs thoroughly.
- Block operations when uncertain.
- Fail closed, not open.

SaaSify is not only about speed. It is about **safe upgrades**.

***

## 10. Long-term vision

In the long run, SaaSify could:

- Support multiple stacks (Next.js + X, Rails, Laravel).
- Support more billing patterns (seat-based, usage-based).
- Support org/team models.
- Offer a hosted control plane for:
  - project history,
  - migration tracking,
  - rollbacks,
  - analytics.

But all of that depends on proving one narrow wedge first:

**Upgrade Next.js + Supabase apps to subscription-ready SaaS safely.**

***

## 11. One-sentence summary

SaaSify is a CLI that transforms existing Next.js + Supabase apps into production-ready SaaS products by injecting Stripe subscriptions, entitlements, auth hardening, and deployment safety into the repo the user already has, without forcing a rebuild on a boilerplate.
