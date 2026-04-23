// ─── Injector Orchestrator ────────────────────────────────────────────────────
// Collects FileEntry arrays from all sub-injectors and writes them to disk.
// In dry-run mode, logs what would be written without touching the filesystem.
import * as fs from 'fs-extra';
import * as path from 'path';
import { buildAuthFiles } from './injectors/auth';
import { buildPaymentsFiles } from './injectors/payments';
import { buildDbFiles } from './injectors/db';
import { buildEnvFile } from './injectors/env';
import { buildReadmeFile } from './injectors/readme';
import { dryRun as logDryRun, verbose, success, error as logError } from './logger';
import type { FileEntry, InjectionResult, ProdifyConfig } from './types';

export async function runInjection(config: ProdifyConfig): Promise<InjectionResult> {
  const { answers, targetDir, dryRun, verbose: isVerbose } = config;
  const result: InjectionResult = { filesCreated: [], filesSkipped: [], errors: [] };

  // ── Collect all files from every injector ────────────────────────────────────
  const allFiles: FileEntry[] = [
    ...buildAuthFiles(answers.userType),
    ...buildPaymentsFiles(answers.pricingModel),
    ...buildDbFiles(answers.userType),
    ...buildEnvFile(answers),
    ...buildReadmeFile(answers),
  ];

  // ── Write (or dry-run log) each file ─────────────────────────────────────────
  for (const file of allFiles) {
    const absolutePath = path.join(targetDir, file.relativePath);

    if (dryRun) {
      logDryRun(`Would create: ${file.relativePath}`);
      result.filesCreated.push(file.relativePath);
      continue;
    }

    try {
      await fs.outputFile(absolutePath, file.content, 'utf-8');
      result.filesCreated.push(file.relativePath);
      if (isVerbose) {
        verbose(`Created: ${absolutePath}`);
      } else {
        success(`Created: ${file.relativePath}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`Failed to write ${file.relativePath}: ${message}`);
      result.errors.push(`${file.relativePath}: ${message}`);
    }
  }

  return result;
}
