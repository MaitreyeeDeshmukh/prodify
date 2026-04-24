// ─── Validator Tests ──────────────────────────────────────────────────────────
// Tests for the post-injection checks that run before git push.
// Uses in-memory file objects — no disk I/O required for most checks.

import {
  checkStripeEvents,
  checkNoAsAny,
  checkPortalRoutePresent,
  checkNoHardcodedUrls,
  checkWebhookIdempotency,
  checkCheckoutUrlNullHandling,
  checkNoRequire,
  checkSchemaIndexes,
  checkCheckConstraints,
  checkRlsPolicies,
  checkServiceRoleKeyUsage,
} from '../../src/validation/checks';
import type { InjectedFile } from '../../src/validation/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(relativePath: string, content: string): InjectedFile {
  return { relativePath, content, absolutePath: `/tmp/test/${relativePath}` };
}

const GOOD_WEBHOOK = makeFile('prodify-layer/routes/api/webhooks/stripe/route.ts', `
import Stripe from 'stripe';

const supabase = createSupabaseServiceClient();

await supabase.from('webhook_events').upsert(
  { stripe_event_id: event.id, type: event.type, payload: event },
  { onConflict: 'stripe_event_id' },
);

switch (event.type) {
  case 'checkout.session.completed': {
    const session = event.data.object as Stripe.Checkout.Session;
    break;
  }
  case 'invoice.payment_succeeded': {
    const invoice = event.data.object as Stripe.Invoice;
    break;
  }
  case 'invoice.payment_failed': {
    const invoice = event.data.object as Stripe.Invoice;
    break;
  }
  case 'customer.subscription.updated': {
    const sub = event.data.object as Stripe.Subscription;
    break;
  }
  case 'customer.subscription.deleted': {
    const sub = event.data.object as Stripe.Subscription;
    break;
  }
}
`);

const GOOD_CHECKOUT = makeFile('prodify-layer/routes/api/checkout/route.ts', `
const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const session = await stripe.checkout.sessions.create({ ... });
if (!session.url) return NextResponse.json({ error: 'failed' }, { status: 500 });
return NextResponse.json({ url: session.url });
`);

const GOOD_PORTAL = makeFile('prodify-layer/routes/api/billing/portal/route.ts', `
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: origin + '/dashboard',
});
return NextResponse.json({ url: portalSession.url });
`);

// ── Stripe events ─────────────────────────────────────────────────────────────

describe('checkStripeEvents', () => {
  it('PASS when all required events are handled', () => {
    const result = checkStripeEvents([GOOD_WEBHOOK]);
    expect(result.severity).toBe('PASS');
  });

  it('BLOCK when invoice.payment_failed is missing', () => {
    const bad = makeFile('prodify-layer/routes/api/webhooks/stripe/route.ts', `
      case 'checkout.session.completed': break;
      case 'invoice.payment_succeeded': break;
      case 'customer.subscription.updated': break;
      case 'customer.subscription.deleted': break;
    `);
    const result = checkStripeEvents([bad]);
    expect(result.severity).toBe('BLOCK');
    expect(result.message).toContain('invoice.payment_failed');
  });

  it('BLOCK when customer.subscription.updated is missing', () => {
    const bad = makeFile('prodify-layer/routes/api/webhooks/stripe/route.ts', `
      case 'checkout.session.completed': break;
      case 'invoice.payment_succeeded': break;
      case 'invoice.payment_failed': break;
      case 'customer.subscription.deleted': break;
    `);
    const result = checkStripeEvents([bad]);
    expect(result.severity).toBe('BLOCK');
    expect(result.message).toContain('customer.subscription.updated');
  });

  it('WARN when no webhook file found', () => {
    const result = checkStripeEvents([GOOD_CHECKOUT]);
    expect(result.severity).toBe('WARN');
  });
});

// ── as any ────────────────────────────────────────────────────────────────────

describe('checkNoAsAny', () => {
  it('PASS when no as any in files', () => {
    const file = makeFile('foo.ts', 'const x: Stripe.Invoice = event.data.object;');
    const result = checkNoAsAny([file]);
    expect(result.severity).toBe('PASS');
  });

  it('WARN when as any is found', () => {
    const file = makeFile('webhook.ts', 'const inv = event.data.object as any;');
    const result = checkNoAsAny([file]);
    expect(result.severity).toBe('WARN');
    expect(result.message).toContain('webhook.ts');
  });

  it('only checks .ts and .tsx files, not SQL or YAML', () => {
    const sql = makeFile('schema.sql', '-- as any');
    const result = checkNoAsAny([sql]);
    expect(result.severity).toBe('PASS');
  });
});

