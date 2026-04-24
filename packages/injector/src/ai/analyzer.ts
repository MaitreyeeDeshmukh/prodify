import fs from 'fs-extra';
import path from 'path';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

const MODEL_ID = process.env.AWS_BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

export interface InjectionOpportunity {
  layer: 'auth' | 'payments' | 'database' | 'ci' | 'env';
  canInject: boolean;
  currentState: string;
  proposed: string;
  filesToCreate: string[];
  effort: 'low' | 'medium' | 'high';
  // Extended detail fields
  gaps: string[];           // specific things missing in this layer
  implementation: string;   // exactly what Prodify will build
  envVarsNeeded: string[];  // env vars required for this layer
}

export interface ConflictWarning {
  description: string;
  severity: 'warning' | 'blocker';
  resolution: string;
  affectedFiles: string[];
}

export interface AnalysisReport {
  detectedStack: {
    framework: string;
    frameworkVersion: string;
    language: 'typescript' | 'javascript' | 'unknown';
    nodeVersion: string | null;
    hasAuth: boolean;
    authProvider: string | null;
    authDetails: string | null;       // e.g. "next-auth v4 with GitHub + credentials providers"
    hasPayments: boolean;
    paymentsProvider: string | null;
    paymentsDetails: string | null;   // e.g. "Stripe SDK found but no webhook handler"
    hasDatabase: boolean;
    dbProvider: string | null;
    dbDetails: string | null;         // e.g. "Prisma with PostgreSQL, 3 models detected"
    hasCI: boolean;
    ciDetails: string | null;
    otherDependencies: string[];      // notable libs: tailwind, shadcn, zod, react-query etc
  };
  pattern: 'crud' | 'dashboard' | 'landing' | 'ai-app' | 'ecommerce' | 'generic';
  appDescription: string;             // what the app actually does
  injectionOpportunities: InjectionOpportunity[];
  conflicts: ConflictWarning[];
  summary: string;
  monetizationReadiness: {
    score: number;                    // 0-100
    blockers: string[];               // things that MUST be done before monetizing
    quickWins: string[];              // things Prodify can inject immediately
  };
}

// Legacy type kept for backwards compat
export interface RetrofitPlan {
  pattern: 'crud' | 'dashboard' | 'generic';
  modifications: Array<{
    file: string;
    action: 'inject_auth' | 'inject_stripe' | 'inject_db';
    description: string;
  }>;
}

async function readFileSafe(p: string, maxChars = 2000): Promise<string> {
  try { return (await fs.readFile(p, 'utf-8')).slice(0, maxChars); } catch { return ''; }
}

async function buildFileTree(dir: string, maxFiles = 120): Promise<string> {
  try {
    const files = await fs.readdir(dir, { recursive: true }) as string[];
    return files
      .filter(f =>
        !f.includes('node_modules') &&
        !f.includes('.next') &&
        !f.includes('.git') &&
        !f.includes('dist') &&
        !f.includes('.turbo')
      )
      .slice(0, maxFiles)
      .join('\n');
  } catch { return ''; }
}

// Read key source files to give the AI real code context
async function readKeySourceFiles(dir: string): Promise<string> {
  const candidates = [
    // Auth
    'lib/auth.ts', 'lib/auth.js', 'app/api/auth/[...nextauth]/route.ts',
    'pages/api/auth/[...nextauth].ts', 'middleware.ts', 'middleware.js',
    // Payments
    'lib/stripe.ts', 'lib/stripe.js', 'lib/payments.ts',
    'app/api/webhooks/stripe/route.ts', 'app/api/checkout/route.ts',
    'pages/api/webhooks/stripe.ts', 'pages/api/checkout.ts',
    // Database
    'lib/db.ts', 'lib/db.js', 'lib/prisma.ts', 'lib/supabase.ts',
    'prisma/schema.prisma', 'drizzle.config.ts', 'db/schema.ts',
    // Config
    'next.config.ts', 'next.config.js', 'next.config.mjs',
    '.env.example', '.env.local.example',
  ];

  const results: string[] = [];
  for (const rel of candidates) {
    const content = await readFileSafe(path.join(dir, rel), 1500);
    if (content) {
      results.push(`\n=== ${rel} ===\n${content}`);
    }
  }
  return results.join('\n');
}

