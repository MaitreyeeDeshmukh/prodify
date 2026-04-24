// ─── Auto-Config Engine ───────────────────────────────────────────────────────
// Scans the target project's files and infers the best ProdifyAnswers values.
// Called when the user picks "Automatic" setup mode.
import * as fs from 'fs-extra';
import * as path from 'path';
import type {
  ProdifyAnswers,
  PricingModel,
  BillingInterval,
  OnboardingFlow,
  UserType,
  AuthMethod,
  DeployTarget,
  ComplianceRegion,
  DbProvider,
  UILibrary,
  StackType,
} from './types';

export interface AutoRecommendation {
  answers: ProdifyAnswers;
  /** Human-readable reason for each key recommendation */
  reasoning: Partial<Record<keyof ProdifyAnswers, string>>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJsonSafe(filePath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readEnvKeys(dir: string): Set<string> {
  const envKeys = new Set<string>();
  const envFiles = ['.env', '.env.local', '.env.example', '.env.development'];
  for (const f of envFiles) {
    const fp = path.join(dir, f);
    if (!fileExists(fp)) continue;
    const lines = fs.readFileSync(fp, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
      if (match) envKeys.add(match[1]!);
    }
  }
  return envKeys;
}

function getDeps(pkg: Record<string, unknown>): Set<string> {
  const deps = new Set<string>();
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const block = pkg[key];
    if (block && typeof block === 'object') {
      for (const dep of Object.keys(block as object)) deps.add(dep);
    }
  }
  return deps;
}

// ── Scanner ───────────────────────────────────────────────────────────────────

export async function buildAutoRecommendation(
  targetDir: string,
  appName: string,
  detectedStack: StackType,
): Promise<AutoRecommendation> {
  const pkg = readJsonSafe(path.join(targetDir, 'package.json'));
  const deps = getDeps(pkg);
  const envKeys = readEnvKeys(targetDir);
  const reasoning: Partial<Record<keyof ProdifyAnswers, string>> = {};

  // ── Pricing model ──────────────────────────────────────────────────────────
  let pricingModel: PricingModel = 'flat';
  if (deps.has('stripe') && (envKeys.has('STRIPE_CREDITS_STARTER_PRICE_ID') || deps.has('ai'))) {
    pricingModel = 'credits';
    reasoning.pricingModel = 'detected AI/credits pattern (ai dep or credit price IDs in env)';
  } else if (envKeys.has('STRIPE_OVERAGE_PRICE_ID')) {
    pricingModel = 'hybrid';
    reasoning.pricingModel = 'detected STRIPE_OVERAGE_PRICE_ID in env → hybrid model';
  } else {
    reasoning.pricingModel = 'no special signals → safe default: flat subscription';
  }

  // ── Billing interval ──────────────────────────────────────────────────────
  let billingInterval: BillingInterval = 'monthly';
  if (envKeys.has('STRIPE_ANNUAL_PRICE_ID')) {
    billingInterval = 'annual';
    reasoning.billingInterval = 'detected STRIPE_ANNUAL_PRICE_ID in env';
  } else {
    reasoning.billingInterval = 'no annual price ID detected → monthly only';
  }

  // ── Onboarding flow ───────────────────────────────────────────────────────
  let onboardingFlow: OnboardingFlow = 'trial-no-card';
  if (envKeys.has('STRIPE_FREE_TRIAL_DAYS')) {
    onboardingFlow = 'trial-card';
    reasoning.onboardingFlow = 'detected STRIPE_FREE_TRIAL_DAYS in env → trial-card';
  } else {
    reasoning.onboardingFlow = 'no trial signals → 14-day no-card trial (industry standard, best conversion)';
  }

  const trialDays = 14;

  // ── User type ─────────────────────────────────────────────────────────────
  let userType: UserType = 'individuals';
  if (deps.has('@boxyhq/saml-jackson') || envKeys.has('SAML_CLIENT_ID')) {
    userType = 'enterprise';
    reasoning.userType = 'detected SAML/BoxyHQ dependency or env keys';
  } else if (deps.has('@clerk/nextjs') || deps.has('next-auth') && envKeys.has('NEXTAUTH_SECRET')) {
    userType = 'individuals';
    reasoning.userType = 'detected individual-focused auth stack';
  }

  // ── Auth methods ──────────────────────────────────────────────────────────
  const authMethods: AuthMethod[] = [];
  if (envKeys.has('GOOGLE_CLIENT_ID') || deps.has('next-auth')) {
    authMethods.push('google');
    reasoning.authMethods = 'detected GOOGLE_CLIENT_ID or next-auth';
  }
  if (envKeys.has('GITHUB_CLIENT_ID')) {
    authMethods.push('github');
  }
  if (envKeys.has('RESEND_API_KEY') && deps.has('next-auth')) {
    authMethods.push('magic-link');
  }
  if (userType === 'enterprise') authMethods.push('saml');
  if (authMethods.length === 0) {
    authMethods.push('google', 'github');
    reasoning.authMethods = 'no auth signals → Google + GitHub (recommended defaults)';
  }

  // ── BaaS / DB provider ────────────────────────────────────────────────────
  let dbProvider: DbProvider = 'insforge';
  if (
    deps.has('@supabase/supabase-js') ||
    envKeys.has('NEXT_PUBLIC_SUPABASE_URL') ||
    envKeys.has('SUPABASE_SERVICE_ROLE_KEY')
  ) {
    dbProvider = 'supabase';
    reasoning.dbProvider = 'detected Supabase SDK or env keys';
  } else if (deps.has('@insforge/sdk') || envKeys.has('INSFORGE_URL')) {
    dbProvider = 'insforge';
    reasoning.dbProvider = 'detected InsForge SDK or env keys';
  } else {
    reasoning.dbProvider = 'no DB signals → InsForge recommended for new projects';
  }

  // ── Deploy target ─────────────────────────────────────────────────────────
  let deployTarget: DeployTarget = 'vercel';
  if (fileExists(path.join(targetDir, 'vercel.json')) || deps.has('vercel')) {
    deployTarget = 'vercel';
    reasoning.deployTarget = 'detected vercel.json or vercel dep';
  } else if (fileExists(path.join(targetDir, 'fly.toml'))) {
    deployTarget = 'fly';
    reasoning.deployTarget = 'detected fly.toml';
  } else if (fileExists(path.join(targetDir, 'railway.toml'))) {
    deployTarget = 'railway';
    reasoning.deployTarget = 'detected railway.toml';
  } else if (envKeys.has('AWS_ACCESS_KEY_ID')) {
    deployTarget = 'aws';
    reasoning.deployTarget = 'detected AWS env keys';
  } else {
    reasoning.deployTarget = 'no deploy signals → Vercel (best Next.js default)';
  }

  // ── Compliance region ─────────────────────────────────────────────────────
  let complianceRegion: ComplianceRegion = 'global';
  if (envKeys.has('NEXT_PUBLIC_COOKIE_CONSENT_ENABLED')) {
    complianceRegion = 'eu-gdpr';
    reasoning.complianceRegion = 'detected COOKIE_CONSENT env key';
  } else {
    reasoning.complianceRegion = 'no compliance signals → global (basic terms only)';
  }

  // ── UI injection ──────────────────────────────────────────────────────────
  let injectUi = true;
  let uiLibrary: UILibrary = 'plain';
  if (deps.has('@radix-ui/react-slot') || deps.has('class-variance-authority') || deps.has('shadcn')) {
    uiLibrary = 'shadcn';
    reasoning.uiLibrary = 'detected shadcn/ui dependencies';
  } else if (deps.has('@radix-ui/react-dialog')) {
    uiLibrary = 'shadcn';
    reasoning.uiLibrary = 'detected Radix UI → shadcn recommended';
  } else {
    reasoning.uiLibrary = 'no UI framework detected → plain JSX (zero dependencies)';
  }
  reasoning.injectUi = 'auto mode always injects UI; user can remove components they do not need';

  const answers: ProdifyAnswers = {
    setupMode: 'auto',
    appName,
    pricingModel,
    billingInterval,
    onboardingFlow,
    trialDays,
    userType,
    authMethods,
    emailProvider: 'resend',
    deployTarget,
    complianceRegion,
    dbProvider,
    injectUi,
    uiLibrary,
    stack: detectedStack,
  };

  return { answers, reasoning };
}
