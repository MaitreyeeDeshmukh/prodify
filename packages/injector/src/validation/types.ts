// ─── Validation Types ─────────────────────────────────────────────────────────
// Every check in the post-injection validator returns a CheckResult.
// BLOCK = hard failure, push is aborted.
// WARN  = soft issue, push continues but is logged.
// PASS  = check passed.

export type CheckSeverity = 'BLOCK' | 'WARN' | 'PASS';

export interface CheckResult {
  /** Unique identifier for the rule, e.g. "P1-stripe-events" */
  id: string;
  severity: CheckSeverity;
  /** Human-readable description of what was checked */
  rule: string;
  /** What was found (or not found) */
  message: string;
  /** Which file the issue is in, if applicable */
  file?: string;
  /** Concrete fix instruction shown to the user */
  fix?: string;
}

export interface ValidationReport {
  /** False if any check returned BLOCK */
  passed: boolean;
  blocks: CheckResult[];
  warnings: CheckResult[];
  passes: CheckResult[];
  /** One-line summary, e.g. "2 BLOCK, 1 WARN, 8 PASS" */
  summary: string;
}

/** A file that was written by the injector */
export interface InjectedFile {
  relativePath: string;
  content: string;
  /** Absolute path on disk after writing to tmpDir */
  absolutePath: string;
}
