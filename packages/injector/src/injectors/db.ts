import type { FileEntry, UserType } from '../types';

const AUTH_TABLES_SQL = `-- prodify-layer/db/migrations/001_auth_tables.sql
-- InsForge compatible auth wrapper schema
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: In InsForge, you manage accounts/sessions via the auth.* schema natively, 
-- but we keep a public.users profile table for app-level data.
`;

const SUBSCRIPTION_SQL = `-- prodify-layer/db/migrations/002_subscription.sql
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
`;

const PAYMENTS_SQL = `-- prodify-layer/db/migrations/003_payments.sql
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const RLS_SQL = `-- prodify-layer/db/rls.sql
-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile" 
  ON public.users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view their own subscriptions" 
  ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Only service role can access webhook_events, idempotency_keys, audit logs directly
`;

export function buildDbFiles(userType: UserType): FileEntry[] {
  // Regardless of user type, we setup the core billing/auth schema first.
  // We can expand for 'teams' or 'enterprise' later.
  return [
    { relativePath: 'prodify-layer/db/migrations/001_auth_tables.sql', content: AUTH_TABLES_SQL },
    { relativePath: 'prodify-layer/db/migrations/002_subscription.sql', content: SUBSCRIPTION_SQL },
    { relativePath: 'prodify-layer/db/migrations/003_payments.sql', content: PAYMENTS_SQL },
    { relativePath: 'prodify-layer/db/rls.sql', content: RLS_SQL },
  ];
}
