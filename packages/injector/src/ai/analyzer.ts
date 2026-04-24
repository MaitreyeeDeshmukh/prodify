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
}

export interface ConflictWarning {
  description: string;
  severity: 'warning' | 'blocker';
  resolution: string;
}

export interface AnalysisReport {
  detectedStack: {
    framework: string;
    language: 'typescript' | 'javascript' | 'unknown';
    hasAuth: boolean;
    authProvider: string | null;
    hasPayments: boolean;
    paymentsProvider: string | null;
    hasDatabase: boolean;
    dbProvider: string | null;
    hasCI: boolean;
  };
  pattern: 'crud' | 'dashboard' | 'landing' | 'ai-app' | 'ecommerce' | 'generic';
  injectionOpportunities: InjectionOpportunity[];
  conflicts: ConflictWarning[];
  summary: string;
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

async function buildFileTree(dir: string, maxFiles = 80): Promise<string> {
  try {
    const files = await fs.readdir(dir, { recursive: true }) as string[];
    return files
      .filter(f => !f.includes('node_modules') && !f.includes('.next') && !f.includes('.git'))
      .slice(0, maxFiles)
      .join('\n');
  } catch { return ''; }
}

export async function analyzeRepository(targetDir: string): Promise<AnalysisReport> {
  const [packageJson, packageLock, tree, envExample] = await Promise.all([
    readFileSafe(path.join(targetDir, 'package.json'), 3000),
    readFileSafe(path.join(targetDir, 'package-lock.json'), 500),
    buildFileTree(targetDir),
    readFileSafe(path.join(targetDir, '.env.example'), 1000),
  ]);

  // Also peek at next.config and tsconfig to understand the stack
  const [nextConfig, tsConfig] = await Promise.all([
    readFileSafe(path.join(targetDir, 'next.config.ts'), 500)
      .then(c => c || readFileSafe(path.join(targetDir, 'next.config.js'), 500)),
    readFileSafe(path.join(targetDir, 'tsconfig.json'), 300),
  ]);

  const prompt = `You are a senior engineer performing a precise technical audit of a GitHub repository. Your job is to detect what infrastructure already EXISTS in the codebase and what is MISSING.

CRITICAL RULES:
- Only mark something as present (hasAuth, hasPayments, hasDatabase) if you find CONCRETE EVIDENCE in the files below
- Evidence for payments: stripe, lemon-squeezy, paddle, chargebee in package.json dependencies OR files named checkout/billing/webhook/subscription
- Evidence for auth: next-auth, clerk, auth0, supabase auth, firebase auth in package.json OR files named [...nextauth], auth.ts, middleware.ts with auth logic
- Evidence for database: prisma, drizzle, supabase, mongoose, pg, mysql2 in package.json OR schema files, migration files
- Evidence for CI: .github/workflows/ directory in the file tree
- If you don't see it in the data below, it does NOT exist — do not infer or assume
- The summary must be factual and specific, not marketing language

=== package.json ===
${packageJson}

=== File tree (first 80 files) ===
${tree}

=== .env.example ===
${envExample}

=== next.config ===
${nextConfig}

=== tsconfig ===
${tsConfig}

Return ONLY valid JSON matching this exact TypeScript interface (no markdown, no explanation, no code fences):

{
  "detectedStack": {
    "framework": "string (e.g. 'Next.js 14 App Router')",
    "language": "typescript" | "javascript" | "unknown",
    "hasAuth": boolean,
    "authProvider": string | null,
    "hasPayments": boolean,
    "paymentsProvider": string | null,
    "hasDatabase": boolean,
    "dbProvider": string | null,
    "hasCI": boolean
  },
  "pattern": "crud" | "dashboard" | "landing" | "ai-app" | "ecommerce" | "generic",
  "injectionOpportunities": [
    {
      "layer": "auth" | "payments" | "database" | "ci" | "env",
      "canInject": boolean,
      "currentState": "exact description of what exists or 'None detected'",
      "proposed": "exactly what Prodify will inject",
      "filesToCreate": ["list", "of", "file", "paths"],
      "effort": "low" | "medium" | "high"
    }
  ],
  "conflicts": [
    {
      "description": "specific conflict based on evidence found",
      "severity": "warning" | "blocker",
      "resolution": "concrete resolution step"
    }
  ],
  "summary": "2-3 sentences: what the app does, what infrastructure exists, what is missing. Be factual and specific."
}`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
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
    // Return a sensible fallback so the UI still works
    return {
      detectedStack: {
        framework: 'Next.js',
        language: 'typescript',
        hasAuth: false,
        authProvider: null,
        hasPayments: false,
        paymentsProvider: null,
        hasDatabase: false,
        dbProvider: null,
        hasCI: false,
      },
      pattern: 'generic',
      injectionOpportunities: [
        { layer: 'auth', canInject: true, currentState: 'No auth detected', proposed: 'NextAuth.js with InsForge backend', filesToCreate: ['prodify-layer/auth/[...nextauth].ts'], effort: 'low' },
        { layer: 'payments', canInject: true, currentState: 'No payments detected', proposed: 'Stripe checkout + webhooks', filesToCreate: ['prodify-layer/payments/stripe.ts'], effort: 'low' },
        { layer: 'database', canInject: true, currentState: 'No database detected', proposed: 'InsForge SQL schema', filesToCreate: ['prodify-layer/db/schema.sql', 'prodify-layer/db/insforge.ts'], effort: 'low' },
        { layer: 'ci', canInject: true, currentState: 'No CI detected', proposed: 'GitHub Actions — typecheck + test', filesToCreate: ['.github/workflows/ci.yml'], effort: 'low' },
      ],
      conflicts: [],
      summary: 'Analysis could not be completed automatically. All standard injection opportunities are available.',
    };
  }
}
