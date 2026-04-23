// ─── Payments Injector Tests ──────────────────────────────────────────────────
import { buildPaymentsFiles } from '../../src/injectors/payments';

describe('buildPaymentsFiles', () => {
  it('returns per-seat billing files', () => {
    const files = buildPaymentsFiles('per-seat');
    const paths = files.map(f => f.relativePath);

    expect(paths).toContain('prodify-layer/payments/stripe.ts');
    expect(paths).toContain('prodify-layer/routes/api/checkout/route.ts');
    expect(paths).toContain('prodify-layer/routes/api/webhooks/stripe/route.ts');
    expect(paths).toContain('prodify-layer/routes/api/portal/route.ts');

    const stripe = files.find(f => f.relativePath === 'prodify-layer/payments/stripe.ts')!;
    expect(stripe.content).toContain('per_unit');
    expect(stripe.content).not.toContain('metered');
  });

  it('returns flat subscription billing files', () => {
    const files = buildPaymentsFiles('flat');
    const stripe = files.find(f => f.relativePath === 'prodify-layer/payments/stripe.ts')!;

    expect(stripe.content).toContain('createFlatSubscription');
    expect(stripe.content).not.toContain('per_unit');
  });

  it('returns usage-based (metered) billing files', () => {
    const files = buildPaymentsFiles('usage');
    const stripe = files.find(f => f.relativePath === 'prodify-layer/payments/stripe.ts')!;

    expect(stripe.content).toContain('metered');
    expect(stripe.content).toContain('reportUsage');
  });

  it('always returns exactly 4 files', () => {
    expect(buildPaymentsFiles('per-seat')).toHaveLength(4);
    expect(buildPaymentsFiles('flat')).toHaveLength(4);
    expect(buildPaymentsFiles('usage')).toHaveLength(4);
  });
});
