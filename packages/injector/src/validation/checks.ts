// ─── Injection Quality Checks ─────────────────────────────────────────────────
// Every check is a pure function: (files, context) → CheckResult.
// Checks are grouped by domain so they can be invoked selectively.
// Run by validator.ts after all files are written to tmpDir, before git push.

import fs from 'fs';
import path from 'path';
import type { CheckResult, InjectedFile } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CHECKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A1 — middleware.ts must exist at the project root.
 * Next.js only picks up middleware from the root. Writing it to prodify-layer/
 * means session protection is completely inert.
 */
export function checkMiddlewarePlacement(tmpDir: string): CheckResult {
  const rootMiddleware = path.join(tmpDir, 'middleware.ts');
  const rootMiddlewareJs = path.join(tmpDir, 'middleware.js');
  const exists = fs.existsSync(rootMiddleware) || fs.existsSync(rootMiddlewareJs);

  if (!exists) {
    return {
      id: 'A1-middleware-placement',
      severity: 'BLOCK',
      rule: 'Middleware must be at project root',
      message: 'middleware.ts not found at project root. Session protection is inert without it.',
      file: 'middleware.ts',
      fix: 'Ensure the inject route writes the middleware file to <project-root>/middleware.ts, not inside prodify-layer/.',
    };
  }

  // Check the middleware actually imports from @supabase/ssr or next-auth
  const content = fs.readFileSync(rootMiddleware, 'utf-8');
  const hasAuth = content.includes('@supabase/ssr') || content.includes('next-auth') || content.includes('getToken');
  if (!hasAuth) {
    return {
      id: 'A1-middleware-placement',
      severity: 'WARN',
      rule: 'Middleware must contain session logic',
      message: 'middleware.ts exists at root but does not appear to contain session validation.',
      file: 'middleware.ts',
      fix: 'Verify that the Supabase session refresh or NextAuth getToken call is present in middleware.ts.',
    };
  }

  return {
    id: 'A1-middleware-placement',
    severity: 'PASS',
    rule: 'Middleware at project root',
    message: 'middleware.ts found at project root with session logic.',
  };
}

/**
 * A2 — Protected paths in middleware must actually exist in the repo.
 * Hardcoded paths from other projects protect nothing in the target repo.
 */
