// ─── Injector Orchestrator ────────────────────────────────────────────────────
// Collects FileEntry arrays from all sub-injectors and writes them to disk.
// In dry-run mode, logs what would be written without touching the filesystem.
import * as fs from 'fs-extra';
import * as path from 'path';
import { buildAuthFiles } from './injectors/auth';
import { buildPaymentsFiles } from './injectors/payments';
import { buildDbFiles } from './injectors/db';
import { buildEnvFile } from './injectors/env';
import { buildEmailFiles } from './injectors/email';
import { buildCiFiles } from './injectors/ci';
import { buildComplianceFiles } from './injectors/compliance';
import { buildReadmeFile } from './injectors/readme';
import { buildUiFiles } from './injectors/ui';
import { dryRun as logDryRun, verbose, success, error as logError } from './logger';
import type { FileEntry, InjectionResult, ProdifyConfig } from './types';

export async function runInjection(config: ProdifyConfig): Promise<InjectionResult> {
  const { answers, targetDir, dryRun, verbose: isVerbose } = config;
  const result: InjectionResult = { filesCreated: [], filesSkipped: [], errors: [] };

  // ── Collect all files from every injector ────────────────────────────────────
  const allFiles: FileEntry[] = [
    // Auth — composition from selected authMethods array
    ...buildAuthFiles(answers.authMethods, answers.userType),

    // Payments — all 6 pricing models + trial/annual support
    ...buildPaymentsFiles(answers.pricingModel, answers.billingInterval, answers.onboardingFlow),

    // Database — schema conditional on userType, pricingModel, onboardingFlow, dbProvider
    ...buildDbFiles(answers.userType, answers.pricingModel, answers.onboardingFlow, answers.dbProvider ?? 'insforge'),

    // Environment variables — conditional on all answers
    ...buildEnvFile(answers),

    // Transactional email — Resend client + 3 React Email templates
    ...buildEmailFiles(answers),

    // CI/CD — GitHub Actions workflow for the chosen deploy target
    ...buildCiFiles(answers.deployTarget),

    // Compliance — cookie banner / privacy policy / CCPA / terms
    ...buildComplianceFiles(answers),

    // README — activation checklist for the full injected layer
    ...buildReadmeFile(answers),

    // UI components — auth buttons, pricing page, billing portal, etc.
    ...buildUiFiles(answers),
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
