import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge } from '@/lib/insforge';
import { logActivity } from '@/lib/activity';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { simpleGit } from 'simple-git';
import { buildAuthFiles } from '@prodify/injector/src/injectors/auth';
import { buildDbFiles } from '@prodify/injector/src/injectors/db';
import { buildPaymentsFiles } from '@prodify/injector/src/injectors/payments';
import { buildReadmeFile } from '@prodify/injector/src/injectors/readme';
import {
  buildSupabaseAuthFiles,
  buildSupabaseDbFiles,
  buildSupabasePaymentsFiles,
  supabaseRequiredDeps,
  supabaseEnvExample,
} from '@prodify/injector/src/injectors/supabase';
import { runValidation, toInjectedFiles, formatReport } from '@prodify/injector/src/validation/validator';
import type { PricingModel, UserType, ProdifyAnswers } from '@prodify/injector/src/types';

// ── Backend detection ─────────────────────────────────────────────────────────

function detectBackend(analysisResult: Record<string, unknown> | null): 'supabase' | 'insforge' {
  if (!analysisResult) return 'insforge';
  const stack = analysisResult.detectedStack as Record<string, unknown> | undefined;
  const dbProvider = ((stack?.dbProvider as string) ?? '').toLowerCase();
  const authProvider = ((stack?.authProvider as string) ?? '').toLowerCase();
  if (dbProvider.includes('supabase') || authProvider.includes('supabase')) return 'supabase';
  return 'insforge';
}

// ── Protected path detection ──────────────────────────────────────────────────
// Scans the repo's actual route structure so middleware protects real paths.
// Never uses a hardcoded list from a different project.

const AUTH_ROUTE_PATTERNS = [
  'dashboard', 'account', 'settings', 'billing', 'profile',
  'admin', 'workspace', 'app', 'analyze', 'report', 'recommendations',
  'orders', 'projects', 'team', 'org', 'members',
];

function detectProtectedPaths(tmpDir: string): string[] {
  const candidates = [
    path.join(tmpDir, 'app'),
    path.join(tmpDir, 'src', 'app'),
    path.join(tmpDir, 'pages'),
    path.join(tmpDir, 'src', 'pages'),
  ];

  const found = new Set<string>();

  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name.toLowerCase().replace(/[()[\]]/g, '');
        if (AUTH_ROUTE_PATTERNS.includes(name)) {
          found.add('/' + name);
        }
      }
    } catch { /* ignore read errors */ }
  }

  return found.size > 0
    ? [...found]
    : ['/dashboard', '/account', '/settings', '/billing'];
}

// ── package.json updater ──────────────────────────────────────────────────────
// Adds required dependencies to package.json before committing.
// App will crash on deploy if imports reference packages that aren't installed.

function updatePackageJson(tmpDir: string, backend: 'supabase' | 'insforge'): string[] {
  const pkgPath = path.join(tmpDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  pkg.dependencies = pkg.dependencies ?? {};
  const added: string[] = [];

  const toAdd = backend === 'supabase' ? supabaseRequiredDeps : { stripe: '^17.7.0' };

  for (const [dep, version] of Object.entries(toAdd)) {
    if (!pkg.dependencies[dep] && !pkg.devDependencies?.[dep]) {
      pkg.dependencies[dep] = version;
      added.push(dep);
    }
  }

  if (added.length > 0) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  }

  return added;
}

// ── .env.example writer ───────────────────────────────────────────────────────

function updateEnvExample(tmpDir: string, backend: 'supabase' | 'insforge'): void {
  if (backend !== 'supabase') return; // InsForge env handled elsewhere

  const envExamplePath = path.join(tmpDir, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    const existing = fs.readFileSync(envExamplePath, 'utf-8');
    // Only append vars that aren't already documented
    const toAdd = supabaseEnvExample
      .split('\n')
      .filter(line => {
        const key = line.match(/^([A-Z_][A-Z0-9_]*)=/)?.[1];
        return !key || !existing.includes(key);
      })
      .join('\n');
    if (toAdd.trim()) {
      fs.appendFileSync(envExamplePath, '\n' + toAdd, 'utf-8');
    }
  } else {
    fs.writeFileSync(envExamplePath, supabaseEnvExample, 'utf-8');
  }
}

// ── Middleware placement ──────────────────────────────────────────────────────
// Moves the generated middleware from prodify-layer/__middleware_source__.ts
// to middleware.ts at the project root. Next.js only picks up middleware from root.

