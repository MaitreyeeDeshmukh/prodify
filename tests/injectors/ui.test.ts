// tests/injectors/ui.test.ts
// Tests for the UI component injector.
import { buildUiFiles } from '../../src/injectors/ui';
import type { ProdifyAnswers } from '../../src/types';

const base: ProdifyAnswers = {
  setupMode: 'manual',
  appName: 'TestApp',
  pricingModel: 'flat',
  billingInterval: 'monthly',
  onboardingFlow: 'trial-no-card',
  userType: 'individuals',
  authMethods: ['google', 'github'],
  emailProvider: 'resend',
  deployTarget: 'vercel',
  complianceRegion: 'global',
  dbProvider: 'insforge',
  injectUi: true,
  uiLibrary: 'plain',
  stack: 'nextjs',
};

describe('buildUiFiles', () => {
  it('returns empty array when injectUi is false', () => {
    const files = buildUiFiles({ ...base, injectUi: false });
    expect(files).toHaveLength(0);
  });

  it('generates sign-in-button with only selected auth methods', () => {
    const files = buildUiFiles({ ...base, authMethods: ['google'] });
    const btn = files.find(f => f.relativePath.includes('sign-in-button'));
    expect(btn).toBeDefined();
    expect(btn!.content).toContain("signIn('google'");
    expect(btn!.content).not.toContain("signIn('github'");
  });

  it('generates sign-in-button for github when only github selected', () => {
    const files = buildUiFiles({ ...base, authMethods: ['github'] });
    const btn = files.find(f => f.relativePath.includes('sign-in-button'));
    expect(btn!.content).toContain("signIn('github'");
    expect(btn!.content).not.toContain("signIn('google'");
  });

  it('does NOT generate credit-balance when pricingModel is not credits', () => {
    const files = buildUiFiles({ ...base, pricingModel: 'flat' });
    const credit = files.find(f => f.relativePath.includes('credit-balance'));
    expect(credit).toBeUndefined();
  });

  it('generates credit-balance when pricingModel is credits', () => {
    const files = buildUiFiles({ ...base, pricingModel: 'credits' });
    const credit = files.find(f => f.relativePath.includes('credit-balance'));
    expect(credit).toBeDefined();
    expect(credit!.content).toContain('/api/credits/balance');
  });

  it('does NOT generate usage-meter when onboardingFlow is not freemium', () => {
    const files = buildUiFiles({ ...base, onboardingFlow: 'trial-no-card' });
    const meter = files.find(f => f.relativePath.includes('usage-meter'));
    expect(meter).toBeUndefined();
  });

  it('generates usage-meter when onboardingFlow is freemium', () => {
    const files = buildUiFiles({ ...base, onboardingFlow: 'freemium' });
    const meter = files.find(f => f.relativePath.includes('usage-meter'));
    expect(meter).toBeDefined();
    expect(meter!.content).toContain('/api/usage');
  });

  it('generates shadcn variant when uiLibrary is shadcn', () => {
    const files = buildUiFiles({ ...base, uiLibrary: 'shadcn' });
    const btn = files.find(f => f.relativePath.includes('sign-in-button'));
    expect(btn!.content).toContain('@/components/ui/button');
  });

  it('generates plain variant when uiLibrary is plain', () => {
    const files = buildUiFiles({ ...base, uiLibrary: 'plain' });
    const btn = files.find(f => f.relativePath.includes('sign-in-button'));
    expect(btn!.content).not.toContain('@/components/ui/button');
  });

  it('always generates billing-portal-button when injectUi is true', () => {
    const files = buildUiFiles(base);
    const portal = files.find(f => f.relativePath.includes('billing-portal-button'));
    expect(portal).toBeDefined();
    expect(portal!.content).toContain('/api/portal');
  });

  it('always generates pricing-page when injectUi is true', () => {
    const files = buildUiFiles(base);
    const page = files.find(f => f.relativePath.includes('pricing-page'));
    expect(page).toBeDefined();
  });

  it('all file paths start with prodify-layer/', () => {
    const files = buildUiFiles(base);
    for (const f of files) {
      expect(f.relativePath.startsWith('prodify-layer/')).toBe(true);
    }
  });
});