export async function analyzeRepository(targetDir: string): Promise<AnalysisReport> {
  const [packageJson, tree, envExample, sourceFiles] = await Promise.all([
    readFileSafe(path.join(targetDir, 'package.json'), 4000),
    buildFileTree(targetDir),
    readFileSafe(path.join(targetDir, '.env.example'), 1500),
    readKeySourceFiles(targetDir),
  ]);

  const prompt = `You are a senior full-stack engineer and SaaS monetization expert performing a deep technical audit of a GitHub repository. You are preparing a detailed report for a developer who wants to add production-grade auth, payments, and database infrastructure to their existing app.

Your analysis must be DEEP, SPECIFIC, and ACTIONABLE — not generic. Reference actual file names, package versions, and code patterns you find. A developer reading this should know EXACTLY what is missing and what needs to be built.

=== package.json ===
${packageJson}

=== File tree ===
${tree}

=== .env.example ===
${envExample}

=== Key source files ===
${sourceFiles}

---

DETECTION RULES (only mark as present if you find concrete evidence):
- hasAuth=true: next-auth/clerk/auth0/supabase-auth/firebase in deps OR auth route files found
- hasPayments=true: stripe/lemon-squeezy/paddle in deps OR checkout/webhook/billing files found  
- hasDatabase=true: prisma/drizzle/supabase/mongoose/pg in deps OR schema/migration files found
- hasCI=true: .github/workflows/ appears in file tree

For each injection layer, provide:
- gaps: specific things that are MISSING (e.g. "No Stripe webhook handler", "No subscription table", "No customer portal route")
- implementation: detailed description of exactly what will be built (e.g. "Stripe Checkout with price IDs, webhook handler for checkout.session.completed and customer.subscription.*, subscription status stored in DB, customer portal at /api/billing/portal")
- envVarsNeeded: exact env var names needed (e.g. STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_MONTHLY)

For monetizationReadiness:
- score: 0-100 based on how close the app is to being able to charge users
- blockers: specific technical blockers (e.g. "No user identity system — can't associate payments with users", "No database — can't store subscription status")
- quickWins: things Prodify can inject in one shot (e.g. "Full Stripe checkout + webhook pipeline", "InsForge subscriptions table with RLS")

Return ONLY valid JSON — no markdown, no code fences, no explanation:

{
  "detectedStack": {
    "framework": "string",
    "frameworkVersion": "string",
    "language": "typescript" | "javascript" | "unknown",
    "nodeVersion": string | null,
    "hasAuth": boolean,
    "authProvider": string | null,
    "authDetails": string | null,
    "hasPayments": boolean,
    "paymentsProvider": string | null,
    "paymentsDetails": string | null,
    "hasDatabase": boolean,
    "dbProvider": string | null,
    "dbDetails": string | null,
    "hasCI": boolean,
    "ciDetails": string | null,
    "otherDependencies": ["array of notable libs"]
  },
  "pattern": "crud" | "dashboard" | "landing" | "ai-app" | "ecommerce" | "generic",
  "appDescription": "2-3 sentences describing what this app actually does based on the code",
  "injectionOpportunities": [
    {
      "layer": "auth" | "payments" | "database" | "ci" | "env",
      "canInject": boolean,
      "currentState": "specific description of what exists, referencing actual files/packages found",
      "proposed": "specific description of what will be injected",
      "filesToCreate": ["exact/file/paths/that/will/be/created.ts"],
      "effort": "low" | "medium" | "high",
      "gaps": ["specific gap 1", "specific gap 2"],
      "implementation": "detailed paragraph describing exactly what will be built and how it integrates with the existing code",
      "envVarsNeeded": ["EXACT_ENV_VAR_NAME_1", "EXACT_ENV_VAR_NAME_2"]
    }
  ],
  "conflicts": [
    {
      "description": "specific conflict referencing actual files/packages",
      "severity": "warning" | "blocker",
      "resolution": "concrete step-by-step resolution",
      "affectedFiles": ["file/that/conflicts.ts"]
    }
  ],
  "summary": "3-4 sentences: what the app does, exact infrastructure state, what is missing, monetization gap",
  "monetizationReadiness": {
    "score": 0-100,
    "blockers": ["specific blocker 1", "specific blocker 2"],
    "quickWins": ["specific quick win 1", "specific quick win 2"]
  }
}`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  };

  try {
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body)) as { content: Array<{ text: string }> };
    const text = result.content[0]?.text;
    if (!text) throw new Error('No content from Bedrock');

    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr) as AnalysisReport;
  } catch (error) {
    console.error('[analyzer] Bedrock error:', error);
    return {
      detectedStack: {
        framework: 'Next.js',
        frameworkVersion: 'unknown',
        language: 'typescript',
        nodeVersion: null,
        hasAuth: false,
        authProvider: null,
        authDetails: null,
        hasPayments: false,
        paymentsProvider: null,
        paymentsDetails: null,
        hasDatabase: false,
        dbProvider: null,
        dbDetails: null,
        hasCI: false,
        ciDetails: null,
        otherDependencies: [],
      },
      pattern: 'generic',
      appDescription: 'Analysis could not be completed. Please try again.',
      injectionOpportunities: [
        {
          layer: 'auth', canInject: true,
          currentState: 'No auth detected',
          proposed: 'NextAuth.js with InsForge backend',
          filesToCreate: ['prodify-layer/auth/[...nextauth].ts'],
          effort: 'low',
          gaps: ['No authentication system'],
          implementation: 'NextAuth.js with credentials + GitHub OAuth, session management via InsForge',
          envVarsNeeded: ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
        },
        {
          layer: 'payments', canInject: true,
          currentState: 'No payments detected',
          proposed: 'Stripe Checkout + webhooks + customer portal',
          filesToCreate: ['prodify-layer/payments/stripe.ts', 'prodify-layer/app/api/checkout/route.ts', 'prodify-layer/app/api/webhooks/stripe/route.ts'],
          effort: 'medium',
          gaps: ['No Stripe integration', 'No subscription management', 'No webhook handler'],
          implementation: 'Full Stripe Checkout flow with subscription management, webhook handler for lifecycle events, customer portal',
          envVarsNeeded: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID'],
        },
        {
          layer: 'database', canInject: true,
          currentState: 'No database detected',
          proposed: 'InsForge SQL schema with users, subscriptions tables',
          filesToCreate: ['prodify-layer/db/schema.sql', 'prodify-layer/db/insforge.ts'],
          effort: 'low',
          gaps: ['No database schema', 'No user table', 'No subscription tracking'],
          implementation: 'InsForge PostgreSQL schema with users, subscriptions, and webhook_events tables',
          envVarsNeeded: ['INSFORGE_URL', 'INSFORGE_ANON_KEY'],
        },
        {
          layer: 'ci', canInject: true,
          currentState: 'No CI detected',
          proposed: 'GitHub Actions — typecheck + test on push/PR',
          filesToCreate: ['.github/workflows/ci.yml'],
          effort: 'low',
          gaps: ['No automated testing pipeline'],
          implementation: 'GitHub Actions workflow running tsc --noEmit and npm test on every push and PR',
          envVarsNeeded: [],
        },
      ],
      conflicts: [],
      summary: 'Analysis could not be completed automatically. All standard injection opportunities are available.',
      monetizationReadiness: {
        score: 0,
        blockers: ['Analysis failed — please retry'],
        quickWins: [],
      },
    };
  }
}
