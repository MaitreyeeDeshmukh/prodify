// tests/injectors/db.test.ts (extended)
// Tests for the DB injector including BaaS provider branching.
import { buildDbFiles } from '../../src/injectors/db';

describe('buildDbFiles', () => {
  it('generates insforge.ts client for InsForge provider', () => {
    const files = buildDbFiles('individuals', 'flat', 'pay-upfront', 'insforge');
    const client = files.find(f => f.relativePath.includes('insforge.ts'));
    expect(client).toBeDefined();
    expect(client!.content).toContain('@insforge/sdk');
    expect(client!.content).toContain('INSFORGE_URL');
  });

  it('generates supabase.ts client for Supabase provider', () => {
    const files = buildDbFiles('individuals', 'flat', 'pay-upfront', 'supabase');
    const client = files.find(f => f.relativePath.includes('supabase.ts'));
    expect(client).toBeDefined();
    expect(client!.content).toContain('@supabase/supabase-js');
    expect(client!.content).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('does NOT generate insforge.ts for Supabase provider', () => {
    const files = buildDbFiles('individuals', 'flat', 'pay-upfront', 'supabase');
    const insforgeFile = files.find(f => f.relativePath.includes('insforge.ts'));
    expect(insforgeFile).toBeUndefined();
  });

  it('schema comment says Supabase SQL Editor for Supabase provider', () => {
    const files = buildDbFiles('individuals', 'flat', 'pay-upfront', 'supabase');
    const schema = files.find(f => f.relativePath.includes('schema.sql'));
    expect(schema!.content).toContain('Supabase');
  });

  it('schema comment says InsForge SQL editor for InsForge provider', () => {
    const files = buildDbFiles('individuals', 'flat', 'pay-upfront', 'insforge');
    const schema = files.find(f => f.relativePath.includes('schema.sql'));
    expect(schema!.content).toContain('InsForge');
  });

  it('generates credit_ledger table when pricingModel is credits', () => {
    const files = buildDbFiles('individuals', 'credits', 'pay-upfront', 'insforge');
    const schema = files.find(f => f.relativePath.includes('schema.sql'));
    expect(schema!.content).toContain('credit_ledger');
    expect(schema!.content).toContain('credits_remaining');
  });

  it('does NOT generate credit_ledger for non-credits model', () => {
    const files = buildDbFiles('individuals', 'flat', 'pay-upfront', 'insforge');
    const schema = files.find(f => f.relativePath.includes('schema.sql'));
    expect(schema!.content).not.toContain('credit_ledger');
  });

  it('generates free_usage table when onboardingFlow is freemium', () => {
    const files = buildDbFiles('individuals', 'flat', 'freemium', 'insforge');
    const schema = files.find(f => f.relativePath.includes('schema.sql'));
    expect(schema!.content).toContain('free_usage');
  });

  it('generates memberships table for teams userType', () => {
    const files = buildDbFiles('teams', 'flat', 'pay-upfront', 'insforge');
    const schema = files.find(f => f.relativePath.includes('schema.sql'));
    expect(schema!.content).toContain('memberships');
    expect(schema!.content).toContain('organizations');
  });

  it('generates saml_config on organizations for enterprise userType', () => {
    const files = buildDbFiles('enterprise', 'flat', 'pay-upfront', 'insforge');
    const schema = files.find(f => f.relativePath.includes('schema.sql'));
    expect(schema!.content).toContain('saml_config');
  });

  it('defaults to insforge when dbProvider is not passed', () => {
    const files = buildDbFiles('individuals', 'flat', 'pay-upfront');
    const client = files.find(f => f.relativePath.includes('insforge.ts'));
    expect(client).toBeDefined();
  });
});
