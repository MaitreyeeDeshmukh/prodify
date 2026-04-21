// ─── Prompts Tests ────────────────────────────────────────────────────────────
jest.mock('inquirer');

import inquirer from 'inquirer';
import { runPrompts } from '../src/prompts';
import type { DetectedStack } from '../src/types';

const inquirerMock = inquirer as jest.Mocked<typeof inquirer>;

const nextjsStack: DetectedStack = { type: 'nextjs', version: '^14.0.0', confidence: 'high' };
const unknownStack: DetectedStack = { type: 'unknown', confidence: 'low' };

describe('runPrompts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns per-seat + teams + nextjs when user confirms detected stack', async () => {
    (inquirerMock.prompt as unknown as jest.Mock).mockResolvedValueOnce({
      pricingModel: 'per-seat',
      userType: 'teams',
      confirmStack: true,
    });

    const result = await runPrompts(nextjsStack);

    expect(result.pricingModel).toBe('per-seat');
    expect(result.userType).toBe('teams');
    expect(result.stack).toBe('nextjs');
  });

  it('prompts for manual selection when user rejects detected stack', async () => {
    (inquirerMock.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({
        pricingModel: 'flat',
        userType: 'teams',
        confirmStack: false,
      })
      .mockResolvedValueOnce({ manualStack: 'express' });

    const result = await runPrompts(nextjsStack);

    expect(result.stack).toBe('express');
    expect(result.pricingModel).toBe('flat');
    expect(result.userType).toBe('teams');
  });

  it('prompts for manual stack selection when stack is unknown', async () => {
    (inquirerMock.prompt as unknown as jest.Mock).mockResolvedValueOnce({
      pricingModel: 'usage',
      userType: 'enterprise',
      manualStack: 'express',
    });

    const result = await runPrompts(unknownStack);

    expect(result.stack).toBe('express');
    expect(result.pricingModel).toBe('usage');
    expect(result.userType).toBe('enterprise');
  });
});
