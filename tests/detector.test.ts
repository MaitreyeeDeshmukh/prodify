// ─── Stack Detector Tests ─────────────────────────────────────────────────────
jest.mock('fs-extra');

import * as fsExtra from 'fs-extra';
import { detectStack } from '../src/detector';

const fsMock = fsExtra as jest.Mocked<typeof fsExtra>;

describe('detectStack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects Next.js from package.json dependencies', async () => {
    fsMock.pathExists.mockResolvedValueOnce(true as never); // package.json
    fsMock.readJson.mockResolvedValueOnce({
      dependencies: { next: '^14.2.0', react: '^18.0.0' },
    } as never);

    const result = await detectStack('/fake/nextjs-project');

    expect(result.type).toBe('nextjs');
    expect(result.confidence).toBe('high');
    expect(result.version).toBe('^14.2.0');
  });

  it('detects Express from package.json dependencies', async () => {
    fsMock.pathExists.mockResolvedValueOnce(true as never);
    fsMock.readJson.mockResolvedValueOnce({
      dependencies: { express: '^4.18.2' },
    } as never);

    const result = await detectStack('/fake/express-project');

    expect(result.type).toBe('express');
    expect(result.confidence).toBe('high');
    expect(result.version).toBe('^4.18.2');
  });

  it('detects FastAPI from requirements.txt', async () => {
    fsMock.pathExists
      .mockResolvedValueOnce(false as never)  // no package.json
      .mockResolvedValueOnce(true as never);  // requirements.txt exists
    fsMock.readFile.mockResolvedValueOnce('fastapi==0.109.0\nuvicorn' as never);

    const result = await detectStack('/fake/fastapi-project');

    expect(result.type).toBe('fastapi');
    expect(result.confidence).toBe('high');
  });

  it('detects Next.js from next.config.js when no package.json', async () => {
    fsMock.pathExists
      .mockResolvedValueOnce(false as never)  // no package.json
      .mockResolvedValueOnce(false as never)  // no requirements.txt
      .mockResolvedValueOnce(false as never)  // no pyproject.toml
      .mockResolvedValueOnce(true as never);  // next.config.js exists

    const result = await detectStack('/fake/next-config-project');

    expect(result.type).toBe('nextjs');
    expect(result.confidence).toBe('medium');
  });

  it('returns unknown when nothing is recognized', async () => {
    fsMock.pathExists.mockResolvedValue(false as never);

    const result = await detectStack('/fake/unknown-project');

    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe('low');
  });
});
