import crypto from 'crypto';
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

const SONNET_MODEL_ID = process.env.AWS_BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
const HAIKU_MODEL_ID = process.env.AWS_BEDROCK_HAIKU_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface InjectionOpportunity {
  layer: 'auth' | 'payments' | 'database' | 'ci' | 'env';
  canInject: boolean;
  currentState: string;
  proposed: string;
  filesToCreate: string[];
  effort: 'low' | 'medium' | 'high';
  gaps: string[];
  implementation: string;
  envVarsNeeded: string[];
}

export interface ConflictWarning {
  description: string;
  severity: 'warning' | 'blocker';
  resolution: string;
  affectedFiles: string[];
}

export interface CodeInsight {
  category: 'auth' | 'payments' | 'database' | 'architecture' | 'security' | 'performance';
  finding: string;
  evidence: string;
  recommendation: string;
}

export interface AnalysisReport {
  detectedStack: {
    framework: string;
    frameworkVersion: string;
    language: 'typescript' | 'javascript' | 'unknown';
    nodeVersion: string | null;
    hasAuth: boolean;
    authProvider: string | null;
    authDetails: string | null;
    hasPayments: boolean;
    paymentsProvider: string | null;
    paymentsDetails: string | null;
    hasDatabase: boolean;
    dbProvider: string | null;
    dbDetails: string | null;
    hasCI: boolean;
    ciDetails: string | null;
    otherDependencies: string[];
  };
  pattern: 'crud' | 'dashboard' | 'landing' | 'ai-app' | 'ecommerce' | 'generic';
  appDescription: string;
  apiRoutes: string[];
  codeInsights: CodeInsight[];
  injectionOpportunities: InjectionOpportunity[];
  conflicts: ConflictWarning[];
  summary: string;
  monetizationReadiness: {
    score: number;
    blockers: string[];
    quickWins: string[];
  };
}

// Phase 1 output — computed for free, used for caching + scoping AI calls
export interface RepoFingerprint {
  packageJsonHash: string;
  framework: string;
  frameworkVersion: string;
  language: 'typescript' | 'javascript' | 'unknown';
  nodeVersion: string | null;
  deps: {
    hasNextAuth: boolean;
    hasClerk: boolean;
    hasBetterAuth: boolean;
    hasStripe: boolean;
    hasLemonSqueezy: boolean;
    hasPrisma: boolean;
    hasDrizzle: boolean;
    hasSupabase: boolean;
    hasMongoose: boolean;
    hasTrpc: boolean;
    hasTailwind: boolean;
    hasShadcn: boolean;
    hasZod: boolean;
    other: string[];
  };
  files: {
    hasMiddleware: boolean;
    hasPrismaSchema: boolean;
    hasStripeWebhook: boolean;
    hasStripeCheckout: boolean;
    hasAuthConfig: boolean;
    hasEnvExample: boolean;
    hasCI: boolean;
  };
  partialImpls: string[];
  fileCount: number;
  compactTree: string;
}

