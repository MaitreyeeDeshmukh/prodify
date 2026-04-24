// ─── Stack Detection ──────────────────────────────────────────────────────────
export type StackType = 'nextjs' | 'express' | 'fastapi' | 'rails' | 'unknown';

export interface DetectedStack {
  type: StackType;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
}

// ─── User Answers ─────────────────────────────────────────────────────────────

/** How you charge customers */
export type PricingModel =
  | 'flat'       // Single monthly/annual subscription
  | 'per-seat'   // Charge per user/team member
  | 'usage'      // Metered billing per API call / event
  | 'hybrid'     // Flat base subscription + usage overages on top (e.g. Vercel)
  | 'one-time'   // Single payment (lifetime deal, template, course)
  | 'credits';   // Pre-purchased credit pool, DB ledger, decrement on use

/** Monthly vs annual billing cycle (not applicable for one-time or credits) */
export type BillingInterval = 'monthly' | 'annual';

/** How new users enter your product */
export type OnboardingFlow =
  | 'pay-upfront'    // Pay before using anything
  | 'trial-card'     // Free trial, card required upfront
  | 'trial-no-card'  // Free trial, no card required
  | 'freemium';      // Free tier with permanent limits, paid upgrades

/** Who your users are (values unchanged for serialization compatibility) */
export type UserType = 'individuals' | 'teams' | 'enterprise';

/** Auth methods — can be a combination */
export type AuthMethod =
  | 'google'      // Google OAuth
  | 'github'      // GitHub OAuth
  | 'magic-link'  // Passwordless email OTP / magic link via Resend
  | 'email-pass'  // Email + password via NextAuth Credentials
  | 'saml';       // Enterprise SAML/SSO (BoxyHQ)

/** Transactional email provider */
export type EmailProvider = 'resend' | 'none';

/** Deployment platform for CI/CD file injection */
export type DeployTarget = 'vercel' | 'railway' | 'fly' | 'aws' | 'none';

/** Compliance / data handling region */
export type ComplianceRegion = 'global' | 'eu-gdpr' | 'us';

export interface ProdifyAnswers {
  // ── Identity ───────────────────────────────────────────────────────────────
  appName: string;

  // ── Pricing & billing ──────────────────────────────────────────────────────
  pricingModel: PricingModel;
  billingInterval: BillingInterval;    // ignored for 'one-time' and 'credits'
  onboardingFlow: OnboardingFlow;
  trialDays?: number;                  // set when onboardingFlow is trial-*
  freeLimit?: string;                  // set when onboardingFlow is freemium (e.g. "5 projects/month")

  // ── Users & auth ───────────────────────────────────────────────────────────
  userType: UserType;
  authMethods: AuthMethod[];

  // ── Infrastructure ─────────────────────────────────────────────────────────
  emailProvider: EmailProvider;
  deployTarget: DeployTarget;
  complianceRegion: ComplianceRegion;

  // ── Stack ──────────────────────────────────────────────────────────────────
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
