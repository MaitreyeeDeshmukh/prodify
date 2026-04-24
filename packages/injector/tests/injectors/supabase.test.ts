// ─── Supabase Injector Tests ──────────────────────────────────────────────────
// Asserts that files injected into user repos are correct before they ever get pushed.
// These are the quality gates that prevent broken PRs.

import {
  buildSupabaseAuthFiles,
  buildSupabaseDbFiles,
  buildSupabasePaymentsFiles,
  supabaseWebhookRoute,
  supabaseCheckoutRoute,
  supabasePortalRoute,
} from '../../src/injectors/supabase';

// ── Auth files ────────────────────────────────────────────────────────────────

describe('buildSupabaseAuthFiles', () => {
  const REQUIRED_FILES = [
    'prodify-layer/supabase/server.ts',
    'prodify-layer/supabase/client.ts',
    'prodify-layer/routes/api/auth/callback/route.ts',
    'prodify-layer/routes/api/auth/signout/route.ts',
  ];

  it('returns all required auth files', () => {
    const files = buildSupabaseAuthFiles('individuals');
    const paths = files.map(f => f.relativePath);
    for (const required of REQUIRED_FILES) {
      expect(paths).toContain(required);
    }
  });

  it('server.ts uses ESM import for createClient, not require()', () => {
    const files = buildSupabaseAuthFiles('individuals');
    const server = files.find(f => f.relativePath === 'prodify-layer/supabase/server.ts')!;
    expect(server.content).not.toContain("require('@supabase/supabase-js')");
    expect(server.content).not.toContain('require("@supabase/supabase-js")');
    expect(server.content).toMatch(/^import\s+\{\s*createClient\s*\}/m);
  });

  it('server.ts createSupabaseServiceClient does not use require()', () => {
    const files = buildSupabaseAuthFiles('individuals');
    const server = files.find(f => f.relativePath === 'prodify-layer/supabase/server.ts')!;
    // Must not have any require() call at all
    expect(server.content).not.toMatch(/\brequire\s*\(/);
  });

  it('server.ts does not expose SUPABASE_SERVICE_ROLE_KEY as NEXT_PUBLIC_', () => {
    const files = buildSupabaseAuthFiles('individuals');
    const server = files.find(f => f.relativePath === 'prodify-layer/supabase/server.ts')!;
    expect(server.content).not.toContain('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
    expect(server.content).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('middleware source contains PROTECTED_PATHS as an array', () => {
    const files = buildSupabaseAuthFiles('individuals', ['/dashboard', '/account']);
    const middleware = files.find(f => f.relativePath.includes('middleware'))!;
    expect(middleware.content).toContain('PROTECTED_PATHS');
    expect(middleware.content).toContain('/dashboard');
    expect(middleware.content).toContain('/account');
  });

  it('middleware uses detected protected paths, not hardcoded ones from other projects', () => {
    const customPaths = ['/app', '/workspace', '/reports'];
    const files = buildSupabaseAuthFiles('individuals', customPaths);
    const middleware = files.find(f => f.relativePath.includes('middleware'))!;
    for (const p of customPaths) {
      expect(middleware.content).toContain(p);
    }
    // Should NOT contain paths from the old hardcoded list that don't match
    expect(middleware.content).not.toContain("'/analyze'"); // was hardcoded in old version
    expect(middleware.content).not.toContain("'/recommendations'");
  });

  it('callback route handles exchangeCodeForSession errors', () => {
    const files = buildSupabaseAuthFiles('individuals');
    const callback = files.find(f => f.relativePath.includes('callback'))!;
    expect(callback.content).toContain('error');
    expect(callback.content).toContain('auth_callback_failed');
  });

  it('signout route uses process.env.NEXT_PUBLIC_APP_URL, not hardcoded URL', () => {
    const files = buildSupabaseAuthFiles('individuals');
    const signout = files.find(f => f.relativePath.includes('signout'))!;
    expect(signout.content).toContain('NEXT_PUBLIC_APP_URL');
    expect(signout.content).not.toMatch(/https?:\/\/(?!localhost)/);
  });

  it('no TypeScript as any casts in any auth file', () => {
    const files = buildSupabaseAuthFiles('individuals');
    for (const file of files) {
      expect(file.content).not.toMatch(/\bas\s+any\b/);
    }
  });
});

// ── Database files ─────────────────────────────────────────────────────────────

describe('buildSupabaseDbFiles', () => {
  it('generates a schema.sql file', () => {
    const files = buildSupabaseDbFiles('individuals');
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('prodify-layer/db/schema.sql');
  });

  it('schema has indexes on stripe_customer_id and user_id', () => {
    const { content } = buildSupabaseDbFiles('individuals')[0];
    expect(content).toContain('users_stripe_customer_id_idx');
    expect(content).toContain('subscriptions_user_id_idx');
  });

  it('schema has CHECK constraints on subscription_tier and subscription_status', () => {
    const { content } = buildSupabaseDbFiles('individuals')[0];
    expect(content).toMatch(/subscription_tier\s+TEXT[^;]+CHECK/s);
    expect(content).toMatch(/subscription_status\s+TEXT[^;]+CHECK/s);
  });

  it('schema has updated_at columns and auto-update trigger', () => {
    const { content } = buildSupabaseDbFiles('individuals')[0];
    expect(content).toContain('updated_at');
    expect(content).toContain('set_updated_at');
    expect(content).toContain('CREATE TRIGGER');
  });

  it('schema has RLS enabled on users table', () => {
    const { content } = buildSupabaseDbFiles('individuals')[0];
    expect(content).toContain('ENABLE ROW LEVEL SECURITY');
    expect(content).toContain('CREATE POLICY');
  });

  it('webhook_events has no public SELECT policy (service-role only)', () => {
    const { content } = buildSupabaseDbFiles('individuals')[0];
    // Should enable RLS on webhook_events but not add a public policy
    expect(content).toContain('webhook_events');
    expect(content).toContain('ENABLE ROW LEVEL SECURITY');
    // The only policy for webhook_events should NOT be a user-facing one
    expect(content).not.toMatch(/CREATE POLICY.*webhook_events.*FOR SELECT/);
  });

  it('teams schema adds organizations and memberships tables', () => {
    const { content } = buildSupabaseDbFiles('teams')[0];
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.organizations');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.memberships');
    expect(content).toMatch(/role\s+TEXT[^;]+CHECK.*owner.*admin.*member/s);
  });

  it('enterprise schema adds saml_config column to organizations', () => {
    const { content } = buildSupabaseDbFiles('enterprise')[0];
    expect(content).toContain('saml_config JSONB');
  });

  it('individuals schema does not include org/membership tables', () => {
    const { content } = buildSupabaseDbFiles('individuals')[0];
    expect(content).not.toContain('organizations');
    expect(content).not.toContain('memberships');
  });
});

// ── Payments files ─────────────────────────────────────────────────────────────

describe('buildSupabasePaymentsFiles', () => {
  const REQUIRED_FILES = [
    'prodify-layer/routes/api/checkout/route.ts',
    'prodify-layer/routes/api/webhooks/stripe/route.ts',
    'prodify-layer/routes/api/billing/portal/route.ts',
  ];

  it('returns all required payment files including portal', () => {
    const files = buildSupabasePaymentsFiles();
    const paths = files.map(f => f.relativePath);
    for (const required of REQUIRED_FILES) {
      expect(paths).toContain(required);
    }
  });

  it('webhook handles all 5 required Stripe lifecycle events', () => {
    const REQUIRED_EVENTS = [
      'checkout.session.completed',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ];
    for (const event of REQUIRED_EVENTS) {
      expect(supabaseWebhookRoute).toContain(`'${event}'`);
    }
  });

  it('webhook idempotency upsert comes BEFORE the switch statement', () => {
    const upsertPos = supabaseWebhookRoute.indexOf('webhook_events');
    const switchPos = supabaseWebhookRoute.indexOf('switch (event.type)');
    expect(upsertPos).toBeGreaterThan(0);
    expect(switchPos).toBeGreaterThan(0);
    expect(upsertPos).toBeLessThan(switchPos);
  });

  it('webhook returns 500 if idempotency upsert fails (so Stripe retries)', () => {
    expect(supabaseWebhookRoute).toContain('status: 500');
    expect(supabaseWebhookRoute).toContain('Event storage failed');
  });

  it('webhook uses proper Stripe SDK types, not as any', () => {
    expect(supabaseWebhookRoute).not.toMatch(/\bas\s+any\b/);
    expect(supabaseWebhookRoute).toContain('Stripe.Checkout.Session');
    expect(supabaseWebhookRoute).toContain('Stripe.Invoice');
    expect(supabaseWebhookRoute).toContain('Stripe.Subscription');
  });

  it('webhook has error handler wrapping the switch (Stripe retries on crash)', () => {
    expect(supabaseWebhookRoute).toContain('try {');
    expect(supabaseWebhookRoute).toContain('Handler error');
  });

  it('checkout route does not have hardcoded success/cancel URL', () => {
    expect(supabaseCheckoutRoute).not.toMatch(/['"`]https?:\/\/(?!localhost)[a-z0-9-]+/i);
    expect(supabaseCheckoutRoute).toContain('req.headers.get(\'origin\')');
  });

  it('checkout route creates Stripe customer only if one does not already exist', () => {
    expect(supabaseCheckoutRoute).toContain('stripe_customer_id');
    expect(supabaseCheckoutRoute).toContain('if (!customerId)');
    expect(supabaseCheckoutRoute).toContain('stripe.customers.create');
  });

  it('checkout route allows promotion codes', () => {
    expect(supabaseCheckoutRoute).toContain('allow_promotion_codes: true');
  });

  it('checkout route handles null session.url', () => {
    expect(supabaseCheckoutRoute).toContain('!session.url');
  });

  it('portal route calls billingPortal.sessions.create', () => {
    expect(supabasePortalRoute).toContain('billingPortal.sessions.create');
  });

  it('portal route returns 400 if user has no Stripe customer (not subscribed)', () => {
    expect(supabasePortalRoute).toContain('No billing account found');
    expect(supabasePortalRoute).toContain('status: 400');
  });

  it('portal route uses dynamic origin, not hardcoded URL', () => {
    expect(supabasePortalRoute).toContain('req.headers.get(\'origin\')');
    expect(supabasePortalRoute).not.toMatch(/['"`]https?:\/\/(?!localhost)[a-z0-9-]+/i);
  });

  it('all payment files use Stripe API version 2025-03-31.basil', () => {
    const files = buildSupabasePaymentsFiles();
    const stripeFiles = files.filter(f => f.content.includes('new Stripe('));
    for (const file of stripeFiles) {
      expect(file.content).toContain('2025-03-31.basil');
      expect(file.content).not.toContain('2024-04-10');
    }
  });
});
