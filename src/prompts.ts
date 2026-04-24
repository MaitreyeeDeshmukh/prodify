// ─── Interactive Prompts ──────────────────────────────────────────────────────
// Runs the full Inquirer flow and returns a typed ProdifyAnswers object.
// Questions are grouped into logical sections with progressive disclosure.
import inquirer from 'inquirer';
import type {
  DetectedStack,
  ProdifyAnswers,
  StackType,
  PricingModel,
  BillingInterval,
  OnboardingFlow,
  AuthMethod,
  DeployTarget,
  ComplianceRegion,
} from './types';

export async function runPrompts(detected: DetectedStack): Promise<ProdifyAnswers> {
  const stackIsKnown = detected.type !== 'unknown';

  // ── Section 1: Identity ──────────────────────────────────────────────────────
  const { appName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'appName',
      message: 'What is your app called?',
      default: 'My SaaS App',
      validate: (v: string) => v.trim().length > 0 || 'App name is required',
    },
  ]);

  // ── Section 2: Pricing model ─────────────────────────────────────────────────
  const { pricingModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'pricingModel',
      message: 'How do you charge customers?',
      choices: [
        {
          name: '(1) Monthly/annual subscription  — one flat price (e.g. $19/month)',
          value: 'flat',
        },
        {
          name: '(2) Per seat                     — charge per team member (e.g. $12/user/month)',
          value: 'per-seat',
        },
        {
          name: '(3) Usage-based                  — charge per API call, event, or unit',
          value: 'usage',
        },
        {
          name: '(4) Flat + overages (hybrid)     — base subscription + charges when you go over (e.g. Vercel)',
          value: 'hybrid',
        },
        {
          name: '(5) One-time payment             — lifetime deal, template, course, or tool',
          value: 'one-time',
        },
        {
          name: '(6) Credits / token pool         — users buy credits upfront, spend on AI calls or actions',
          value: 'credits',
        },
      ],
    },
  ]) as { pricingModel: PricingModel };

  // ── Section 3: Billing interval (skip for one-time / credits) ────────────────
  let billingInterval: BillingInterval = 'monthly';
  if (pricingModel !== 'one-time' && pricingModel !== 'credits') {
    const ans = await inquirer.prompt([
      {
        type: 'list',
        name: 'billingInterval',
        message: 'Will you offer annual billing?',
        choices: [
          {
            name: '(1) Monthly only  — single price ID, no annual option',
            value: 'monthly',
          },
          {
            name: '(2) Monthly + Annual  — two price IDs (you create both in Stripe dashboard); annual typically discounted 15–20%',
            value: 'annual',
          },
        ],
      },
    ]) as { billingInterval: BillingInterval };
    billingInterval = ans.billingInterval;
  }

  // ── Section 4: Onboarding / trial flow ──────────────────────────────────────
  const { onboardingFlow } = await inquirer.prompt([
    {
      type: 'list',
      name: 'onboardingFlow',
      message: 'How do users start using your app?',
      choices: [
        {
          name: '(1) Pay upfront              — users must pay before getting access',
          value: 'pay-upfront',
        },
        {
          name: '(2) Free trial (card)        — N-day free trial, card required at signup',
          value: 'trial-card',
        },
        {
          name: '(3) Free trial (no card)     — N-day free trial, no card required (higher signups, lower conversion)',
          value: 'trial-no-card',
        },
        {
          name: '(4) Free plan with limits    — freemium: always free up to a limit, pay to unlock more',
          value: 'freemium',
        },
      ],
    },
  ]) as { onboardingFlow: OnboardingFlow };

  // ── Section 5: Trial days (conditional) ─────────────────────────────────────
  let trialDays: number | undefined;
  if (onboardingFlow === 'trial-card' || onboardingFlow === 'trial-no-card') {
    const ans = await inquirer.prompt([
      {
        type: 'number',
        name: 'trialDays',
        message: 'How many days is the free trial?',
        default: 14,
        validate: (v: number) => (v > 0 && v <= 365) || 'Enter a number between 1 and 365',
      },
    ]) as { trialDays: number };
    trialDays = ans.trialDays;
  }

  // ── Section 6: Free limit description (conditional) ─────────────────────────
  let freeLimit: string | undefined;
  if (onboardingFlow === 'freemium') {
    const ans = await inquirer.prompt([
      {
        type: 'input',
        name: 'freeLimit',
        message: 'Describe the free tier limit (shown in UI and README):',
        default: '3 projects, 100 API calls/month',
      },
    ]) as { freeLimit: string };
    freeLimit = ans.freeLimit;
  }

  // ── Section 7: User type (plain-English labels, same values) ─────────────────
  const { userType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'userType',
      message: 'Who are your users?',
      choices: [
        {
          name: '(1) Single users             — one account per person, no teams or orgs',
          value: 'individuals',
        },
        {
          name: '(2) Companies / teams        — multiple people share one account with roles',
          value: 'teams',
        },
        {
          name: '(3) Large companies (SSO)    — enterprise: SSO/SAML, admin controls, audit logs',
          value: 'enterprise',
        },
      ],
    },
  ]);

  // ── Section 8: Auth methods ──────────────────────────────────────────────────
  const authChoices = [
    { name: 'Google OAuth  (recommended for consumer apps)', value: 'google' },
    { name: 'GitHub OAuth  (recommended for developer tools)', value: 'github' },
    { name: 'Magic link / email OTP  (passwordless — higher conversion)', value: 'magic-link' },
    { name: 'Email + password  (classic credentials)', value: 'email-pass' },
    ...(userType === 'enterprise'
      ? [{ name: 'SAML / SSO  (Okta, Azure AD, Google Workspace)', value: 'saml' }]
      : []),
  ];
  const { authMethods } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'authMethods',
      message: 'Which login methods will you support? (Space to select, Enter to confirm)',
      choices: authChoices,
      default: ['google', 'github'],
      validate: (v: string[]) => v.length > 0 || 'Select at least one auth method',
    },
  ]) as { authMethods: AuthMethod[] };

  // ── Section 9: Deploy target ─────────────────────────────────────────────────
  const { deployTarget } = await inquirer.prompt([
    {
      type: 'list',
      name: 'deployTarget',
      message: 'Where will you deploy? (affects the injected GitHub Actions CI file)',
      choices: [
        { name: '(1) Vercel    — Next.js native, preview deploys per PR', value: 'vercel' },
        { name: '(2) Railway   — Docker-based, Postgres included', value: 'railway' },
        { name: '(3) Fly.io   — global edge, persistent VMs', value: 'fly' },
        { name: '(4) AWS      — Lightsail or App Runner', value: 'aws' },
        { name: '(5) None / other  — inject a build-only CI check', value: 'none' },
      ],
    },
  ]) as { deployTarget: DeployTarget };

  // ── Section 10: Compliance region ───────────────────────────────────────────
  const { complianceRegion } = await inquirer.prompt([
    {
      type: 'list',
      name: 'complianceRegion',
      message: 'Where are your users? (affects cookie banners and data handling)',
      choices: [
        { name: '(1) Global      — basic terms template only', value: 'global' },
        { name: '(2) EU / GDPR   — cookie consent banner + privacy policy template', value: 'eu-gdpr' },
        { name: '(3) US          — CCPA notice template', value: 'us' },
      ],
    },
  ]) as { complianceRegion: ComplianceRegion };

  // ── Section 11: Stack confirmation ──────────────────────────────────────────
  let stack: StackType;
  if (!stackIsKnown) {
    const { manualStack } = await inquirer.prompt([
      {
        type: 'list',
        name: 'manualStack',
        message: 'What stack are you on? (could not auto-detect)',
        choices: [
          { name: 'Next.js', value: 'nextjs' },
          { name: 'Express', value: 'express' },
          { name: 'FastAPI', value: 'fastapi' },
          { name: 'Rails', value: 'rails' },
        ],
      },
    ]) as { manualStack: StackType };
    stack = manualStack;
  } else {
    const { confirmStack } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmStack',
        message: `Stack auto-detected: ${detected.type}${detected.version ? ` ${detected.version}` : ''} — confirm?`,
        default: true,
      },
    ]) as { confirmStack: boolean };

    if (!confirmStack) {
      const { manualStack } = await inquirer.prompt([
        {
          type: 'list',
          name: 'manualStack',
          message: 'Which stack are you on?',
          choices: [
            { name: 'Next.js', value: 'nextjs' },
            { name: 'Express', value: 'express' },
            { name: 'FastAPI', value: 'fastapi' },
            { name: 'Rails', value: 'rails' },
          ],
        },
      ]) as { manualStack: StackType };
      stack = manualStack;
    } else {
      stack = detected.type;
    }
  }

  return {
    appName,
    pricingModel,
    billingInterval,
    onboardingFlow,
    trialDays,
    freeLimit,
    userType,
    authMethods,
    emailProvider: 'resend',     // Resend is always injected; removed as a question
    deployTarget,
    complianceRegion,
    stack,
  };
}
