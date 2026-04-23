// ─── Stack Detection ──────────────────────────────────────────────────────────
export type StackType = 'nextjs' | 'express' | 'fastapi' | 'rails' | 'unknown';

export interface DetectedStack {
  type: StackType;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
}

// ─── User Answers ─────────────────────────────────────────────────────────────
export type PricingModel = 'per-seat' | 'flat' | 'usage';
export type UserType = 'individuals' | 'teams' | 'enterprise';

export interface ProdifyAnswers {
  pricingModel: PricingModel;
  userType: UserType;
  stack: StackType;
}

// ─── Runtime Config ───────────────────────────────────────────────────────────
export interface ProdifyConfig {
  answers: ProdifyAnswers;
  targetDir: string;
  dryRun: boolean;
  verbose: boolean;
}

// ─── File Injection ───────────────────────────────────────────────────────────
export interface FileEntry {
  /** Relative path from targetDir (e.g. "prodify-layer/auth/[...nextauth].ts") */
  relativePath: string;
  content: string;
}

export interface InjectionResult {
  filesCreated: string[];
  filesSkipped: string[];
  errors: string[];
}