// ── Portal route ──────────────────────────────────────────────────────────────

describe('checkPortalRoutePresent', () => {
  it('PASS when portal route exists and calls billingPortal.sessions.create', () => {
    const result = checkPortalRoutePresent([GOOD_PORTAL]);
    expect(result.severity).toBe('PASS');
  });

  it('BLOCK when no portal route in files', () => {
    const result = checkPortalRoutePresent([GOOD_CHECKOUT, GOOD_WEBHOOK]);
    expect(result.severity).toBe('BLOCK');
  });

  it('BLOCK when portal file exists but does not call billingPortal.sessions.create', () => {
    const bad = makeFile('prodify-layer/routes/api/billing/portal/route.ts', `
      export async function POST() {
        return NextResponse.json({ url: 'not-a-portal' });
      }
    `);
    const result = checkPortalRoutePresent([bad]);
    expect(result.severity).toBe('BLOCK');
  });
});

// ── Hardcoded URLs ────────────────────────────────────────────────────────────

describe('checkNoHardcodedUrls', () => {
  it('PASS when URLs use process.env or request origin', () => {
    const result = checkNoHardcodedUrls([GOOD_CHECKOUT, GOOD_PORTAL]);
    expect(result.severity).toBe('PASS');
  });

  it('BLOCK when success_url has a hardcoded production domain', () => {
    const bad = makeFile('prodify-layer/routes/api/checkout/route.ts', `
      success_url: 'https://my-startup.com/dashboard?success=1',
      cancel_url: 'https://my-startup.com/pricing',
    `);
    const result = checkNoHardcodedUrls([bad]);
    expect(result.severity).toBe('BLOCK');
  });

  it('PASS when localhost is used (acceptable for fallback)', () => {
    const file = makeFile('prodify-layer/routes/api/checkout/route.ts', `
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    `);
    const result = checkNoHardcodedUrls([file]);
    expect(result.severity).toBe('PASS');
  });

  it('PASS when hardcoded URL is in a comment line', () => {
    const file = makeFile('prodify-layer/routes/api/checkout/route.ts', `
      // success_url: 'https://example.com/dashboard' — example only
      const origin = req.headers.get('origin');
    `);
    const result = checkNoHardcodedUrls([file]);
    expect(result.severity).toBe('PASS');
  });
});

// ── Webhook idempotency ───────────────────────────────────────────────────────

describe('checkWebhookIdempotency', () => {
  it('PASS when upsert comes before switch', () => {
    const result = checkWebhookIdempotency([GOOD_WEBHOOK]);
    expect(result.severity).toBe('PASS');
  });

  it('BLOCK when webhook_events upsert comes after switch', () => {
    const bad = makeFile('prodify-layer/routes/api/webhooks/stripe/route.ts', `
      switch (event.type) {
        case 'checkout.session.completed': break;
      }
      await db.from('webhook_events').upsert({ stripe_event_id: event.id });
    `);
    const result = checkWebhookIdempotency([bad]);
    expect(result.severity).toBe('BLOCK');
  });

  it('BLOCK when no webhook_events upsert at all', () => {
    const bad = makeFile('prodify-layer/routes/api/webhooks/stripe/route.ts', `
      switch (event.type) {
        case 'checkout.session.completed': break;
      }
    `);
    const result = checkWebhookIdempotency([bad]);
    expect(result.severity).toBe('BLOCK');
  });
});

// ── Checkout null URL ─────────────────────────────────────────────────────────

describe('checkCheckoutUrlNullHandling', () => {
  it('PASS when session.url null check exists', () => {
    const result = checkCheckoutUrlNullHandling([GOOD_CHECKOUT]);
    expect(result.severity).toBe('PASS');
  });

  it('WARN when no null check for session.url', () => {
    const bad = makeFile('prodify-layer/routes/api/checkout/route.ts', `
      const session = await stripe.checkout.sessions.create({});
      return NextResponse.json({ url: session.url });
    `);
    const result = checkCheckoutUrlNullHandling([bad]);
    expect(result.severity).toBe('WARN');
  });
});

