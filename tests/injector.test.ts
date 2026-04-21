// ─── Injector Orchestrator Tests ──────────────────────────────────────────────
jest.mock('fs-extra');
jest.mock('../src/logger');

import * as fsExtra from 'fs-extra';
import { runInjection } from '../src/injector';
import type { ProdifyConfig } from '../src/types';

const fsMock = fsExtra as jest.Mocked<typeof fsExtra>;

const baseConfig: ProdifyConfig = {
  answers: { pricingModel: 'flat', userType: 'individuals', stack: 'nextjs' },
  targetDir: '/fake/project',
  dryRun: false,
  verbose: false,
};

describe('runInjection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fsMock.outputFile.mockResolvedValue(undefined as never);
  });

  it('writes files when dryRun is false', async () => {
    const result = await runInjection(baseConfig);

    expect(fsMock.outputFile).toHaveBeenCalled();
    expect(result.errors).toHaveLength(0);
    expect(result.filesCreated.length).toBeGreaterThan(0);
  });

  it('does NOT write files when dryRun is true', async () => {
    const result = await runInjection({ ...baseConfig, dryRun: true });

    expect(fsMock.outputFile).not.toHaveBeenCalled();
    expect(result.filesCreated.length).toBeGreaterThan(0); // still reports what would be created
  });

  it('captures errors and continues writing remaining files', async () => {
    fsMock.outputFile
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error('EACCES: permission denied') as never)
      .mockResolvedValue(undefined as never);

    const result = await runInjection(baseConfig);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.filesCreated.length).toBeGreaterThan(0);
  });

  it('includes all expected file categories in result', async () => {
    const result = await runInjection(baseConfig);

    const allPaths = result.filesCreated.join('\n');
    expect(allPaths).toContain('auth');
    expect(allPaths).toContain('payments');
    expect(allPaths).toContain('db');
    expect(allPaths).toContain('.env.example');
  });
});
