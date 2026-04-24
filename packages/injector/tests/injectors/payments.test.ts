// ─── Payments Injector Tests ──────────────────────────────────────────────────
import { buildPaymentsFiles } from '../../src/injectors/payments';

describe('buildPaymentsFiles', () => {
  it('returns correctly structured payment files', () => {
    const files = buildPaymentsFiles('per-seat');
    const paths = files.map(f => f.relativePath);

    expect(paths).toContain('prodify-layer/payments/stripe.ts');
    expect(paths).toContain('prodify-layer/routes/api/checkout/route.ts');
    expect(paths).toContain('prodify-layer/routes/api/webhooks/stripe/route.ts');
    expect(paths).toContain('prodify-layer/routes/api/billing/portal/route.ts');

    const stripe = files.find(f => f.relativePath === 'prodify-layer/payments/stripe.ts')!;
    expect(stripe.content).toContain('Stripe');
    expect(stripe.content).toContain('stripe.checkout.sessions.create');
  });

  it('always returns exactly 4 files', () => {
    expect(buildPaymentsFiles('per-seat')).toHaveLength(4);
    expect(buildPaymentsFiles('flat')).toHaveLength(4);
    expect(buildPaymentsFiles('usage')).toHaveLength(4);
  });
});