export function checkProtectedPathsExist(tmpDir: string, files: InjectedFile[]): CheckResult {
  const middlewareFile = files.find(f =>
    f.relativePath === 'middleware.ts' ||
    f.absolutePath?.endsWith('middleware.ts'),
  );

  if (!middlewareFile) {
    return {
      id: 'A2-protected-paths',
      severity: 'WARN',
      rule: 'Protected paths must match repo routes',
      message: 'Could not find middleware in injected files to check protected paths.',
    };
  }

  const match = middlewareFile.content.match(/PROTECTED_PATHS[^=]*=\s*(\[[\s\S]*?\])/);
  if (!match) {
    return {
      id: 'A2-protected-paths',
      severity: 'WARN',
      rule: 'Protected paths must match repo routes',
      message: 'Could not parse PROTECTED_PATHS from middleware.ts.',
    };
  }

  let paths: string[] = [];
  try {
    paths = JSON.parse(match[1]) as string[];
  } catch {
    return {
      id: 'A2-protected-paths',
      severity: 'WARN',
      rule: 'Protected paths must match repo routes',
      message: 'Could not parse PROTECTED_PATHS array.',
    };
  }

  // Check at least one protected path exists as a real route in the repo
  const appDir = path.join(tmpDir, 'app');
  const pagesDir = path.join(tmpDir, 'src', 'app');
  const srcPagesDir = path.join(tmpDir, 'pages');
  const hasApp = fs.existsSync(appDir) || fs.existsSync(pagesDir);

  if (!hasApp) {
    return {
      id: 'A2-protected-paths',
      severity: 'WARN',
      rule: 'Protected paths must match repo routes',
      message: 'Could not locate app/ directory to verify protected paths.',
    };
  }

  const matchedPaths = paths.filter(p => {
    const routeDir = p.replace(/^\//, '');
    return (
      fs.existsSync(path.join(tmpDir, 'app', routeDir)) ||
      fs.existsSync(path.join(tmpDir, 'src', 'app', routeDir)) ||
      fs.existsSync(path.join(srcPagesDir, routeDir + '.tsx')) ||
      fs.existsSync(path.join(srcPagesDir, routeDir + '.ts'))
    );
  });

  if (matchedPaths.length === 0) {
    return {
      id: 'A2-protected-paths',
      severity: 'WARN',
      rule: 'Protected paths must match repo routes',
      message: `Protected paths [${paths.join(', ')}] do not match any detected routes in this repo.`,
      fix: 'Update PROTECTED_PATHS in middleware.ts to match your actual route structure.',
    };
  }

  return {
    id: 'A2-protected-paths',
    severity: 'PASS',
    rule: 'Protected paths match repo routes',
    message: `${matchedPaths.length}/${paths.length} protected paths found in repo.`,
  };
}

/**
 * A3 — No require() calls in TypeScript files.
 * require() in .ts breaks ESM compatibility and is a code smell.
 */
export function checkNoRequire(files: InjectedFile[]): CheckResult {
  const tsFiles = files.filter(f => f.relativePath.endsWith('.ts') || f.relativePath.endsWith('.tsx'));
  const violations: string[] = [];

  for (const file of tsFiles) {
    // Allow require.resolve() which is sometimes legitimate in configs
    const requireMatch = file.content.match(/\brequire\s*\([^)]+\)/g);
    if (requireMatch) {
      const nonResolve = requireMatch.filter(m => !m.includes('require.resolve'));
      if (nonResolve.length > 0) {
        violations.push(file.relativePath);
      }
    }
  }

  if (violations.length > 0) {
    return {
      id: 'A3-no-require',
      severity: 'BLOCK',
      rule: 'No require() in TypeScript files',
      message: `require() found in: ${violations.join(', ')}`,
      fix: 'Replace require() with ESM import statements at the top of each file.',
    };
  }

  return {
    id: 'A3-no-require',
    severity: 'PASS',
    rule: 'No require() in TypeScript files',
    message: 'No require() calls found in injected TypeScript files.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS CHECKS
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_STRIPE_EVENTS = [
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const;

/**
 * P1 — Webhook must handle all required Stripe lifecycle events.
 * Missing even one means plan changes, failures, or cancellations are silently lost.
 */
export function checkStripeEvents(files: InjectedFile[]): CheckResult {
  const webhookFile = files.find(f => f.relativePath.includes('webhooks/stripe'));

  if (!webhookFile) {
    return {
      id: 'P1-stripe-events',
      severity: 'WARN',
      rule: 'Stripe webhook must handle all lifecycle events',
      message: 'No Stripe webhook file found in injected files.',
    };
  }

  const missing = REQUIRED_STRIPE_EVENTS.filter(
    event => !webhookFile.content.includes(`'${event}'`) && !webhookFile.content.includes(`"${event}"`),
  );

  if (missing.length > 0) {
    return {
      id: 'P1-stripe-events',
      severity: 'BLOCK',
      rule: 'Stripe webhook must handle all lifecycle events',
      message: `Missing Stripe event handlers: ${missing.join(', ')}`,
      file: webhookFile.relativePath,
      fix: `Add case handlers for: ${missing.join(', ')} in the webhook switch statement.`,
    };
  }

  return {
    id: 'P1-stripe-events',
    severity: 'PASS',
    rule: 'Stripe webhook handles all lifecycle events',
    message: `All ${REQUIRED_STRIPE_EVENTS.length} required Stripe events are handled.`,
  };
}

/**
 * P2 — No `as any` casts in injected TypeScript files.
 * `as any` in payment code can silently corrupt financial data.
 */
export function checkNoAsAny(files: InjectedFile[]): CheckResult {
  const tsFiles = files.filter(f => f.relativePath.endsWith('.ts') || f.relativePath.endsWith('.tsx'));
  const violations: string[] = [];

  for (const file of tsFiles) {
    if (/\bas\s+any\b/.test(file.content)) {
      violations.push(file.relativePath);
    }
  }

  if (violations.length > 0) {
    return {
      id: 'P2-no-as-any',
      severity: 'WARN',
      rule: 'No `as any` casts in injected files',
      message: `\`as any\` found in: ${violations.join(', ')}`,
      fix: 'Replace `as any` with proper Stripe SDK types (Stripe.Invoice, Stripe.Subscription, etc.).',
    };
  }

  return {
    id: 'P2-no-as-any',
    severity: 'PASS',
    rule: 'No `as any` casts',
    message: 'No `as any` found in injected TypeScript files.',
  };
}

/**
 * P3 — Customer portal route must be generated.
 * Without it, users cannot cancel — violates EU/GDPR/California right-to-cancel.
 */
export function checkPortalRoutePresent(files: InjectedFile[]): CheckResult {
  const portalFile = files.find(f =>
    f.relativePath.includes('portal') || f.relativePath.includes('billing/portal'),
  );

  if (!portalFile) {
    return {
      id: 'P3-customer-portal',
      severity: 'BLOCK',
      rule: 'Customer portal route must be generated',
      message: 'No billing portal route found in injected files. Users cannot cancel their subscription.',
      fix: 'Add a POST /api/billing/portal route that calls stripe.billingPortal.sessions.create().',
    };
  }

  const hasPortalCreate = portalFile.content.includes('billingPortal.sessions.create');
  if (!hasPortalCreate) {
    return {
      id: 'P3-customer-portal',
      severity: 'BLOCK',
      rule: 'Portal route must call billingPortal.sessions.create',
      message: 'Portal route exists but does not call stripe.billingPortal.sessions.create().',
      file: portalFile.relativePath,
      fix: 'Ensure the portal route creates a billing portal session and returns its URL.',
    };
  }

  return {
    id: 'P3-customer-portal',
    severity: 'PASS',
    rule: 'Customer portal route present',
    message: `Portal route found: ${portalFile.relativePath}`,
  };
}

/**
 * P4 — No hardcoded success/cancel URLs in checkout routes.
 * Hardcoded URLs 404 on any domain other than the one they were written for.
 */
export function checkNoHardcodedUrls(files: InjectedFile[]): CheckResult {
  const paymentFiles = files.filter(f =>
    f.relativePath.includes('checkout') ||
    f.relativePath.includes('webhook') ||
    f.relativePath.includes('portal'),
  );

  // Detect literal http(s):// URLs that aren't process.env references or template literals
  // This catches things like: success_url: 'https://my-app.com/dashboard'
  const hardcodedUrlPattern = /['"`]https?:\/\/(?!localhost)[a-z0-9-]+\.[a-z]{2,}/i;
  const violations: string[] = [];

  for (const file of paymentFiles) {
    // Exclude comment lines
    const nonCommentLines = file.content
      .split('\n')
      .filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
    const nonCommentContent = nonCommentLines.join('\n');

    if (hardcodedUrlPattern.test(nonCommentContent)) {
      violations.push(file.relativePath);
    }
  }

  if (violations.length > 0) {
    return {
      id: 'P4-no-hardcoded-urls',
      severity: 'BLOCK',
      rule: 'No hardcoded URLs in payment routes',
      message: `Hardcoded URL found in: ${violations.join(', ')}`,
      fix: 'Use `req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL` for all success/cancel URLs.',
    };
  }

  return {
    id: 'P4-no-hardcoded-urls',
    severity: 'PASS',
    rule: 'No hardcoded URLs in payment routes',
    message: 'All payment routes use dynamic origin for redirect URLs.',
  };
}

/**
 * P5 — Webhook idempotency store must come BEFORE business logic.
 * If the upsert happens after any update, crashes leave orphaned state.
 */
export function checkWebhookIdempotency(files: InjectedFile[]): CheckResult {
  const webhookFile = files.find(f => f.relativePath.includes('webhooks/stripe'));
  if (!webhookFile) {
    return {
      id: 'P5-webhook-idempotency',
      severity: 'WARN',
      rule: 'Webhook idempotency store must precede business logic',
      message: 'No webhook file found.',
    };
  }

  const content = webhookFile.content;
  const upsertPos = content.indexOf('webhook_events');
  const switchPos = content.indexOf('switch (event.type)');

  if (upsertPos === -1) {
    return {
      id: 'P5-webhook-idempotency',
      severity: 'BLOCK',
      rule: 'Webhook idempotency store must precede business logic',
      message: 'No webhook_events upsert found in webhook handler.',
      file: webhookFile.relativePath,
      fix: 'Add an upsert to webhook_events table BEFORE the switch statement.',
    };
  }

  if (switchPos !== -1 && upsertPos > switchPos) {
    return {
      id: 'P5-webhook-idempotency',
      severity: 'BLOCK',
      rule: 'Idempotency upsert must come before business logic',
      message: 'webhook_events upsert appears AFTER the switch statement — re-delivery can double-process.',
      file: webhookFile.relativePath,
      fix: 'Move the webhook_events upsert to before the switch (event.type) block.',
    };
  }

  return {
    id: 'P5-webhook-idempotency',
    severity: 'PASS',
    rule: 'Webhook idempotency store precedes business logic',
    message: 'Idempotency upsert is before the switch statement.',
  };
}

/**
 * P6 — Checkout route must handle null session.url.
 * stripe.checkout.sessions.create() can return url: null in error cases.
 */
export function checkCheckoutUrlNullHandling(files: InjectedFile[]): CheckResult {
  const checkoutFile = files.find(f =>
    f.relativePath.includes('checkout') && !f.relativePath.includes('webhook'),
  );
  if (!checkoutFile) {
    return {
      id: 'P6-checkout-null-url',
      severity: 'WARN',
      rule: 'Checkout route must handle null session.url',
      message: 'No checkout route found.',
    };
  }

  const hasNullCheck =
    checkoutFile.content.includes('session.url') &&
    (checkoutFile.content.includes('!session.url') || checkoutFile.content.includes('session.url === null'));

  if (!hasNullCheck) {
    return {
      id: 'P6-checkout-null-url',
      severity: 'WARN',
      rule: 'Checkout route must handle null session.url',
      message: 'checkout route may not handle null session.url — user gets no redirect on Stripe error.',
      file: checkoutFile.relativePath,
      fix: 'Add: if (!session.url) return NextResponse.json({ error: "..." }, { status: 500 })',
    };
  }

  return {
    id: 'P6-checkout-null-url',
    severity: 'PASS',
    rule: 'Checkout route handles null session.url',
    message: 'Null URL guard found in checkout route.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE CHECKS
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_INDEXES = [
  'users_stripe_customer_id_idx',
  'subscriptions_user_id_idx',
  'webhook_events_type_idx',
] as const;

/**
 * D1 — SQL schema must have indexes on queried columns.
 * Queries on stripe_customer_id and user_id without indexes do full table scans.
 */
export function checkSchemaIndexes(files: InjectedFile[]): CheckResult {
  const schemaFile = files.find(f => f.relativePath.endsWith('.sql'));
  if (!schemaFile) {
    return {
      id: 'D1-schema-indexes',
      severity: 'WARN',
      rule: 'Schema must include required indexes',
      message: 'No SQL schema file found in injected files.',
    };
  }

  const missing = REQUIRED_INDEXES.filter(idx => !schemaFile.content.includes(idx));

  if (missing.length > 0) {
    return {
      id: 'D1-schema-indexes',
      severity: 'WARN',
      rule: 'Schema must include required indexes',
      message: `Missing indexes: ${missing.join(', ')}`,
      file: schemaFile.relativePath,
      fix: `Add: CREATE INDEX IF NOT EXISTS <name> ON <table> (<column>); for each missing index.`,
    };
  }

  return {
    id: 'D1-schema-indexes',
    severity: 'PASS',
    rule: 'Schema includes required indexes',
    message: `All ${REQUIRED_INDEXES.length} required indexes present.`,
  };
}

/**
 * D2 — Enum-like TEXT columns must have CHECK constraints.
 * Without CHECK, invalid values like 'actve' (typo) silently enter the DB.
 */
export function checkCheckConstraints(files: InjectedFile[]): CheckResult {
  const schemaFile = files.find(f => f.relativePath.endsWith('.sql'));
  if (!schemaFile) {
    return {
      id: 'D2-check-constraints',
      severity: 'WARN',
      rule: 'Enum-like columns must have CHECK constraints',
      message: 'No SQL schema file found.',
    };
  }

  // Must find CHECK on the same line or within 2 lines of the column definition
  const hasSubscriptionTierCheck =
    /subscription_tier\s+TEXT[^\n]*CHECK/i.test(schemaFile.content) ||
    /subscription_tier[\s\S]{0,200}CHECK\s*\(\s*subscription_tier/i.test(schemaFile.content);
  const hasSubscriptionStatusCheck =
    /subscription_status\s+TEXT[^\n]*CHECK/i.test(schemaFile.content) ||
    /subscription_status[\s\S]{0,200}CHECK\s*\(\s*subscription_status/i.test(schemaFile.content);

  if (!hasSubscriptionTierCheck || !hasSubscriptionStatusCheck) {
    return {
      id: 'D2-check-constraints',
      severity: 'WARN',
      rule: 'Enum-like columns must have CHECK constraints',
      message: 'subscription_tier or subscription_status column missing CHECK constraint.',
      file: schemaFile.relativePath,
      fix: "Add CHECK (subscription_tier IN ('free', 'pro', 'enterprise')) to the column definition.",
    };
  }

  return {
    id: 'D2-check-constraints',
    severity: 'PASS',
    rule: 'CHECK constraints on enum-like columns',
    message: 'subscription_tier and subscription_status have CHECK constraints.',
  };
}

/**
 * D3 — RLS must be enabled AND have at least one policy on every user-facing table.
 * RLS enabled with no policy = table is locked to everyone (including the user).
 */
export function checkRlsPolicies(files: InjectedFile[]): CheckResult {
  const schemaFile = files.find(f => f.relativePath.endsWith('.sql'));
  if (!schemaFile) {
    return {
      id: 'D3-rls-policies',
      severity: 'WARN',
      rule: 'All RLS-enabled tables must have at least one policy',
      message: 'No SQL schema file found.',
    };
  }

  const content = schemaFile.content;
  const rlsEnabled = (content.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length;
  const policies = (content.match(/CREATE POLICY/g) ?? []).length;

  // webhook_events intentionally has RLS but no public policy (service-role only)
  // So the count of policies should be at least (rlsEnabled - 1)
  if (policies < rlsEnabled - 1) {
    return {
      id: 'D3-rls-policies',
      severity: 'BLOCK',
      rule: 'All RLS-enabled tables must have a policy',
      message: `${rlsEnabled} tables have RLS enabled but only ${policies} policies found. Some tables are inaccessible.`,
      file: schemaFile.relativePath,
      fix: 'Add a SELECT or ALL policy for each table that has ENABLE ROW LEVEL SECURITY.',
    };
  }

  return {
    id: 'D3-rls-policies',
    severity: 'PASS',
    rule: 'RLS tables have policies',
    message: `${rlsEnabled} RLS tables, ${policies} policies.`,
  };
}

/**
 * D4 — Service role key must never appear in client-side files.
 */
export function checkServiceRoleKeyUsage(files: InjectedFile[]): CheckResult {
  const clientFiles = files.filter(f =>
    f.relativePath.includes('client.ts') ||
    f.relativePath.includes('client.tsx') ||
    f.relativePath.includes('browser'),
  );

  const violations = clientFiles.filter(f =>
    f.content.includes('SUPABASE_SERVICE_ROLE_KEY') ||
    f.content.includes('SERVICE_ROLE'),
  );

  if (violations.length > 0) {
    return {
      id: 'D4-service-role-client-leak',
      severity: 'BLOCK',
      rule: 'Service role key must never appear in client files',
      message: `SUPABASE_SERVICE_ROLE_KEY referenced in client file: ${violations.map(f => f.relativePath).join(', ')}`,
      fix: 'Remove service role key from client files. Only use it in server-side route handlers and webhook handlers.',
    };
  }

  return {
    id: 'D4-service-role-client-leak',
    severity: 'PASS',
    rule: 'Service role key not in client files',
    message: 'No service role key references found in client-side files.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CI CHECKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * C1 — CI must use the repo's package manager, not hardcoded npm.
 */
export function checkCiPackageManager(tmpDir: string, files: InjectedFile[]): CheckResult {
  const ciFile = files.find(f => f.relativePath.includes('.github/workflows'));
  if (!ciFile) {
    return {
      id: 'C1-ci-package-manager',
      severity: 'WARN',
      rule: 'CI must use the repo\'s package manager',
      message: 'No CI workflow file found in injected files.',
    };
  }

  // Detect package manager from lockfiles
  const hasPnpmLock = fs.existsSync(path.join(tmpDir, 'pnpm-lock.yaml'));
  const hasYarnLock = fs.existsSync(path.join(tmpDir, 'yarn.lock'));
  const hasBunLock = fs.existsSync(path.join(tmpDir, 'bun.lockb'));

  let expectedPm: string;
  let expectedInstall: string;
  if (hasPnpmLock) {
    expectedPm = 'pnpm';
    expectedInstall = 'pnpm install --frozen-lockfile';
  } else if (hasYarnLock) {
    expectedPm = 'yarn';
    expectedInstall = 'yarn install --frozen-lockfile';
  } else if (hasBunLock) {
    expectedPm = 'bun';
    expectedInstall = 'bun install';
  } else {
    expectedPm = 'npm';
    expectedInstall = 'npm ci';
  }

  if (!ciFile.content.includes(expectedInstall) && !ciFile.content.includes(expectedPm)) {
    return {
      id: 'C1-ci-package-manager',
      severity: 'BLOCK',
      rule: 'CI must use the repo\'s package manager',
      message: `Repo uses ${expectedPm} (detected from lockfile) but CI does not use it.`,
      file: ciFile.relativePath,
      fix: `Replace npm ci with: ${expectedInstall}`,
    };
  }

  return {
    id: 'C1-ci-package-manager',
    severity: 'PASS',
    rule: 'CI uses correct package manager',
    message: `CI uses ${expectedPm} matching repo lockfile.`,
  };
}

/**
 * C2 — CI test command must be conditional (--if-present) if no test script exists.
 */
export function checkCiTestCommand(tmpDir: string, files: InjectedFile[]): CheckResult {
  const ciFile = files.find(f => f.relativePath.includes('.github/workflows'));
  if (!ciFile) {
    return {
      id: 'C2-ci-test-command',
      severity: 'WARN',
      rule: 'CI test command must be safe when no test script exists',
      message: 'No CI workflow file found.',
    };
  }

  const pkgPath = path.join(tmpDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return {
      id: 'C2-ci-test-command',
      severity: 'WARN',
      rule: 'CI test command must be safe when no test script exists',
      message: 'package.json not found — could not verify test script.',
    };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
  const hasTestScript = Boolean(pkg.scripts?.test);

  // If no test script, CI must use --if-present or omit the test step
  const hasRawTestCommand = /run:\s*(npm|pnpm|yarn|bun)\s+test(?!\s+--if-present)/.test(ciFile.content);
  if (!hasTestScript && hasRawTestCommand) {
    return {
      id: 'C2-ci-test-command',
      severity: 'BLOCK',
      rule: 'CI test command must be conditional',
      message: 'CI runs `npm test` but package.json has no test script — CI will always fail.',
      file: ciFile.relativePath,
      fix: 'Change to `npm test --if-present` or remove the test step if the repo has no tests.',
    };
  }

  return {
    id: 'C2-ci-test-command',
    severity: 'PASS',
    rule: 'CI test command is safe',
    message: hasTestScript
      ? 'Repo has a test script — CI test step is valid.'
      : 'No test script — CI uses --if-present or omits the test step.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCY CHECKS
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_DEPS_FOR_SUPABASE = ['@supabase/ssr', '@supabase/supabase-js', 'stripe'];
const REQUIRED_DEPS_FOR_INSFORGE = ['stripe'];

/**
 * Dep1 — All packages referenced in injected files must be in package.json.
 * This is the #1 deploy blocker: injected code imports packages that aren't installed.
 */
export function checkPackageJsonDeps(
  tmpDir: string,
  files: InjectedFile[],
  backend: 'supabase' | 'insforge',
): CheckResult {
  const pkgPath = path.join(tmpDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return {
      id: 'Dep1-package-json-deps',
      severity: 'BLOCK',
      rule: 'Required packages must be in package.json',
      message: 'package.json not found at project root.',
    };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const requiredDeps = backend === 'supabase' ? REQUIRED_DEPS_FOR_SUPABASE : REQUIRED_DEPS_FOR_INSFORGE;
  const missing = requiredDeps.filter(dep => !allDeps[dep]);

  if (missing.length > 0) {
    return {
      id: 'Dep1-package-json-deps',
      severity: 'BLOCK',
      rule: 'Required packages must be in package.json',
      message: `Missing from package.json: ${missing.join(', ')}`,
      fix: `Run: npm install ${missing.join(' ')} — or the inject route should update package.json before committing.`,
    };
  }

  return {
    id: 'Dep1-package-json-deps',
    severity: 'PASS',
    rule: 'Required packages in package.json',
    message: `All required packages found: ${requiredDeps.join(', ')}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLE CHECKS
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_APP_URL',
] as const;

/**
 * E1 — Every process.env reference in injected files must appear in .env.example.
 * Without .env.example coverage, new contributors have no idea what vars to set.
 */
export function checkEnvVarCoverage(tmpDir: string, files: InjectedFile[]): CheckResult {
  const envExamplePath = path.join(tmpDir, '.env.example');
  const envLocalPath = path.join(tmpDir, '.env.local');
  const envPath = path.join(tmpDir, '.env');

  const envExampleExists = fs.existsSync(envExamplePath);
  const envContent = envExampleExists
    ? fs.readFileSync(envExamplePath, 'utf-8')
    : fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

  // Extract all process.env.X from injected files
  const usedVars = new Set<string>();
  for (const file of files) {
    const matches = file.content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
    for (const m of matches) {
      usedVars.add(m[1]);
    }
  }

  const missing = [...usedVars].filter(v => !envContent.includes(v));

  if (!envExampleExists) {
    return {
      id: 'E1-env-coverage',
      severity: 'WARN',
      rule: '.env.example must cover all injected env vars',
      message: `.env.example does not exist. Required vars: ${[...usedVars].join(', ')}`,
      fix: 'The inject route should write a .env.example file with all required variables.',
    };
  }

  if (missing.length > 0) {
    return {
      id: 'E1-env-coverage',
      severity: 'WARN',
      rule: '.env.example must cover all injected env vars',
      message: `Vars referenced in injected files but missing from .env.example: ${missing.join(', ')}`,
      file: '.env.example',
      fix: `Add entries for: ${missing.join(', ')} to .env.example`,
    };
  }

  return {
    id: 'E1-env-coverage',
    severity: 'PASS',
    rule: '.env.example covers all injected env vars',
    message: `All ${usedVars.size} referenced env vars covered in .env.example.`,
  };
}