function placeMiddlewareAtRoot(tmpDir: string, allFiles: Array<{ relativePath: string; content: string }>): void {
  const sourceFile = allFiles.find(f => f.relativePath === 'prodify-layer/__middleware_source__.ts');
  if (!sourceFile) return;

  const rootMiddlewarePath = path.join(tmpDir, 'middleware.ts');

  // If existing middleware is present, prepend a merge note rather than silently overwriting
  if (fs.existsSync(rootMiddlewarePath)) {
    const existing = fs.readFileSync(rootMiddlewarePath, 'utf-8');
    // Only replace if the existing file doesn't already have Supabase session logic
    if (!existing.includes('@supabase/ssr') && !existing.includes('supabase.auth.getUser')) {
      const mergeNote = `// ⚠️  MERGE REQUIRED: Your existing middleware.ts was preserved below.
// Prodify's session refresh logic has been placed above it.
// Review both sections and combine into a single export.
//
// ── Prodify session refresh (add above your existing logic) ────────────────────
${sourceFile.content}
// ── Your existing middleware (review and integrate below) ─────────────────────
${existing}`;
      fs.writeFileSync(rootMiddlewarePath, mergeNote, 'utf-8');
    }
    // If already has Supabase logic, don't overwrite
  } else {
    fs.writeFileSync(rootMiddlewarePath, sourceFile.content, 'utf-8');
  }

  // Remove the staging file from prodify-layer
  const sourcePath = path.join(tmpDir, sourceFile.relativePath);
  if (fs.existsSync(sourcePath)) {
    fs.rmSync(sourcePath);
  }
}

// ── Detect package manager ────────────────────────────────────────────────────