// ── No require() ──────────────────────────────────────────────────────────────

describe('checkNoRequire', () => {
  it('PASS when no require() in TS files', () => {
    const file = makeFile('server.ts', 'import { createClient } from "@supabase/supabase-js";');
    const result = checkNoRequire([file]);
    expect(result.severity).toBe('PASS');
  });

  it('BLOCK when require() used in a TS file', () => {
    const bad = makeFile('server.ts', `
      export function createServiceClient() {
        const { createClient } = require('@supabase/supabase-js');
        return createClient(url, key);
      }
    `);
    const result = checkNoRequire([bad]);
    expect(result.severity).toBe('BLOCK');
    expect(result.message).toContain('server.ts');
  });

  it('does not flag require in SQL or YAML files', () => {
    const sql = makeFile('schema.sql', '-- require this migration to run first');
    const result = checkNoRequire([sql]);
    expect(result.severity).toBe('PASS');
  });
});

// ── Schema checks ─────────────────────────────────────────────────────────────

describe('checkSchemaIndexes', () => {
  const GOOD_SCHEMA = makeFile('prodify-layer/db/schema.sql', `
    CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON public.users (stripe_customer_id);
    CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);
    CREATE INDEX IF NOT EXISTS webhook_events_type_idx ON public.webhook_events (type);
  `);

  it('PASS when all required indexes are present', () => {
    const result = checkSchemaIndexes([GOOD_SCHEMA]);
    expect(result.severity).toBe('PASS');
  });

  it('WARN when an index is missing', () => {
    const bad = makeFile('prodify-layer/db/schema.sql', `
      CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON public.users (stripe_customer_id);
    `);
    const result = checkSchemaIndexes([bad]);
    expect(result.severity).toBe('WARN');
    expect(result.message).toContain('subscriptions_user_id_idx');
  });
});

describe('checkCheckConstraints', () => {
  it('PASS when both CHECK constraints present', () => {
    const schema = makeFile('prodify-layer/db/schema.sql', `
      subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
      subscription_status TEXT NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive')),
    `);
    const result = checkCheckConstraints([schema]);
    expect(result.severity).toBe('PASS');
  });

  it('WARN when subscription_tier has no CHECK constraint', () => {
    const schema = makeFile('prodify-layer/db/schema.sql', `
      subscription_tier TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL CHECK (subscription_status IN ('active')),
    `);
    const result = checkCheckConstraints([schema]);
    expect(result.severity).toBe('WARN');
  });
});

describe('checkRlsPolicies', () => {
  it('PASS when every RLS table has a policy (webhook_events exception allowed)', () => {
    // 3 RLS tables (users, subscriptions, webhook_events), 2 policies (webhook_events has none)
    const schema = makeFile('prodify-layer/db/schema.sql', `
      ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "users: own row" ON public.users FOR ALL USING (auth.uid() = id);
      ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "subscriptions: own rows" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);
      ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
    `);
    const result = checkRlsPolicies([schema]);
    expect(result.severity).toBe('PASS');
  });

  it('BLOCK when multiple tables have RLS but no policy at all', () => {
    const schema = makeFile('prodify-layer/db/schema.sql', `
      ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
    `);
    const result = checkRlsPolicies([schema]);
    expect(result.severity).toBe('BLOCK');
  });
});

// ── Service role key in client files ──────────────────────────────────────────

describe('checkServiceRoleKeyUsage', () => {
  it('PASS when service role key only in server file', () => {
    const server = makeFile('supabase/server.ts', 'process.env.SUPABASE_SERVICE_ROLE_KEY');
    const client = makeFile('supabase/client.ts', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const result = checkServiceRoleKeyUsage([server, client]);
    expect(result.severity).toBe('PASS');
  });

  it('BLOCK when service role key appears in client.ts', () => {
    const client = makeFile('supabase/client.ts', 'process.env.SUPABASE_SERVICE_ROLE_KEY');
    const result = checkServiceRoleKeyUsage([client]);
    expect(result.severity).toBe('BLOCK');
    expect(result.message).toContain('client.ts');
  });
});
