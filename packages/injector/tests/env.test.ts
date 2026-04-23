// ─── ENV + README Injector Tests ──────────────────────────────────────────────
import { buildEnvFile } from '../../src/injectors/env';
import { buildReadmeFile } from '../../src/injectors/readme';
import type { ProdifyAnswers } from '../../src/types';

const baseAnswers: ProdifyAnswers = {
  pricingModel: 'flat',
  userType: 'individuals',
  stack: 'nextjs',
};

describe('buildEnvFile', () => {
  it('returns a single .env.example FileEntry', () => {
    const files = buildEnvFile(baseAnswers);
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('.env.example');
  });

  it('always includes DATABASE_URL and NEXTAUTH vars', () => {
    const { content } = buildEnvFile(baseAnswers)[0];
    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('NEXTAUTH_SECRET');
    expect(content).toContain('NEXTAUTH_URL');
  });

  it('includes Stripe keys', () => {
    const { content } = buildEnvFile(baseAnswers)[0];
    expect(content).toContain('STRIPE_SECRET_KEY');
    expect(content).toContain('STRIPE_WEBHOOK_SECRET');
  });

  it('includes SAML vars for enterprise', () => {
    const { content } = buildEnvFile({ ...baseAnswers, userType: 'enterprise' })[0];
    expect(content).toContain('SAML_AUTHORIZATION_URL');
  });

  it('does NOT include SAML vars for individuals', () => {
    const { content } = buildEnvFile(baseAnswers)[0];
    expect(content).not.toContain('SAML_AUTHORIZATION_URL');
  });
});

describe('buildReadmeFile', () => {
  it('returns a single README-prodify.md FileEntry', () => {
    const files = buildReadmeFile(baseAnswers);
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('prodify-layer/README-prodify.md');
  });

  it('mentions the stack and pricing model', () => {
    const { content } = buildReadmeFile(baseAnswers)[0];
    expect(content).toContain('nextjs');
    expect(content).toContain('flat');
  });
});
