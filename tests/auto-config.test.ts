// tests/auto-config.test.ts
// Tests for the auto-config recommendation engine across 5 fixture project types.
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { buildAutoRecommendation } from '../src/auto-config';

async function makeFixture(files: Record<string, string>): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prodify-test-'));
  for (const [filename, content] of Object.entries(files)) {
    fs.outputFileSync(path.join(dir, filename), content);
  }
  return dir;
}

describe('buildAutoRecommendation', () => {
  afterEach(() => jest.clearAllMocks());

  it('Fixture 1: detects Supabase from env keys', async () => {
    const dir = await makeFixture({
      'package.json': JSON.stringify({ dependencies: { 'next': '14.0.0', '@supabase/supabase-js': '2.0.0' } }),
      '.env': 'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=abc',
    });
    const rec = await buildAutoRecommendation(dir, 'TestApp', 'nextjs');
    expect(rec.answers.dbProvider).toBe('supabase');
    expect(rec.reasoning.dbProvider).toMatch(/supabase/i);
    fs.removeSync(dir);
  });

  it('Fixture 2: detects Google auth from next-auth + GOOGLE env keys', async () => {
    const dir = await makeFixture({
      'package.json': JSON.stringify({ dependencies: { 'next-auth': '4.0.0' } }),
      '.env': 'GOOGLE_CLIENT_ID=gid\nGOOGLE_CLIENT_SECRET=gsecret\nNEXTAUTH_SECRET=abc',
    });
    const rec = await buildAutoRecommendation(dir, 'TestApp', 'nextjs');
    expect(rec.answers.authMethods).toContain('google');
    fs.removeSync(dir);
  });

  it('Fixture 3: detects Vercel from vercel.json', async () => {
    const dir = await makeFixture({
      'package.json': JSON.stringify({ dependencies: {} }),
      'vercel.json': JSON.stringify({ framework: 'nextjs' }),
    });
    const rec = await buildAutoRecommendation(dir, 'TestApp', 'nextjs');
    expect(rec.answers.deployTarget).toBe('vercel');
    fs.removeSync(dir);
  });

  it('Fixture 4: detects shadcn from Radix UI deps', async () => {
    const dir = await makeFixture({
      'package.json': JSON.stringify({
        dependencies: { '@radix-ui/react-slot': '1.0.0', 'class-variance-authority': '0.7.0' },
      }),
    });
    const rec = await buildAutoRecommendation(dir, 'TestApp', 'nextjs');
    expect(rec.answers.uiLibrary).toBe('shadcn');
    fs.removeSync(dir);
  });

  it('Fixture 5: blank project returns safe defaults', async () => {
    const dir = await makeFixture({
      'package.json': JSON.stringify({ dependencies: {} }),
    });
    const rec = await buildAutoRecommendation(dir, 'BlankApp', 'nextjs');
    expect(rec.answers.pricingModel).toBe('flat');
    expect(rec.answers.dbProvider).toBe('insforge');
    expect(rec.answers.authMethods.length).toBeGreaterThan(0);
    expect(rec.answers.deployTarget).toBe('vercel');
    fs.removeSync(dir);
  });
});