function detectPackageManager(tmpDir: string): string {
  if (fs.existsSync(path.join(tmpDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(tmpDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(tmpDir, 'bun.lockb'))) return 'bun';
  return 'npm';
}

// ── CI file builder ───────────────────────────────────────────────────────────

function buildCiFile(tmpDir: string): string {
  const pm = detectPackageManager(tmpDir);
  const pkgPath = path.join(tmpDir, 'package.json');
  let testCommand = '';
  let hasTestScript = false;

  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
    hasTestScript = Boolean(pkg.scripts?.test);
  }

  const installCommand =
    pm === 'pnpm' ? 'pnpm install --frozen-lockfile' :
    pm === 'yarn' ? 'yarn install --frozen-lockfile' :
    pm === 'bun'  ? 'bun install' :
    'npm ci';

  const runPrefix =
    pm === 'pnpm' ? 'pnpm' :
    pm === 'yarn' ? 'yarn' :
    pm === 'bun'  ? 'bun' :
    'npm run';

  // Only include test step if a test script actually exists
  testCommand = hasTestScript
    ? `      - run: ${runPrefix === 'npm run' ? 'npm test' : `${runPrefix} test`}`
    : `      # No test script detected in package.json — add tests and uncomment below
      # - run: ${runPrefix === 'npm run' ? 'npm test' : `${runPrefix} test`}`;

  const setupStep = pm === 'pnpm'
    ? `      - uses: pnpm/action-setup@v4
        with:
          version: 9
      `
    : '';

  return `name: CI
on:
  push:
    branches: [main, 'prodify/**']
  pull_request:
    branches: [main]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: ${pm === 'bun' ? 'npm' : pm}
${setupStep}      - run: ${installCommand}
      - run: npx tsc --noEmit
${testCommand}
`;
}

// ── SSE helper ────────────────────────────────────────────────────────────────

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as { pricingModel: PricingModel; userType: UserType; openPR: boolean };

  const { data: project } = await insforge.database
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('userId', session.user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!project.cloneUrl) return NextResponse.json({ error: 'No repo URL' }, { status: 400 });

  const { data: conn } = await insforge.database
    .from('github_connections')
    .select('access_token, github_login')
    .eq('userId', session.user.id)
    .single();

  const stream = new ReadableStream({
    async start(controller) {
      const tmpDir = path.join(os.tmpdir(), `prodify-inject-${id}-${Date.now()}`);
      const branchName = `prodify/inject-${Date.now()}`;

      try {
        await insforge.database.from('projects').update({ status: 'injecting' }).eq('id', id);
        await logActivity({
          userId: session.user.id,
          projectId: id,
          projectName: project.name as string,
          type: 'injection_started',
          message: `Started injecting infrastructure into ${project.repoFullName ?? project.name}`,
          metadata: { pricingModel: body.pricingModel, userType: body.userType },
        });

        // Step 1: Clone
        send(controller, 'progress', { step: 1, total: 7, message: 'Cloning repository...' });
        let cloneUrl = project.cloneUrl as string;
        if (conn?.access_token) {
          cloneUrl = cloneUrl.replace('https://', `https://${conn.access_token}@`);
        }
        const git = simpleGit();
        await git.clone(cloneUrl, tmpDir, ['--depth=1']);
        const repoGit = simpleGit(tmpDir);

        // Step 2: Create branch
        send(controller, 'progress', { step: 2, total: 7, message: `Creating branch ${branchName}...` });
        await repoGit.checkoutLocalBranch(branchName);

        // Step 3: Build injection files
        send(controller, 'progress', { step: 3, total: 7, message: 'Generating infrastructure files...' });

        const backend = detectBackend(project.analysisResult as Record<string, unknown> | null);
        const answers: ProdifyAnswers = {
          pricingModel: body.pricingModel,
          userType: body.userType,
          stack: 'nextjs',
          autoDeploy: body.openPR,
        };

        // Detect actual protected paths from this repo's route structure
        const protectedPaths = detectProtectedPaths(tmpDir);

        let authFiles, dbFiles, paymentsFiles;
        if (backend === 'supabase') {
          authFiles = buildSupabaseAuthFiles(body.userType, protectedPaths);
          dbFiles = buildSupabaseDbFiles(body.userType);
          paymentsFiles = buildSupabasePaymentsFiles();
        } else {
          authFiles = buildAuthFiles(body.userType);
          dbFiles = buildDbFiles(body.userType);
          paymentsFiles = buildPaymentsFiles(body.pricingModel);
        }

        const ciContent = buildCiFile(tmpDir);
        const allInjectorFiles = [
          ...authFiles,
          ...dbFiles,
          ...paymentsFiles,
          ...buildReadmeFile(answers),
          { relativePath: '.github/workflows/ci.yml', content: ciContent },
        ];

        // Update package.json with required deps before writing files
        const addedDeps = updatePackageJson(tmpDir, backend);

        // Write .env.example additions
        updateEnvExample(tmpDir, backend);

        // Write all injector files to disk
        for (const file of allInjectorFiles) {
          // Skip the middleware staging file — it gets placed separately below
          if (file.relativePath === 'prodify-layer/__middleware_source__.ts') continue;
          const fullPath = path.join(tmpDir, file.relativePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, file.content, 'utf-8');
        }

        // Place middleware at project root (not inside prodify-layer/)
        placeMiddlewareAtRoot(tmpDir, allInjectorFiles);

        // Step 4: Validate — run all checks before committing anything
        send(controller, 'progress', { step: 4, total: 7, message: 'Validating injected files...' });

        // Build the full file list for the validator (include middleware at root)
        const middlewareContent = fs.existsSync(path.join(tmpDir, 'middleware.ts'))
          ? fs.readFileSync(path.join(tmpDir, 'middleware.ts'), 'utf-8')
          : '';
        const validatorFiles = toInjectedFiles(
          [
            ...allInjectorFiles.filter(f => f.relativePath !== 'prodify-layer/__middleware_source__.ts'),
            ...(middlewareContent ? [{ relativePath: 'middleware.ts', content: middlewareContent }] : []),
          ],
          tmpDir,
        );

        const validationReport = await runValidation(tmpDir, validatorFiles, backend, true);

        if (!validationReport.passed) {
          const reportText = formatReport(validationReport);
          console.error('[inject] validation failed:\n', reportText);
          await insforge.database.from('projects').update({ status: 'error' }).eq('id', id);
          await logActivity({
            userId: session.user.id,
            projectId: id,
            projectName: project.name as string,
            type: 'injection_failed',
            message: `Validation failed: ${validationReport.summary}`,
            metadata: { blocks: validationReport.blocks },
          });
          send(controller, 'error', {
            message: `Validation failed — ${validationReport.summary}`,
            blocks: validationReport.blocks,
          });
          return;
        }

        // Emit warnings even though we're continuing
        if (validationReport.warnings.length > 0) {
          send(controller, 'warnings', { warnings: validationReport.warnings });
        }

        // Step 5: Commit — detailed message describing exactly what was injected
        send(controller, 'progress', { step: 5, total: 7, message: 'Committing files...' });
        await repoGit.addConfig('user.name', 'Prodify Bot');
        await repoGit.addConfig('user.email', 'bot@prodify.dev');
        await repoGit.add('.');

        const pm = detectPackageManager(tmpDir);
        const authLine = backend === 'supabase'
          ? `Auth: Supabase Auth with @supabase/ssr — server client, browser client, OAuth callback, session refresh middleware`
          : `Auth: NextAuth.js with InsForge backend — ${body.userType} config (Google + GitHub OAuth)`;

        const dbLine = backend === 'supabase'
          ? `Database: Supabase SQL migration — users, subscriptions, webhook_events tables with RLS, indexes, CHECK constraints, updated_at triggers`
          : `Database: InsForge SQL schema — users and subscription tables`;

        const paymentsLine = backend === 'supabase'
          ? `Payments: Stripe ${body.pricingModel} billing — checkout, customer portal, webhook (6 events: checkout.completed, payment.succeeded, payment.failed, subscription.updated/deleted/trial_will_end)`
          : `Payments: Stripe ${body.pricingModel} billing — checkout, customer portal, webhook (6 events)`;

        const middlewareLine = `Middleware: Session refresh + route protection for ${protectedPaths.join(', ')} (detected from repo routes)`;
        const depsLine = addedDeps.length > 0 ? `\nDeps: Added ${addedDeps.join(', ')} to package.json` : '';
        const ciLine = `CI: GitHub Actions (${pm}) — install, typecheck${validationReport.passes.length > 0 ? ', tests if present' : ''}`;

        await repoGit.commit(
          `feat: inject Prodify production-ready SaaS infrastructure

- ${authLine}
- ${middlewareLine}
- ${paymentsLine}
- ${dbLine}
- ${ciLine}
- Docs: prodify-layer/db/schema.sql + README-prodify.md activation checklist${depsLine}

Validation: ${validationReport.summary}
Generated by Prodify — https://prodify.dev`,
        );

        // Step 6: Push
        send(controller, 'progress', { step: 6, total: 7, message: 'Pushing to GitHub...' });
        await repoGit.push(cloneUrl, branchName);

        // Step 7: Open PR if requested
        let prUrl: string | null = null;
        if (body.openPR && conn?.access_token && project.repoFullName) {
          send(controller, 'progress', { step: 7, total: 7, message: 'Opening pull request...' });
          const prRes = await fetch(`https://api.github.com/repos/${project.repoFullName}/pulls`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${conn.access_token}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({
              title: 'feat: Prodify — inject production-ready SaaS infrastructure',
              body: [
                '## Prodify Infrastructure Injection',
                '',
                'This PR injects production-ready SaaS infrastructure validated before push.',
                '',
                `- **Auth**: ${backend === 'supabase' ? `Supabase Auth with \`@supabase/ssr\` — server client, browser client, OAuth callback` : `NextAuth.js with InsForge backend (${body.userType})`}`,
                `- **Middleware**: Session refresh + route protection for \`${protectedPaths.join('`, `')}\` *(detected from your repo\'s routes)*`,
                `- **Payments**: Stripe ${body.pricingModel} billing — checkout, customer portal, webhook handling 6 lifecycle events`,
                `- **Database**: ${backend === 'supabase' ? 'Supabase SQL migration with users, subscriptions, webhook_events — RLS, indexes, CHECK constraints' : 'InsForge SQL schema'}`,
                `- **CI**: GitHub Actions (${pm}) — install, typecheck, conditional tests`,
                addedDeps.length > 0 ? `- **Deps**: Added \`${addedDeps.join('`, `')}\` to package.json` : '',
                '',
                '### Validation',
                `> ${validationReport.summary} — all BLOCK checks passed before this PR was opened`,
                '',
                '### Before merging',
                '',
                `1. Add env vars documented in \`prodify-layer/db/schema.sql\` header and \`.env.example\``,
                backend === 'supabase'
                  ? '2. Run the SQL migration: Supabase Dashboard → SQL Editor → paste `prodify-layer/db/schema.sql`'
                  : '2. Run the InsForge SQL schema against your database',
                '3. Enable these Stripe webhook events in your dashboard:',
                '   - `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`',
                '   - `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`',
                '4. Review `prodify-layer/` files and drop them into your `app/` or `src/` as indicated by the comments',
                '',
                '---',
                '*Generated by [Prodify](https://prodify.dev)*',
              ].filter(Boolean).join('\n'),
              head: branchName,
              base: project.defaultBranch ?? 'main',
            }),
          });

          if (prRes.ok) {
            const pr = await prRes.json() as { html_url: string };
            prUrl = pr.html_url;
          }
        } else {
          send(controller, 'progress', { step: 7, total: 7, message: 'Branch pushed to GitHub.' });
        }

        await insforge.database
          .from('projects')
          .update({
            status: 'injected',
            branchName,
            prUrl,
            injectionConfig: { pricingModel: body.pricingModel, userType: body.userType, openPR: body.openPR },
          })
          .eq('id', id);

        await logActivity({
          userId: session.user.id,
          projectId: id,
          projectName: project.name as string,
          type: prUrl ? 'pr_opened' : 'injection_completed',
          message: prUrl
            ? `PR opened for ${project.repoFullName ?? project.name}`
            : `Branch ${branchName} pushed to GitHub`,
          metadata: { prUrl, branchName, validationSummary: validationReport.summary },
        });

        send(controller, 'done', { prUrl, branchName });
      } catch (err) {
        console.error('[inject] error:', err);
        await insforge.database.from('projects').update({ status: 'error' }).eq('id', id);
        await logActivity({
          userId: session.user.id,
          projectId: id,
          projectName: project.name as string,
          type: 'injection_failed',
          message: `Injection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
        send(controller, 'error', { message: err instanceof Error ? err.message : 'Injection failed' });
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
