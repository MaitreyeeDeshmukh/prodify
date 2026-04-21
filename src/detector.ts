// ─── Stack Detector ───────────────────────────────────────────────────────────
// Inspects package.json, config files, and requirement files to identify the
// project's framework. Returns high/medium/low confidence alongside stack type.
import * as fs from 'fs-extra';
import * as path from 'path';
import type { DetectedStack } from './types';

export async function detectStack(cwd: string): Promise<DetectedStack> {
  // ── 1. Check package.json (covers Next.js, Express, Rails) ──────────────────
  const pkgPath = path.join(cwd, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath) as Record<string, unknown>;
    const deps: Record<string, string> = {
      ...(pkg['dependencies'] as Record<string, string> ?? {}),
      ...(pkg['devDependencies'] as Record<string, string> ?? {}),
    };

    if (deps['next']) {
      return { type: 'nextjs', version: deps['next'], confidence: 'high' };
    }
    if (deps['express']) {
      return { type: 'express', version: deps['express'], confidence: 'high' };
    }
    if (deps['rails'] || deps['actionpack']) {
      return { type: 'rails', confidence: 'high' };
    }
  }

  // ── 2. Check requirements.txt (Python/FastAPI) ───────────────────────────────
  const requirementsPath = path.join(cwd, 'requirements.txt');
  if (await fs.pathExists(requirementsPath)) {
    const content = (await fs.readFile(requirementsPath, 'utf-8')) as string;
    if (content.toLowerCase().includes('fastapi')) {
      return { type: 'fastapi', confidence: 'high' };
    }
  }

  // ── 3. Check pyproject.toml (Python/FastAPI fallback) ────────────────────────
  const pyprojectPath = path.join(cwd, 'pyproject.toml');
  if (await fs.pathExists(pyprojectPath)) {
    const content = (await fs.readFile(pyprojectPath, 'utf-8')) as string;
    if (content.toLowerCase().includes('fastapi')) {
      return { type: 'fastapi', confidence: 'medium' };
    }
  }

  // ── 4. Check for next.config.js / next.config.ts (Next.js fallback) ─────────
  const hasNextConfig =
    (await fs.pathExists(path.join(cwd, 'next.config.js'))) ||
    (await fs.pathExists(path.join(cwd, 'next.config.ts')));
  if (hasNextConfig) {
    return { type: 'nextjs', confidence: 'medium' };
  }

  return { type: 'unknown', confidence: 'low' };
}
