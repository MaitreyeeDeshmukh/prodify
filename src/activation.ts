// ─── Activation Wizard ────────────────────────────────────────────────────────
// Prints a colour-coded, conditional checklist of every step the developer
// must complete after injection before their app actually works.
// Never auto-opens files — always asks or respects --open-env flag.
import * as path from 'path';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import type { ProdifyAnswers, InjectionResult } from './types';

// ── Chalk colours (inline — avoids import issues in CJS/ESM edge cases) ──────
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const CYAN   = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const BLUE   = '\x1b[34m';

function h(s: string) { return `${BOLD}${CYAN}${s}${RESET}`; }
function key(s: string) { return `${YELLOW}${s}${RESET}`; }
function url(s: string) { return `${DIM}${s}${RESET}`; }
function ok(s: string)  { return `${GREEN}${s}${RESET}`; }
function dim(s: string) { return `${DIM}${s}${RESET}`; }
function step(n: number, label: string) {
  return `\n  ${BOLD}STEP ${n}${RESET}  ${label}\n  ${DIM}${'─'.repeat(48)}${RESET}`;
}

// ── VS Code open helper ───────────────────────────────────────────────────────
function tryOpenVSCode(filePath: string): boolean {
  try {
    execSync(`code "${filePath}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export async function printActivationWizard(
  answers: ProdifyAnswers,
  result: InjectionResult,
  openEnvFlag: boolean,
): Promise<void> {
  const {
    appName,
    pricingModel,
    billingInterval,
    onboardingFlow,
    authMethods,
    dbProvider,
    deployTarget,
    complianceRegion,
    injectUi,
  } = answers;

  const envFile = 'prodify-layer/.env.example';
  const stepCount = [
    true,                                            // 1 copy env
    true,                                            // 2 fill keys
    true,                                            // 3 run schema
    true,                                            // 4 mount routes
    true,                                            // 5 stripe webhook
    complianceRegion === 'eu-gdpr',                  // 6 GDPR banner
    deployTarget !== 'none',                         // 7 CI secrets
    injectUi,                                        // 8 UI components
  ].filter(Boolean).length;

  console.log('');
  console.log(h(`${'─'.repeat(56)}`));
  console.log(h(`  🔑  ACTIVATION CHECKLIST — ${stepCount} steps to go live`));
  console.log(h(`${'─'.repeat(56)}`));

  let n = 0;

  // STEP 1 — Copy env file
  n++;
  console.log(step(n, 'Copy the env template'));
  console.log(`  ${ok('$')} cp ${envFile} .env.local`);
  console.log(`  ${dim('Never commit .env.local to git — it contains live secrets.')}`);

  // STEP 2 — Fill in API keys
  n++;
  console.log(step(n, 'Fill in your API keys'));

  if (dbProvider === 'insforge') {
    console.log(`\n  ${BOLD}[DATABASE — InsForge]${RESET}`);
    console.log(`  ${key('INSFORGE_URL')}          → ${url('insforge.app → your project → Settings → API URL')}`);
    console.log(`  ${key('INSFORGE_ANON_KEY')}     → ${url('same page → Anon Key')}`);
  } else {
    console.log(`\n  ${BOLD}[DATABASE — Supabase]${RESET}`);
    console.log(`  ${key('NEXT_PUBLIC_SUPABASE_URL')}         → ${url('supabase.com → project → Settings → API')}`);
    console.log(`  ${key('NEXT_PUBLIC_SUPABASE_ANON_KEY')}   → ${url('same page → anon key')}`);
    console.log(`  ${key('SUPABASE_SERVICE_ROLE_KEY')}        → ${url('same page — server-only, never expose to browser!')}`);
  }

  console.log(`\n  ${BOLD}[PAYMENTS — Stripe]${RESET}`);
  console.log(`  ${key('STRIPE_SECRET_KEY')}       → ${url('dashboard.stripe.com → Developers → API keys')}`);
  console.log(`  ${key('STRIPE_WEBHOOK_SECRET')}   → ${url('Stripe → Webhooks → signing secret (after step 5)')}`);
  if (pricingModel === 'credits') {
    console.log(`  ${key('STRIPE_CREDITS_STARTER_PRICE_ID')} → ${url('Stripe → Products → add one-time price (100 credits)')}`);
    console.log(`  ${key('STRIPE_CREDITS_GROWTH_PRICE_ID')}  → ${url('Stripe → Products → add one-time price (500 credits)')}`);
    console.log(`  ${key('STRIPE_CREDITS_SCALE_PRICE_ID')}   → ${url('Stripe → Products → add one-time price (2000 credits)')}`);
  } else if (pricingModel === 'one-time') {
    console.log(`  ${key('STRIPE_ONE_TIME_PRICE_ID')}  → ${url('Stripe → Products → add one-time price')}`);
  } else if (pricingModel === 'hybrid') {
    console.log(`  ${key('STRIPE_MONTHLY_PRICE_ID')}   → ${url('Stripe → Products → recurring monthly base price')}`);
    console.log(`  ${key('STRIPE_OVERAGE_PRICE_ID')}   → ${url('Stripe → Products → metered overage price')}`);
  } else if (billingInterval === 'annual') {
    console.log(`  ${key('STRIPE_MONTHLY_PRICE_ID')}  → ${url('Stripe → Products → recurring monthly price')}`);
    console.log(`  ${key('STRIPE_ANNUAL_PRICE_ID')}   → ${url('Stripe → same product → recurring annual price')}`);
  } else {
    console.log(`  ${key('STRIPE_MONTHLY_PRICE_ID')}  → ${url('Stripe → Products → add price → Recurring monthly')}`);
  }
  if (onboardingFlow === 'trial-card' || onboardingFlow === 'trial-no-card') {
    console.log(`  ${key('STRIPE_FREE_TRIAL_DAYS')}   → ${dim('e.g. 14')}`);
  }

  console.log(`\n  ${BOLD}[AUTH — NextAuth.js]${RESET}`);
  console.log(`  ${key('NEXTAUTH_SECRET')}   → ${url('run: openssl rand -base64 32')}`);
  console.log(`  ${key('NEXTAUTH_URL')}      → ${dim('http://localhost:3000 for dev, your deployed URL in prod')}`);
  if (authMethods.includes('google')) {
    console.log(`  ${key('GOOGLE_CLIENT_ID')}      → ${url('console.cloud.google.com → Credentials → OAuth 2.0')}`);
    console.log(`  ${key('GOOGLE_CLIENT_SECRET')}  → ${url('same page')}`);
  }
  if (authMethods.includes('github')) {
    console.log(`  ${key('GITHUB_CLIENT_ID')}      → ${url('github.com → Settings → Developer settings → OAuth Apps')}`);
    console.log(`  ${key('GITHUB_CLIENT_SECRET')}  → ${url('same page')}`);
  }
  if (authMethods.includes('magic-link') || authMethods.includes('email-pass')) {
    console.log(`\n  ${BOLD}[EMAIL — Resend]${RESET}`);
    console.log(`  ${key('RESEND_API_KEY')}  → ${url('resend.com → API Keys → Create API key')}`);
    console.log(`  ${key('FROM_EMAIL')}      → ${dim('e.g. noreply@yourdomain.com')}`);
  }

  // STEP 3 — Run schema
  n++;
  console.log(step(n, 'Run the database schema'));
  if (dbProvider === 'supabase') {
    console.log(`  Paste ${BOLD}prodify-layer/db/schema.sql${RESET} into:`);
    console.log(`  ${url('supabase.com → your project → SQL Editor → paste → Run')}`);
  } else {
    console.log(`  Paste ${BOLD}prodify-layer/db/schema.sql${RESET} into:`);
    console.log(`  ${url('insforge.app → your project → SQL Editor → paste → Run')}`);
  }

  // STEP 4 — Mount routes
  n++;
  console.log(step(n, 'Mount the API routes'));
  console.log(`  ${ok('$')} cp -r prodify-layer/routes/api/* app/api/`);
  console.log(`  ${dim('Or manually move the route files into your Next.js app/api/ directory.')}`);

  // STEP 5 — Stripe webhook
  n++;
  console.log(step(n, 'Register the Stripe webhook'));
  console.log(`  In Stripe → Webhooks → Add endpoint:`);
  console.log(`  URL: ${BOLD}https://yourdomain.com/api/webhooks/stripe${RESET}`);
  console.log(`  Events to listen for:`);
  console.log(`  ${dim('  checkout.session.completed')}`);
  console.log(`  ${dim('  customer.subscription.updated')}`);
  console.log(`  ${dim('  customer.subscription.deleted')}`);
  console.log(`  ${dim('  invoice.payment_failed')}`);
  console.log(`  ${dim('Then paste the signing secret into STRIPE_WEBHOOK_SECRET.')}`);

  // STEP 6 — GDPR (conditional)
  if (complianceRegion === 'eu-gdpr') {
    n++;
    console.log(step(n, 'Mount the GDPR cookie banner'));
    console.log(`  Add to your root ${BOLD}app/layout.tsx${RESET}:`);
    console.log(`  ${dim("import CookieBanner from '../prodify-layer/compliance/cookie-banner';")}`);
    console.log(`  ${dim('<CookieBanner />')}`);
  }

  // STEP 7 — CI secrets (conditional)
  if (deployTarget !== 'none') {
    n++;
    console.log(step(n, `Add GitHub Actions secrets (${deployTarget})`));
    if (deployTarget === 'vercel') {
      console.log(`  ${url('github.com → repo → Settings → Secrets → Actions → New secret')}`);
      console.log(`  ${key('VERCEL_TOKEN')}       → vercel.com → Settings → Tokens`);
      console.log(`  ${key('VERCEL_ORG_ID')}      → run: vercel link → check .vercel/project.json`);
      console.log(`  ${key('VERCEL_PROJECT_ID')}  → same`);
    } else if (deployTarget === 'railway') {
      console.log(`  ${key('RAILWAY_TOKEN')}  → railway.app → Project → Settings → Tokens`);
    } else if (deployTarget === 'fly') {
      console.log(`  ${key('FLY_API_TOKEN')}  → fly.io → Account → Access Tokens → Create`);
    } else if (deployTarget === 'aws') {
      console.log(`  ${key('AWS_ACCESS_KEY_ID')} / ${key('AWS_SECRET_ACCESS_KEY')} → IAM console`);
      console.log(`  ${key('AWS_REGION')}  → e.g. us-east-1`);
    }
  }

  // STEP 8 — UI components (conditional)
  if (injectUi) {
    n++;
    console.log(step(n, 'Mount injected UI components'));
    console.log(`  Auth button (in your sign-in page):`);
    console.log(`  ${dim("import { SignInButton } from '../prodify-layer/ui/auth/sign-in-button';")}`);
    console.log(`  Billing portal (in your dashboard):`);
    console.log(`  ${dim("import { BillingPortalButton } from '../prodify-layer/ui/pricing/billing-portal-button';")}`);
    console.log(`  Pricing page (standalone page):`);
    console.log(`  ${dim("import PricingPage from '../prodify-layer/ui/pricing/pricing-page';")}`);
  }

  // Footer
  console.log('');
  console.log(h(`${'─'.repeat(56)}`));
  console.log(`  ${BOLD}📄  Full guide:${RESET} prodify-layer/README-prodify.md`);
  console.log(`  ${BOLD}Next step:${RESET} open ${BOLD}${envFile}${RESET} in your editor and fill in`);
  console.log(`  the values listed in Step 2 above.`);
  console.log('');
  console.log(`  If you use VS Code, run:`);
  console.log(`  ${ok('$')} code ${envFile}`);
  console.log(h(`${'─'.repeat(56)}`));
  console.log('');

  // ── Optional VS Code open ──────────────────────────────────────────────────
  if (openEnvFlag) {
    // --open-env flag was passed: try silently, warn on failure
    const opened = tryOpenVSCode(envFile);
    if (!opened) {
      console.log(`  ${RED}⚠${RESET}  VS Code CLI (${BOLD}code${RESET}) not found.`);
      console.log(`  Open the file manually: ${BOLD}${envFile}${RESET}\n`);
    }
    return;
  }

  // Interactive prompt
  const { openNow } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'openNow',
      message: `Open ${envFile} in VS Code now?`,
      default: false,
    },
  ]) as { openNow: boolean };

  if (openNow) {
    const opened = tryOpenVSCode(envFile);
    if (!opened) {
      console.log(`\n  ${RED}⚠${RESET}  VS Code CLI (${BOLD}code${RESET}) not found or not on PATH.`);
      console.log(`  Open the file manually: ${BOLD}${envFile}${RESET}\n`);
    }
  }
}
