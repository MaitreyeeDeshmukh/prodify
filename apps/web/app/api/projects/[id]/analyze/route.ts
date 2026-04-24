import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge } from '@/lib/insforge';
import { logActivity } from '@/lib/activity';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { simpleGit } from 'simple-git';
import { analyzeRepository } from '@prodify/injector/src/ai/analyzer';

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

  // Verify project belongs to user
  const { data: project } = await insforge.database
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('userId', session.user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!project.cloneUrl) return NextResponse.json({ error: 'No repo URL on this project' }, { status: 400 });

  // Get GitHub access token for private repos
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
        await logActivity({ userId: session.user.id, projectId: id, projectName: project.name as string, type: 'analysis_started', message: `Started analyzing ${project.repoFullName ?? project.name}` });

        send(controller, 'progress', { step: 1, total: 4, message: 'Cloning repository...' });

        // Build clone URL with auth token if available
        let cloneUrl = project.cloneUrl as string;
        if (conn?.access_token) {
          cloneUrl = cloneUrl.replace('https://', `https://${conn.access_token}@`);
        }

        const git = simpleGit();
        await git.clone(cloneUrl, tmpDir, ['--depth=1']);

        send(controller, 'progress', { step: 2, total: 4, message: 'Reading project files...' });

        send(controller, 'progress', { step: 3, total: 4, message: 'Analyzing with AI (AWS Bedrock)...' });

        const report = await analyzeRepository(tmpDir);

        send(controller, 'progress', { step: 4, total: 4, message: 'Saving results...' });

        await insforge.database.from('projects').update({ status: 'analyzed', analysisResult: report }).eq('id', id);
        await logActivity({ userId: session.user.id, projectId: id, projectName: project.name as string, type: 'analysis_completed', message: `Analysis complete — ${report.detectedStack.framework}, ${report.injectionOpportunities.filter(o => o.canInject).length} layers ready to inject`, metadata: { pattern: report.pattern } });

        send(controller, 'done', { report });
      } catch (err) {
        console.error('[analyze] error:', err);
        await insforge.database.from('projects').update({ status: 'error' }).eq('id', id);
        await logActivity({ userId: session.user.id, projectId: id, projectName: project.name as string, type: 'analysis_failed', message: `Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
        send(controller, 'error', { message: err instanceof Error ? err.message : 'Analysis failed' });
      } finally {
        // Clean up temp dir
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
