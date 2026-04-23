// ─── Payments Injector Tests ──────────────────────────────────────────────────
import { buildPaymentsFiles } from '../../src/injectors/payments';

describe('buildPaymentsFiles', () => {
  it('returns correctly structured payment files', () => {
    const files = buildPaymentsFiles('per-seat');
    const paths = files.map(f => f.relativePath);

    expect(paths).toContain('prodify-layer/payments/gateway.ts');
    expect(paths).toContain('prodify-layer/routes/api/webhooks/stripe/route.ts');
    expect(paths).toContain('prodify-layer/components/PremiumPricing.tsx');

    const gateway = files.find(f => f.relativePath === 'prodify-layer/payments/gateway.ts')!;
    expect(gateway.content).toContain('Stripe');
    expect(gateway.content).toContain('insforge');

    const pricing = files.find(f => f.relativePath === 'prodify-layer/components/PremiumPricing.tsx')!;
    expect(pricing.content).toContain('PremiumPricing');
    expect(pricing.content).toContain('motion');
  });

  it('always returns exactly 3 files', () => {
    expect(buildPaymentsFiles('per-seat')).toHaveLength(3);
    expect(buildPaymentsFiles('flat')).toHaveLength(3);
    expect(buildPaymentsFiles('usage')).toHaveLength(3);
  });
});
