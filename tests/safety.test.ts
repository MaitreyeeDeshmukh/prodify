// tests/safety.test.ts
// Safety net tests: verifies runInjection never writes outside prodify-layer/
// and that dry-run writes zero files to disk.
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { runInjection } from '../src/injector';
import type { ProdifyConfig, ProdifyAnswers } from '../src/types';

const baseAnswers: ProdifyAnswers = {
  setupMode: 'manual',
  appName: 'SafetyTest',
  pricingModel: 'flat',
  billingInterval: 'monthly',
  onboardingFlow: 'pay-upfront',
  userType: 'individuals',
  authMethods: ['google'],
  emailProvider: 'resend',
  deployTarget: 'none',
  complianceRegion: 'global',
  dbProvider: 'insforge',
  injectUi: false,
  stack: 'nextjs',
};

describe('runInjection safety', () => {
  let targetDir: string;

  beforeEach(() => {
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prodify-safety-'));
  });

  afterEach(() => {
    fs.removeSync(targetDir);
  });

  it('dry-run writes zero files to disk', async () => {
    const config: ProdifyConfig = {
      answers: baseAnswers,
      targetDir,
      dryRun: true,
      verbose: false,
    };
    await runInjection(config);
    // prodify-layer/ should not exist in dry-run
    const layerExists = fs.existsSync(path.join(targetDir, 'prodify-layer'));
    expect(layerExists).toBe(false);
  });

  it('all written file paths start with prodify-layer/', async () => {
    const config: ProdifyConfig = {
      answers: baseAnswers,
      targetDir,
      dryRun: false,
      verbose: false,
    };
    const result = await runInjection(config);
    for (const filePath of result.filesCreated) {
      expect(filePath.startsWith('prodify-layer/')).toBe(true);
    }
  });

  it('no file is written outside targetDir', async () => {
    const config: ProdifyConfig = {
      answers: baseAnswers,
      targetDir,
      dryRun: false,
      verbose: false,
    };
    const result = await runInjection(config);
    for (const filePath of result.filesCreated) {
      const abs = path.join(targetDir, filePath);
      expect(abs.startsWith(targetDir)).toBe(true);
    }
  });

  it('returns no errors for minimal valid config', async () => {
    const config: ProdifyConfig = {
      answers: baseAnswers,
      targetDir,
      dryRun: false,
      verbose: false,
    };
    const result = await runInjection(config);
    expect(result.errors).toHaveLength(0);
  });

  it('returns no errors for credits + enterprise + eu-gdpr + supabase combo', async () => {
    const config: ProdifyConfig = {
      answers: {
        ...baseAnswers,
        pricingModel: 'credits',
        userType: 'enterprise',
        complianceRegion: 'eu-gdpr',
        dbProvider: 'supabase',
        authMethods: ['google', 'github', 'saml'],
        deployTarget: 'vercel',
        injectUi: true,
        uiLibrary: 'shadcn',
      },
      targetDir,
      dryRun: false,
      verbose: false,
    };
    const result = await runInjection(config);
    expect(result.errors).toHaveLength(0);
  });
});
