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
} from '@prodify/injector/src/injectors/supabase';
import type { PricingModel, UserType, ProdifyAnswers } from '@prodify/injector/src/types';

// Detect which backend a repo is using from its analysis result
function detectBackend(analysisResult: Record<string, unknown> | null): 'supabase' | 'insforge' {
  if (!analysisResult) return 'insforge';
  const stack = analysisResult.detectedStack as Record<string, unknown> | undefined;
  const dbProvider = ((stack?.dbProvider as string) ?? '').toLowerCase();
  const authProvider = ((stack?.authProvider as string) ?? '').toLowerCase();
  if (dbProvider.includes('supabase') || authProvider.includes('supabase')) return 'supabase';
  return 'insforge';
}

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

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
        await logActivity({ userId: session.user.id, projectId: id, projectName: project.name as string, type: 'injection_started', message: `Started injecting infrastructure into ${project.repoFullName ?? project.name}`, metadata: { pricingModel: body.pricingModel, userType: body.userType } });

        // Step 1: Clone
        send(controller, 'progress', { step: 1, total: 6, message: 'Cloning repository...' });
        let cloneUrl = project.cloneUrl as string;
        if (conn?.access_token) {
          cloneUrl = cloneUrl.replace('https://', `https://${conn.access_token}@`);
        }
        const git = simpleGit();
        await git.clone(cloneUrl, tmpDir, ['--depth=1']);
        const repoGit = simpleGit(tmpDir);

        // Step 2: Create branch
        send(controller, 'progress', { step: 2, total: 6, message: `Creating branch ${branchName}...` });
        await repoGit.checkoutLocalBranch(branchName);

        // Step 3: Build injection files — pick injectors based on detected stack
        send(controller, 'progress', { step: 3, total: 6, message: 'Generating infrastructure files...' });

        const backend = detectBackend(project.analysisResult as Record<string, unknown> | null);
        const answers: ProdifyAnswers = {
          pricingModel: body.pricingModel,
          userType: body.userType,
          stack: 'nextjs',
          autoDeploy: body.openPR,
        };

        let authFiles, dbFiles, paymentsFiles;
        if (backend === 'supabase') {
          authFiles = buildSupabaseAuthFiles(body.userType);
          dbFiles = buildSupabaseDbFiles(body.userType);
          paymentsFiles = buildSupabasePaymentsFiles();
        } else {
          authFiles = buildAuthFiles(body.userType);
          dbFiles = buildDbFiles(body.userType);
          paymentsFiles = buildPaymentsFiles(body.pricingModel);
        }

        const allFiles = [
          ...authFiles,
          ...dbFiles,
          ...paymentsFiles,
          ...buildReadmeFile(answers),
        ];

        // Also inject GitHub Actions CI
        const ciContent = `name: CI
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
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test
`;
        allFiles.push({ relativePath: '.github/workflows/ci.yml', content: ciContent });

        // Write files
        for (const file of allFiles) {
          const fullPath = path.join(tmpDir, file.relativePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, file.content, 'utf-8');
        }

        // Step 4: Commit
        send(controller, 'progress', { step: 4, total: 6, message: 'Committing files...' });
        await repoGit.addConfig('user.name', 'Prodify Bot');
        await repoGit.addConfig('user.email', 'bot@prodify.dev');
        await repoGit.add('.');
        const authLine = backend === 'supabase'
          ? `Auth: Supabase Auth with @supabase/ssr (${body.userType})`
          : `Auth: NextAuth.js with InsForge backend (${body.userType})`;
        const dbLine = backend === 'supabase'
          ? 'Database: Supabase SQL migrations (users, subscriptions, webhook_events + RLS)'
          : 'Database: InsForge SQL schema';
        const paymentsLine = `Payments: Stripe ${body.pricingModel} billing + webhook${backend === 'supabase' ? ' (Supabase-aware)' : ''}`;

        await repoGit.commit(`feat: inject Prodify production infrastructure

- ${authLine}
- ${paymentsLine}
- ${dbLine}
- CI: GitHub Actions typecheck + test
- Docs: README-prodify.md with activation checklist`);

        // Step 5: Push
        send(controller, 'progress', { step: 5, total: 6, message: 'Pushing to GitHub...' });
        let pushUrl = cloneUrl;
        await repoGit.push(pushUrl, branchName);

        // Step 6: Open PR if requested
        let prUrl: string | null = null;
        if (body.openPR && conn?.access_token && project.repoFullName) {
          send(controller, 'progress', { step: 6, total: 6, message: 'Opening pull request...' });
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
                'This PR injects production-ready SaaS infrastructure into your project:',
                '',
                `- **Auth**: ${backend === 'supabase' ? `Supabase Auth with \`@supabase/ssr\` (${body.userType})` : `NextAuth.js with InsForge backend (${body.userType})`}`,
                `- **Payments**: Stripe ${body.pricingModel} billing + webhooks`,
                `- **Database**: ${backend === 'supabase' ? 'Supabase SQL migrations (users, subscriptions, webhook_events + RLS)' : 'InsForge SQL schema'}`,
                '- **CI**: GitHub Actions typecheck + test',
                '',
                '### Before merging',
                '',
                '1. Add env vars from `prodify-layer/README-prodify.md`',
                `2. ${backend === 'supabase' ? 'Run the SQL migration in your Supabase project → SQL Editor' : 'Run the InsForge SQL schema'}`,
                '3. Review each injected file',
                '',
                '---',
                '*Generated by [Prodify](https://prodify.dev)*',
              ].join('\n'),
              head: branchName,
              base: project.defaultBranch ?? 'main',
            }),
          });

          if (prRes.ok) {
            const pr = await prRes.json() as { html_url: string };
            prUrl = pr.html_url;
          }
        } else {
          send(controller, 'progress', { step: 6, total: 6, message: 'Branch pushed to GitHub.' });
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

        await logActivity({ userId: session.user.id, projectId: id, projectName: project.name as string, type: prUrl ? 'pr_opened' : 'injection_completed', message: prUrl ? `PR opened for ${project.repoFullName ?? project.name}` : `Branch ${branchName} pushed to GitHub`, metadata: { prUrl, branchName } });
        send(controller, 'done', { prUrl, branchName });
      } catch (err) {
        console.error('[inject] error:', err);
        await insforge.database.from('projects').update({ status: 'error' }).eq('id', id);
        await logActivity({ userId: session.user.id, projectId: id, projectName: project.name as string, type: 'injection_failed', message: `Injection failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
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