// Phase 2 Haiku output — guides which files Phase 3 reads
interface HaikuInsight {
  appDescription: string;
  pattern: 'crud' | 'dashboard' | 'landing' | 'ai-app' | 'ecommerce' | 'generic';
  userContext: string;
  focusLayers: Array<'auth' | 'payments' | 'database' | 'ci'>;
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

// ─── File utilities ───────────────────────────────────────────────────────────

async function readFileSafe(p: string, maxChars = 3000): Promise<string> {
  try { return (await fs.readFile(p, 'utf-8')).slice(0, maxChars); } catch { return ''; }
}

async function buildFileTree(dir: string): Promise<string> {
  const IGNORE = new Set(['node_modules', '.next', '.git', 'dist', '.turbo', '.cache', 'coverage', '__pycache__', '.vercel']);

  async function walk(current: string, prefix = '', depth = 0): Promise<string[]> {
    if (depth > 8) return [];
    let entries: fs.Dirent[];
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return []; }

    const filtered = entries
      .filter(e => !IGNORE.has(e.name) && !e.name.startsWith('.DS_Store'))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    const lines: string[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i];
      const isLast = i === filtered.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';
      lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}`);
      if (entry.isDirectory()) {
        const children = await walk(path.join(current, entry.name), prefix + childPrefix, depth + 1);
        lines.push(...children);
      }
    }
    return lines;
  }

  const lines = await walk(dir);
  return lines.join('\n');
}

async function discoverAndReadApiRoutes(dir: string): Promise<{ paths: string[]; content: string }> {
  const apiDirs = [
    path.join(dir, 'app', 'api'),
    path.join(dir, 'src', 'app', 'api'),
    path.join(dir, 'pages', 'api'),
    path.join(dir, 'src', 'pages', 'api'),
  ];

  const paths: string[] = [];
  const contentParts: string[] = [];

  for (const apiDir of apiDirs) {
    if (!await fs.pathExists(apiDir)) continue;

    async function collectRoutes(d: string): Promise<void> {
      const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => [] as fs.Dirent[]);
      for (const entry of entries) {
        const fullPath = path.join(d, entry.name);
        if (entry.isDirectory()) {
          await collectRoutes(fullPath);
        } else if (/\.(ts|js|tsx|jsx)$/.test(entry.name)) {
          const rel = path.relative(dir, fullPath);
          paths.push(rel);
          const content = await readFileSafe(fullPath, 500);
          if (content) contentParts.push(`\n--- ${rel} ---\n${content}`);
        }
      }
    }
    await collectRoutes(apiDir);
  }

  return { paths, content: contentParts.join('\n') };
}

// ─── Phase 1: Programmatic scanner (~50ms, free) ─────────────────────────────

export async function scanRepository(dir: string): Promise<RepoFingerprint> {
  const pkgContent = await readFileSafe(path.join(dir, 'package.json'), 20000);
  const packageJsonHash = crypto.createHash('sha256').update(pkgContent || '').digest('hex');

  let pkg: Record<string, unknown> = {};
  try { pkg = JSON.parse(pkgContent || '{}') as Record<string, unknown>; } catch { /* ignore */ }

  const allDeps = {
    ...((pkg.dependencies ?? {}) as Record<string, string>),
    ...((pkg.devDependencies ?? {}) as Record<string, string>),
  };

  // Framework detection
  let framework = 'unknown';
  let frameworkVersion = 'unknown';
  if (allDeps['next']) { framework = 'Next.js'; frameworkVersion = allDeps['next']; }
  else if (allDeps['nuxt']) { framework = 'Nuxt'; frameworkVersion = allDeps['nuxt']; }
  else if (allDeps['@sveltejs/kit']) { framework = 'SvelteKit'; frameworkVersion = allDeps['@sveltejs/kit']; }
  else if (allDeps['remix']) { framework = 'Remix'; frameworkVersion = allDeps['remix']; }
  else if (allDeps['react']) { framework = 'React'; frameworkVersion = allDeps['react']; }

  // Language detection
  const language: 'typescript' | 'javascript' | 'unknown' = await fs.pathExists(path.join(dir, 'tsconfig.json')) ? 'typescript' : 'javascript';

  // Node version
  let nodeVersion: string | null = null;
  try { nodeVersion = (await fs.readFile(path.join(dir, '.nvmrc'), 'utf-8')).trim(); } catch { /* ignore */ }
  const engines = (pkg.engines ?? {}) as Record<string, string>;
  if (!nodeVersion && engines?.node) nodeVersion = engines.node;

  // Dependency flags
  const KNOWN_DEPS = new Set(['next', 'react', 'react-dom', 'nuxt', '@sveltejs/kit', 'remix',
    'typescript', '@types/node', '@types/react', '@types/react-dom', 'eslint',
    'postcss', 'autoprefixer', 'tailwindcss', 'zod', 'prisma', '@prisma/client',
    'drizzle-orm', 'next-auth', '@auth/core', '@clerk/nextjs', '@clerk/clerk-sdk-node',
    'better-auth', 'stripe', '@supabase/supabase-js', 'mongoose', '@trpc/server',
    '@trpc/client', '@lemonsqueezy/lemonsqueezy-js', 'lemonsqueezy', 'shadcn-ui']);

  const deps = {
    hasNextAuth: !!(allDeps['next-auth'] || allDeps['@auth/core']),
    hasClerk: !!(allDeps['@clerk/nextjs'] || allDeps['@clerk/clerk-sdk-node']),
    hasBetterAuth: !!allDeps['better-auth'],
    hasStripe: !!allDeps['stripe'],
    hasLemonSqueezy: !!(allDeps['@lemonsqueezy/lemonsqueezy-js'] || allDeps['lemonsqueezy']),
    hasPrisma: !!(allDeps['prisma'] || allDeps['@prisma/client']),
    hasDrizzle: !!allDeps['drizzle-orm'],
    hasSupabase: !!allDeps['@supabase/supabase-js'],
    hasMongoose: !!allDeps['mongoose'],
    hasTrpc: !!(allDeps['@trpc/server'] || allDeps['@trpc/client']),
    hasTailwind: !!allDeps['tailwindcss'],
    hasShadcn: !!(allDeps['shadcn-ui'] || await fs.pathExists(path.join(dir, 'components/ui'))),
    hasZod: !!allDeps['zod'],
    other: Object.keys(allDeps).filter(d => !KNOWN_DEPS.has(d)).slice(0, 20),
  };

  // Key file existence checks (run in parallel)
  const [
    middlewareTs, middlewareJs,
    prismaSchema,
    stripeWebhookApp, stripeWebhookPages,
    stripeCheckoutApp, stripeCheckoutPages,
    authLibTs, authLibJs, authRouteApp, authRoutePage,
    envExample, envLocalExample,
    ciWorkflows,
  ] = await Promise.all([
    fs.pathExists(path.join(dir, 'middleware.ts')),
    fs.pathExists(path.join(dir, 'middleware.js')),
    fs.pathExists(path.join(dir, 'prisma/schema.prisma')),
    fs.pathExists(path.join(dir, 'app/api/webhooks/stripe/route.ts')),
    fs.pathExists(path.join(dir, 'pages/api/webhooks/stripe.ts')),
    fs.pathExists(path.join(dir, 'app/api/checkout/route.ts')),
    fs.pathExists(path.join(dir, 'pages/api/checkout.ts')),
    fs.pathExists(path.join(dir, 'lib/auth.ts')),
    fs.pathExists(path.join(dir, 'lib/auth.js')),
    fs.pathExists(path.join(dir, 'app/api/auth/[...nextauth]/route.ts')),
    fs.pathExists(path.join(dir, 'pages/api/auth/[...nextauth].ts')),
    fs.pathExists(path.join(dir, '.env.example')),
    fs.pathExists(path.join(dir, '.env.local.example')),
    fs.pathExists(path.join(dir, '.github/workflows')),
  ]);

  const files = {
    hasMiddleware: middlewareTs || middlewareJs,
    hasPrismaSchema: prismaSchema,
    hasStripeWebhook: stripeWebhookApp || stripeWebhookPages,
    hasStripeCheckout: stripeCheckoutApp || stripeCheckoutPages,
    hasAuthConfig: authLibTs || authLibJs || authRouteApp || authRoutePage,
    hasEnvExample: envExample || envLocalExample,
    hasCI: ciWorkflows,
  };

  // Detect partial implementations
  const partialImpls: string[] = [];
  if (deps.hasStripe && !files.hasStripeWebhook) {
    partialImpls.push('Stripe installed but no webhook handler found');
  }
  if (deps.hasStripe && !files.hasStripeCheckout) {
    partialImpls.push('Stripe installed but no checkout route found');
  }
  if (deps.hasNextAuth && !files.hasAuthConfig) {
    partialImpls.push('next-auth installed but no auth config/route found');
  }
  if (deps.hasPrisma && !files.hasPrismaSchema) {
    partialImpls.push('Prisma installed but no schema.prisma found');
  }
  if (deps.hasClerk && files.hasMiddleware) {
    const mw = await readFileSafe(path.join(dir, middlewareTs ? 'middleware.ts' : 'middleware.js'), 600);
    if (mw && !mw.toLowerCase().includes('clerk')) {
      partialImpls.push('Clerk installed but middleware does not import Clerk');
    }
  }

  // Compact file tree (first 100 lines covers top-level structure well)
  const fullTree = await buildFileTree(dir);
  const treeLines = fullTree.split('\n');
  const fileCount = treeLines.filter(l => !l.trimEnd().endsWith('/')).length;
  const compactTree = treeLines.slice(0, 100).join('\n');

  return {
    packageJsonHash,
    framework,
    frameworkVersion,
    language,
    nodeVersion,
    deps,
    files,
    partialImpls,
    fileCount,
    compactTree,
  };
}

// Cache key — stable across calls for the same repo state
export function computeCacheKey(cloneUrl: string, headSha: string, packageJsonHash: string): string {
  return crypto.createHash('sha256')
    .update(`${cloneUrl}::${headSha}::${packageJsonHash}`)
    .digest('hex');
}

// ─── Bedrock helpers ──────────────────────────────────────────────────────────

async function invokeBedrock(modelId: string, prompt: string, maxTokens: number): Promise<string> {
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const response = await bedrock.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.body)) as { content: Array<{ text: string }> };
  const text = result.content[0]?.text;
  if (!text) throw new Error('Empty response from Bedrock');
  return text;
}

function parseJson<T>(text: string): T {
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(clean) as T;
  } catch (err) {
    if (err instanceof SyntaxError) {
      // AI response was cut off mid-JSON — output exceeded Bedrock's max_tokens limit.
      // Surface a clear error so the UI shows a useful message instead of a raw crash.
      throw new Error(
        `AI response was truncated (output exceeded token limit). ` +
        `Try analyzing a smaller repository, or re-run the analysis. ` +
        `Original parse error: ${err.message}`
      );
    }
    throw err;
  }
}

// ─── Phase 2: Haiku — App Understanding (~0.002¢) ────────────────────────────

async function runHaikuPhase(dir: string, fingerprint: RepoFingerprint): Promise<HaikuInsight> {
  const readme = await readFileSafe(path.join(dir, 'README.md'), 3000)
    || await readFileSafe(path.join(dir, 'readme.md'), 3000)
    || '(no README)';

  // Collect a few page file names to give Haiku app structure context
  const pageDirs = ['app', 'src/app', 'pages', 'src/pages'].map(d => path.join(dir, d));
  const pageNames: string[] = [];
  for (const pageDir of pageDirs) {
    if (!await fs.pathExists(pageDir)) continue;
    async function collectPageNames(d: string, depth = 0): Promise<void> {
      if (depth > 4 || pageNames.length > 30) return;
      const entries = await fs.readdir(d, { withFileTypes: true }).catch(() => [] as fs.Dirent[]);
      for (const e of entries) {
        if (['node_modules', '.next', 'api'].includes(e.name)) continue;
        if (e.isDirectory()) await collectPageNames(path.join(d, e.name), depth + 1);
        else if (/^(page|layout)\.(tsx|jsx|ts|js)$/.test(e.name)) {
          pageNames.push(path.relative(dir, path.join(d, e.name)));
        }
      }
    }
    await collectPageNames(pageDir);
    break; // only scan the first found page dir
  }

  const fingerprintSummary = JSON.stringify({
    framework: fingerprint.framework,
    language: fingerprint.language,
    deps: fingerprint.deps,
    files: fingerprint.files,
    partialImpls: fingerprint.partialImpls,
    fileCount: fingerprint.fileCount,
  }, null, 2);

  const prompt = `You are a fast technical classifier. Identify what this app is and which injection layers matter most.

=== README ===
${readme}

=== Page files ===
${pageNames.join('\n') || '(none found)'}

=== Detected dependencies & files ===
${fingerprintSummary}

Return ONLY valid JSON with no explanation:
{
  "appDescription": "2-3 sentences describing what the app does based on README and page structure",
  "pattern": "crud" | "dashboard" | "landing" | "ai-app" | "ecommerce" | "generic",
  "userContext": "1 sentence: who uses it and why",
  "focusLayers": ["auth", "payments", "database", "ci"]
}

For focusLayers: include all layers that need DEEP investigation. Include "auth" if hasNextAuth/hasClerk/hasBetterAuth is false OR partial. Include "payments" if hasStripe is false OR partial webhook. Include "database" if hasPrisma/hasDrizzle/hasSupabase is false. Include "ci" if hasCI is false. Always include at least 2 layers.`;

  try {
    const text = await invokeBedrock(HAIKU_MODEL_ID, prompt, 400);
    return parseJson<HaikuInsight>(text);
  } catch {
    // Fallback: infer from fingerprint without Haiku
    const focusLayers: HaikuInsight['focusLayers'] = [];
    const { deps, files } = fingerprint;
    if (!deps.hasNextAuth && !deps.hasClerk && !deps.hasBetterAuth) focusLayers.push('auth');
    if (!deps.hasStripe && !deps.hasLemonSqueezy) focusLayers.push('payments');
    if (!deps.hasPrisma && !deps.hasDrizzle && !deps.hasSupabase && !deps.hasMongoose) focusLayers.push('database');
    if (!files.hasCI) focusLayers.push('ci');
    return {
      appDescription: 'App description unavailable — proceeding with full analysis.',
      pattern: 'generic',
      userContext: 'Unknown',
      focusLayers: focusLayers.length ? focusLayers : ['auth', 'payments', 'database', 'ci'],
    };
  }
}

// ─── Phase 3: Sonnet — Plan + Safety Check (~2–3¢) ───────────────────────────

// Priority tiers for the budget-based scanner
const IGNORE_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', '.turbo', '.cache',
  'coverage', '__pycache__', '.vercel', 'build', 'out', '.output',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.prisma', '.yml', '.yaml',
]);

interface ScoredFile {
  absPath: string;
  relPath: string;
  priority: number; // lower = higher priority
  size: number;
}

// Assign priority rank to a relative file path so important files are read first
function scorePath(relPath: string): number {
  const p = relPath.replace(/\\/g, '/').toLowerCase();

  // Tier 0 — config anchors (always read first)
  if (p === 'package.json' || p.endsWith('/package.json')) return 0;
  if (p.startsWith('next.config') || p.startsWith('tsconfig')) return 1;
  if (p === '.env.example' || p === '.env.local.example') return 2;

  // Tier 1 — auth / middleware (highest-signal SaaS files)
  if (p === 'middleware.ts' || p === 'middleware.js') return 10;
  if (p.includes('auth') && !p.includes('node_modules')) return 11;
  if (p.includes('signin') || p.includes('login') || p.includes('signup')) return 12;
  if (p.includes('session') || p.includes('user') || p.includes('profile')) return 13;

  // Tier 2 — payments
  if (p.includes('stripe') || p.includes('payment') || p.includes('checkout') || p.includes('webhook')) return 20;
  if (p.includes('subscription') || p.includes('billing') || p.includes('plan')) return 21;

  // Tier 3 — database / schema
  if (p.endsWith('.prisma') || p.endsWith('schema.sql') || p.endsWith('supabase.sql')) return 30;
  if (p.includes('schema') || p.includes('/db/') || p.includes('drizzle')) return 31;
  if (p.includes('migrat')) return 32;

  // Tier 4 — API routes (all of them)
  if (p.includes('/api/') || p.includes('route.ts') || p.includes('route.js')) return 40;

  // Tier 5 — lib / utils
  if (p.includes('/lib/') || p.includes('/utils/') || p.includes('/helpers/')) return 50;

  // Tier 6 — layout and root pages
  if (p.match(/\/(layout|page)\.(tsx|jsx|ts|js)$/)) return 60;

  // Tier 7 — CI
  if (p.includes('.github/') || p.includes('workflows/')) return 70;

  // Tier 8 — everything else
  return 80;
}

// Walk the entire repo and collect all source files, sorted by priority
async function collectScoredFiles(dir: string): Promise<ScoredFile[]> {
  const results: ScoredFile[] = [];

  async function walk(current: string): Promise<void> {
    let entries: fs.Dirent[];
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.DS_Store')) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (!SOURCE_EXTENSIONS.has(ext)) continue;
        const relPath = path.relative(dir, fullPath).replace(/\\/g, '/');
        let size = 0;
        try { size = (await fs.stat(fullPath)).size; } catch { /* ignore */ }
        results.push({ absPath: fullPath, relPath, priority: scorePath(relPath), size });
      }
    }
  }

  await walk(dir);
  // Sort: primary by priority tier, secondary by file size ascending (smaller = more files fit)
  results.sort((a, b) => a.priority - b.priority || a.size - b.size);
  return results;
}

/**
 * Budget-based context builder — replaces the old hardcoded file list.
 *
 * Walks the ENTIRE repo, ranks every source file by how relevant it is
 * (auth > payments > db > api routes > lib > pages > ci > other), then
 * greedily reads files until the total char budget is exhausted.
 *
 * This means auth-context.tsx, supabase.sql, or any file with a
 * non-standard name/location will be found automatically without needing
 * a hardcoded entry. The detailed Sonnet output schema is unchanged.
 */
async function buildBudgetedContext(
  dir: string,
  _fingerprint: RepoFingerprint,
  _focusLayers: HaikuInsight['focusLayers'],
  totalBudget = 28_000, // chars — leaves room for the rest of the prompt
  perFileCap = 4_000,   // max chars per individual file
): Promise<string> {
  const scoredFiles = await collectScoredFiles(dir);

  const parts: string[] = [];
  let budgetUsed = 0;

  for (const file of scoredFiles) {
    if (budgetUsed >= totalBudget) break;
    const remaining = totalBudget - budgetUsed;
    const cap = Math.min(perFileCap, remaining);
    const content = await readFileSafe(file.absPath, cap);
    if (!content) continue;
    const block = `\n=== ${file.relPath} ===\n${content}`;
    parts.push(block);
    budgetUsed += block.length;
  }

  return parts.join('\n');
}

// Alias so runSonnetPhase call below needs no change
const buildTargetedContext = buildBudgetedContext;

// ─── Phase 3: Sonnet analysis ─────────────────────────────────────────────────

async function runSonnetPhase(
  dir: string,
  fingerprint: RepoFingerprint,
  haiku: HaikuInsight,
): Promise<AnalysisReport> {
  const [sourceFiles, apiRoutes] = await Promise.all([
    buildTargetedContext(dir, fingerprint, haiku.focusLayers),
    discoverAndReadApiRoutes(dir),
  ]);

  const fingerprintJson = JSON.stringify({
    framework: fingerprint.framework,
    frameworkVersion: fingerprint.frameworkVersion,
    language: fingerprint.language,
    nodeVersion: fingerprint.nodeVersion,
    deps: fingerprint.deps,
    files: fingerprint.files,
    partialImpls: fingerprint.partialImpls,
    fileCount: fingerprint.fileCount,
  }, null, 2);

  const prompt = `You are a senior full-stack engineer and SaaS monetization expert auditing a GitHub repository. Every claim must be grounded in the actual code provided below.

CRITICAL — RESPONSE SIZE CONSTRAINTS (strictly enforced, non-negotiable):
- Keep ALL string values extremely concise — maximum 1-2 short sentences each.
- "implementation" fields: max 2 sentences. No multi-paragraph descriptions.
- "gaps" arrays: max 3 items per layer.
- "filesToCreate" arrays: max 4 files per layer.
- "codeInsights": max 5 total insights.
- "otherDependencies": max 5 items.
- "blockers" and "quickWins": max 3 items each.
- Your ENTIRE JSON response MUST fit within 4000 tokens. When in doubt, be shorter.

IMPORTANT — TRUNCATED FILES: Some source files below may be truncated. If a file is cut off, do NOT conclude a feature is absent — the implementation may exist beyond the truncated section.

=== PHASE 1 FINGERPRINT (pre-computed, trust this) ===
${fingerprintJson}

=== PHASE 2 APP CONTEXT ===
appDescription: ${haiku.appDescription}
pattern: ${haiku.pattern}
userContext: ${haiku.userContext}
focusLayers: ${haiku.focusLayers.join(', ')}

=== FILE TREE (compact) ===
${fingerprint.compactTree}

=== TARGETED SOURCE FILES (auth/payments/db/ci for focus layers only) ===
${sourceFiles || '(no source files found)'}

=== API ROUTES ===
${apiRoutes.content || '(no API routes found)'}

===========================================================
INSTRUCTIONS
===========================================================

The detectedStack values for hasAuth/hasPayments/hasDatabase/hasCI can be inferred directly from the fingerprint — use it. Focus your AI reasoning on:
1. Specific code-level insights (bugs, gaps, partial impls) found in the source files above
2. Detailed injection plans for the focusLayers: ${haiku.focusLayers.join(', ')}
3. Conflict detection between existing code and proposed injections

DETECTION RULES — only mark as present with concrete fingerprint/code evidence:
- hasAuth: fingerprint.deps.hasNextAuth/hasClerk/hasBetterAuth, OR auth route file with actual handler code
- hasPayments: fingerprint.deps.hasStripe/hasLemonSqueezy, OR checkout/webhook route with actual handler
- hasDatabase: fingerprint.deps.hasPrisma/hasDrizzle/hasSupabase/hasMongoose, OR schema file with models
- hasCI: fingerprint.files.hasCI

For codeInsights, find REAL specific things:
- "Found useSession() called in dashboard/page.tsx but no SessionProvider in layout.tsx"
- "prisma/schema.prisma has User and Post models but no Subscription model"
- "Stripe SDK installed but app/api/webhooks/stripe/route.ts is missing"

For injectionOpportunities, reference actual files found. Include ALL layers (auth/payments/database/ci/env), not just focusLayers.

For monetizationReadiness score: 0=nothing, 30=DB only, 50=DB+auth, 70=DB+auth+partial payments, 90+=fully wired.

For apiRoutes: ${JSON.stringify(apiRoutes.paths)}

Return ONLY valid JSON — no markdown, no code fences:

{
  "detectedStack": {
    "framework": "string",
    "frameworkVersion": "string",
    "language": "typescript" | "javascript" | "unknown",
    "nodeVersion": string | null,
    "hasAuth": boolean,
    "authProvider": string | null,
    "authDetails": "specific: e.g. next-auth v4.24.5 with GitHub OAuth, sessions in JWT",
    "hasPayments": boolean,
    "paymentsProvider": string | null,
    "paymentsDetails": "specific: e.g. stripe@14.x installed but no webhook handler",
    "hasDatabase": boolean,
    "dbProvider": string | null,
    "dbDetails": "specific: e.g. Prisma v5.x with PostgreSQL, User+Post models, no Subscription table",
    "hasCI": boolean,
    "ciDetails": string | null,
    "otherDependencies": ["notable ones: tailwind, shadcn, zod, react-query, trpc, etc."]
  },
  "pattern": "crud" | "dashboard" | "landing" | "ai-app" | "ecommerce" | "generic",
  "appDescription": "3-4 sentences based on README and pages",
  "apiRoutes": ["every api route file path discovered"],
  "codeInsights": [
    {
      "category": "auth" | "payments" | "database" | "architecture" | "security" | "performance",
      "finding": "short title",
      "evidence": "exact file/package proving this",
      "recommendation": "specific fix or what Prodify does"
    }
  ],
  "injectionOpportunities": [
    {
      "layer": "auth" | "payments" | "database" | "ci" | "env",
      "canInject": boolean,
      "currentState": "reference actual files/packages found",
      "proposed": "specific routes, packages, schema tables",
      "filesToCreate": ["exact/relative/paths.ts"],
      "effort": "low" | "medium" | "high",
      "gaps": ["specific gap referencing missing code"],
      "implementation": "detailed paragraph: exact API routes, functions, DB schema fields, webhook events, integration points",
      "envVarsNeeded": ["EXACT_VAR_NAME"]
    }
  ],
  "conflicts": [
    {
      "description": "specific conflict referencing actual files",
      "severity": "warning" | "blocker",
      "resolution": "concrete steps",
      "affectedFiles": ["actual/file/paths.ts"]
    }
  ],
  "summary": "4-5 sentences: what the app does, exact infrastructure state, what is missing, why monetization isn't possible yet, what Prodify fixes",
  "monetizationReadiness": {
    "score": 0,
    "blockers": ["specific technical blocker grounded in code"],
    "quickWins": ["specific Prodify injection that unblocks a blocker"]
  }
}`;

  const text = await invokeBedrock(SONNET_MODEL_ID, prompt, 8000);
  return parseJson<AnalysisReport>(text);
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Phase 2 + 3 combined — call this after a cache miss
export async function analyzeWithAI(dir: string, fingerprint: RepoFingerprint): Promise<AnalysisReport> {
  const haiku = await runHaikuPhase(dir, fingerprint);
  return runSonnetPhase(dir, fingerprint, haiku);
}

// Convenience wrapper: scan + analyze in one call
export async function analyzeRepository(dir: string): Promise<AnalysisReport> {
  const fingerprint = await scanRepository(dir);
  return analyzeWithAI(dir, fingerprint);
}

// ─── Fallback report (used on unrecoverable error) ────────────────────────────

export function buildFallbackReport(): AnalysisReport {
  return {
    detectedStack: {
      framework: 'Next.js', frameworkVersion: 'unknown', language: 'typescript',
      nodeVersion: null, hasAuth: false, authProvider: null, authDetails: null,
      hasPayments: false, paymentsProvider: null, paymentsDetails: null,
      hasDatabase: false, dbProvider: null, dbDetails: null,
      hasCI: false, ciDetails: null, otherDependencies: [],
    },
    pattern: 'generic',
    appDescription: 'Analysis could not be completed. Please try again.',
    apiRoutes: [],
    codeInsights: [],
    injectionOpportunities: [
      {
        layer: 'auth', canInject: true, currentState: 'Not found in codebase',
        proposed: 'NextAuth.js with InsForge backend',
        filesToCreate: ['prodify-layer/auth/[...nextauth].ts'], effort: 'low',
        gaps: ['No authentication system detected'],
        implementation: 'NextAuth.js with credentials + GitHub OAuth, session management via InsForge',
        envVarsNeeded: ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
      },
      {
        layer: 'payments', canInject: true, currentState: 'Not found in codebase',
        proposed: 'Stripe Checkout + webhooks + customer portal',
        filesToCreate: ['prodify-layer/payments/stripe.ts', 'prodify-layer/app/api/checkout/route.ts', 'prodify-layer/app/api/webhooks/stripe/route.ts'],
        effort: 'medium', gaps: ['No Stripe integration', 'No webhook handler'],
        implementation: 'Full Stripe Checkout with subscription management and customer portal',
        envVarsNeeded: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID'],
      },
      {
        layer: 'database', canInject: true, currentState: 'Not found in codebase',
        proposed: 'InsForge SQL schema with users, subscriptions tables',
        filesToCreate: ['prodify-layer/db/schema.sql', 'prodify-layer/db/insforge.ts'],
        effort: 'low', gaps: ['No database schema'],
        implementation: 'InsForge PostgreSQL schema with users, subscriptions, and webhook_events tables',
        envVarsNeeded: ['INSFORGE_URL', 'INSFORGE_ANON_KEY'],
      },
      {
        layer: 'ci', canInject: true, currentState: 'Not found in codebase',
        proposed: 'GitHub Actions — typecheck + test on push/PR',
        filesToCreate: ['.github/workflows/ci.yml'], effort: 'low',
        gaps: ['No automated testing pipeline'],
        implementation: 'GitHub Actions workflow running tsc --noEmit and npm test on every push and PR',
        envVarsNeeded: [],
      },
    ],
    conflicts: [],
    summary: 'Analysis could not be completed automatically. All standard injection opportunities are available.',
    monetizationReadiness: { score: 0, blockers: ['Analysis failed — please retry'], quickWins: [] },
  };
}
