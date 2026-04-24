// ─── Post-Injection Validator ─────────────────────────────────────────────────
// Runs after all files are written to tmpDir, before `git add && git commit`.
// Any BLOCK result aborts the push and sends an error event to the client.
// WARN results are logged but do not block.
//
// Usage:
//   const report = await runValidation(tmpDir, injectedFiles, 'supabase');
//   if (!report.passed) throw new Error(report.summary);

import path from 'path';
import type { CheckResult, InjectedFile, ValidationReport } from './types';
import {
  checkMiddlewarePlacement,
  checkProtectedPathsExist,
  checkNoRequire,
  checkStripeEvents,
  checkNoAsAny,
  checkPortalRoutePresent,
  checkNoHardcodedUrls,
  checkWebhookIdempotency,
  checkCheckoutUrlNullHandling,
  checkSchemaIndexes,
  checkCheckConstraints,
  checkRlsPolicies,
  checkServiceRoleKeyUsage,
  checkCiPackageManager,
  checkCiTestCommand,
  checkPackageJsonDeps,
  checkEnvVarCoverage,
} from './checks';

export type { ValidationReport, CheckResult, InjectedFile };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classify(results: CheckResult[]): ValidationReport {
  const blocks = results.filter(r => r.severity === 'BLOCK');
  const warnings = results.filter(r => r.severity === 'WARN');
  const passes = results.filter(r => r.severity === 'PASS');

  return {
    passed: blocks.length === 0,
    blocks,
    warnings,
    passes,
    summary: `${blocks.length} BLOCK, ${warnings.length} WARN, ${passes.length} PASS`,
  };
}

/** Convert file entries from the injector into InjectedFile records (with absolutePath). */
export function toInjectedFiles(
  files: Array<{ relativePath: string; content: string }>,
  tmpDir: string,
): InjectedFile[] {
  return files.map(f => ({
    relativePath: f.relativePath,
    content: f.content,
    absolutePath: path.join(tmpDir, f.relativePath),
  }));
}

// ─── Main Validator ───────────────────────────────────────────────────────────

/**
 * Run all post-injection checks.
 * @param tmpDir     Absolute path to the cloned + modified repo directory
 * @param files      All files written by the injector
 * @param backend    Which backend was injected ('supabase' | 'insforge')
 * @param paymentsInjected  Whether payment files were included in this injection
 */
export async function runValidation(
  tmpDir: string,
  files: InjectedFile[],
  backend: 'supabase' | 'insforge',
  paymentsInjected: boolean = true,
): Promise<ValidationReport> {
  const results: CheckResult[] = [];

  // ── Auth checks ────────────────────────────────────────────────────────────
  results.push(checkMiddlewarePlacement(tmpDir));
  results.push(checkProtectedPathsExist(tmpDir, files));
  results.push(checkNoRequire(files));

  // ── Payments checks (only if payments were injected) ───────────────────────
  if (paymentsInjected) {
    results.push(checkStripeEvents(files));
    results.push(checkNoAsAny(files));
    results.push(checkPortalRoutePresent(files));
    results.push(checkNoHardcodedUrls(files));
    results.push(checkWebhookIdempotency(files));
    results.push(checkCheckoutUrlNullHandling(files));
  }

  // ── Database checks ────────────────────────────────────────────────────────
  const hasSchemaFile = files.some(f => f.relativePath.endsWith('.sql'));
  if (hasSchemaFile) {
    results.push(checkSchemaIndexes(files));
    results.push(checkCheckConstraints(files));
    results.push(checkRlsPolicies(files));
  }
  results.push(checkServiceRoleKeyUsage(files));

  // ── CI checks ──────────────────────────────────────────────────────────────
  const hasCiFile = files.some(f => f.relativePath.includes('.github/workflows'));
  if (hasCiFile) {
    results.push(checkCiPackageManager(tmpDir, files));
    results.push(checkCiTestCommand(tmpDir, files));
  }

  // ── Dependency checks ──────────────────────────────────────────────────────
  results.push(checkPackageJsonDeps(tmpDir, files, backend));

  // ── Env var checks ─────────────────────────────────────────────────────────
  results.push(checkEnvVarCoverage(tmpDir, files));

  return classify(results);
}

/**
 * Format a validation report as a human-readable string for commit messages and logs.
 */
export function formatReport(report: ValidationReport): string {
  const lines: string[] = [`Validation: ${report.summary}`];

  if (report.blocks.length > 0) {
    lines.push('\n🚨 BLOCKING ISSUES:');
    for (const b of report.blocks) {
      lines.push(`  [${b.id}] ${b.message}`);
      if (b.fix) lines.push(`    Fix: ${b.fix}`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push('\n⚠️  WARNINGS:');
    for (const w of report.warnings) {
      lines.push(`  [${w.id}] ${w.message}`);
    }
  }

  return lines.join('\n');
}
