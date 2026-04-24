import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge } from '@/lib/insforge';
import { logActivity } from '@/lib/activity';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { simpleGit } from 'simple-git';
import { scanRepository, analyzeWithAI, computeCacheKey, buildFallbackReport } from '@prodify/injector/src/ai/analyzer';

function send(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const encoded = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  controller.enqueue(encoded);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data: project } = await insforge.database
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('userId', session.user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!project.cloneUrl) return NextResponse.json({ error: 'No repo URL on this project' }, { status: 400 });

  const { data: conn } = await insforge.database
    .from('github_connections')
    .select('access_token')
    .eq('userId', session.user.id)
    .single();

  const stream = new ReadableStream({
    async start(controller) {
      const tmpDir = path.join(os.tmpdir(), `prodify-${id}-${Date.now()}`);

      try {
        await insforge.database.from('projects').update({ status: 'analyzing' }).eq('id', id);
        await logActivity({
          userId: session.user.id,
          projectId: id,
          projectName: project.name as string,
          type: 'analysis_started',
          message: `Started analyzing ${project.repoFullName ?? project.name}`,
        });

        send(controller, 'progress', { step: 1, total: 5, message: 'Cloning repository...' });

        let cloneUrl = project.cloneUrl as string;
        if (conn?.access_token) {
          cloneUrl = cloneUrl.replace('https://', `https://${conn.access_token}@`);
        }

        const git = simpleGit();
        await git.clone(cloneUrl, tmpDir, ['--depth=1']);

        send(controller, 'progress', { step: 2, total: 5, message: 'Scanning project files...' });

        // Phase 1: free programmatic scan
        const fingerprint = await scanRepository(tmpDir);

        // Get HEAD commit SHA for cache key
        let headSha = 'unknown';
        try {
          const repoGit = simpleGit(tmpDir);
          headSha = (await repoGit.revparse(['HEAD'])).trim();
        } catch { /* non-fatal */ }

        // Cache check: if project already has an analysis for this exact repo state, return it
        const cacheKey = computeCacheKey(project.cloneUrl as string, headSha, fingerprint.packageJsonHash);
        const existingResult = project.analysisResult as (Record<string, unknown> & { _cacheKey?: string }) | null;

        if (existingResult?._cacheKey === cacheKey) {
          send(controller, 'progress', { step: 5, total: 5, message: 'Returning cached analysis...' });
          send(controller, 'done', { report: existingResult, cached: true });
          controller.close();
          return;
        }

        send(controller, 'progress', { step: 3, total: 5, message: 'Understanding app structure (Haiku)...' });

        // Phase 2 + 3: AI analysis (Haiku → Sonnet)
        send(controller, 'progress', { step: 4, total: 5, message: 'Deep analysis in progress (Sonnet)...' });

        const report = await analyzeWithAI(tmpDir, fingerprint);

        send(controller, 'progress', { step: 5, total: 5, message: 'Saving results...' });

        // Embed cache key inside the stored result (no schema migration needed)
        const reportWithCache = { ...report, _cacheKey: cacheKey };

        await insforge.database
          .from('projects')
          .update({ status: 'analyzed', analysisResult: reportWithCache })
          .eq('id', id);

        await logActivity({
          userId: session.user.id,
          projectId: id,
          projectName: project.name as string,
          type: 'analysis_completed',
          message: `Analysis complete — ${report.detectedStack.framework}, ${report.injectionOpportunities.filter(o => o.canInject).length} layers ready to inject`,
          metadata: { pattern: report.pattern },
        });

        send(controller, 'done', { report });
      } catch (err) {
        console.error('[analyze] error:', err);
        await insforge.database.from('projects').update({ status: 'error' }).eq('id', id);
        await logActivity({
          userId: session.user.id,
          projectId: id,
          projectName: project.name as string,
          type: 'analysis_failed',
          message: `Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });

        // Return fallback report so the UI still works
        const fallback = buildFallbackReport();
        send(controller, 'error', { message: err instanceof Error ? err.message : 'Analysis failed', fallback });
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
