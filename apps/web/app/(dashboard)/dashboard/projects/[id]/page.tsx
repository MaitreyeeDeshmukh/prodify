'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type CodeInsight = {
  category: 'auth' | 'payments' | 'database' | 'architecture' | 'security' | 'performance';
  finding: string;
  evidence: string;
  recommendation: string;
};

type AnalysisReport = {
  detectedStack: {
    framework: string;
    frameworkVersion?: string;
    language: string;
    nodeVersion?: string | null;
    hasAuth: boolean;
    authProvider: string | null;
    authDetails?: string | null;
    hasPayments: boolean;
    paymentsProvider: string | null;
    paymentsDetails?: string | null;
    hasDatabase: boolean;
    dbProvider: string | null;
    dbDetails?: string | null;
    hasCI: boolean;
    ciDetails?: string | null;
    otherDependencies?: string[];
  };
  pattern: string;
  appDescription?: string;
  apiRoutes?: string[];
  codeInsights?: CodeInsight[];
  injectionOpportunities: Array<{
    layer: string;
    canInject: boolean;
    currentState: string;
    proposed: string;
    filesToCreate: string[];
    effort: string;
    gaps?: string[];
    implementation?: string;
    envVarsNeeded?: string[];
  }>;
  conflicts: Array<{
    description: string;
    severity: 'warning' | 'blocker';
    resolution: string;
    affectedFiles?: string[];
  }>;
  summary: string;
  monetizationReadiness?: {
    score: number;
    blockers: string[];
    quickWins: string[];
  };
};

type Project = {
  id: string;
  name: string;
  repoUrl: string | null;
  repoFullName: string | null;
  cloneUrl: string | null;
  defaultBranch: string | null;
  status: string;
  analysisResult: AnalysisReport | null;
  injectionConfig: { pricingModel: string; userType: string; openPR: boolean } | null;
  prUrl: string | null;
  branchName: string | null;
  createdAt: string;
};

type ProgressEvent = { step: number; total: number; message: string };

const LAYER_ICONS: Record<string, string> = {
  auth: '🔐',
  payments: '💳',
  database: '🗄️',
  ci: '⚙️',
  env: '🔑',
};

const EFFORT_COLOR: Record<string, string> = {
  low: 'text-emerald-600 bg-emerald-50',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-red-600 bg-red-50',
};

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Analysis state
  const [analysisProgress, setAnalysisProgress] = useState<ProgressEvent[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  // Injection config
  const [pricingModel, setPricingModel] = useState<'per-seat' | 'flat' | 'usage'>('flat');
  const [userType, setUserType] = useState<'individuals' | 'teams' | 'enterprise'>('individuals');
  const [openPR, setOpenPR] = useState(true);

  // Injection state
  const [injecting, setInjecting] = useState(false);
  const [injectProgress, setInjectProgress] = useState<ProgressEvent[]>([]);
  const [injectError, setInjectError] = useState('');

  // Delete state
  const [deleting, setDeleting] = useState(false);

  // View mode — lets user flip between injection status and analysis report
  const [viewMode, setViewMode] = useState<'status' | 'report'>('status');

  // Re-inject without re-analysis
  const [showReinjecting, setShowReinjecting] = useState(false);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { router.push('/dashboard'); return; }
    const data = await res.json() as { project: Project };
    setProject(data.project);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { void fetchProject(); }, [fetchProject]);

  async function startAnalysis() {
    if (!project) return;
    setAnalyzing(true);
    setAnalysisProgress([]);

    const res = await fetch(`/api/projects/${id}/analyze`, { method: 'POST' });
    if (!res.ok || !res.body) {
      setAnalyzing(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) { eventType = line.slice(7).trim(); }
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (eventType === 'progress') setAnalysisProgress(p => [...p, payload as ProgressEvent]);
            if (eventType === 'done') await fetchProject();
            if (eventType === 'error') console.error('[analysis error]', payload);
          } catch { /* ignore malformed */ }
        }
      }
    }
    setAnalyzing(false);
  }

  async function startInjection() {
    setInjecting(true);
    setInjectProgress([]);
    setInjectError('');

    const res = await fetch(`/api/projects/${id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pricingModel, userType, openPR }),
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: 'Injection failed' })) as { error?: string };
      setInjectError(err.error ?? 'Injection failed');
      setInjecting(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) { eventType = line.slice(7).trim(); }
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (eventType === 'progress') setInjectProgress(p => [...p, payload as ProgressEvent]);
            if (eventType === 'done') await fetchProject();
            if (eventType === 'error') setInjectError((payload as { message?: string }).message ?? 'Injection failed');
          } catch { /* ignore */ }
        }
      }
    }
    setInjecting(false);
  }

  async function deleteProject() {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    setDeleting(true);
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    router.push('/dashboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  const report = project.analysisResult;
  const status = project.status;

  function downloadReport(format: 'markdown' | 'json') {
    if (!report || !project) return;

    let content: string;
    let filename: string;
    let mime: string;

    if (format === 'json') {
      content = JSON.stringify(report, null, 2);
      filename = `prodify-report-${project.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      mime = 'application/json';
    } else {
      const lines: string[] = [];
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      lines.push(`# Prodify Analysis Report — ${project.name}`);
      lines.push(`Generated: ${date}`);
      if (project.repoFullName) lines.push(`Repository: https://github.com/${project.repoFullName}`);
      lines.push('');

      if (report.appDescription) {
        lines.push('## App Description');
        lines.push(report.appDescription);
        lines.push('');
      }

      lines.push('## Summary');
      lines.push(report.summary);
      lines.push('');

      lines.push('## Detected Stack');
      lines.push(`- **Framework:** ${report.detectedStack.framework}${report.detectedStack.frameworkVersion ? ` ${report.detectedStack.frameworkVersion}` : ''}`);
      lines.push(`- **Language:** ${report.detectedStack.language}`);
      if (report.detectedStack.nodeVersion) lines.push(`- **Node:** ${report.detectedStack.nodeVersion}`);
      lines.push(`- **Auth:** ${report.detectedStack.hasAuth ? `${report.detectedStack.authProvider ?? 'yes'}${report.detectedStack.authDetails ? ` — ${report.detectedStack.authDetails}` : ''}` : 'None'}`);
      lines.push(`- **Payments:** ${report.detectedStack.hasPayments ? `${report.detectedStack.paymentsProvider ?? 'yes'}${report.detectedStack.paymentsDetails ? ` — ${report.detectedStack.paymentsDetails}` : ''}` : 'None'}`);
      lines.push(`- **Database:** ${report.detectedStack.hasDatabase ? `${report.detectedStack.dbProvider ?? 'yes'}${report.detectedStack.dbDetails ? ` — ${report.detectedStack.dbDetails}` : ''}` : 'None'}`);
      lines.push(`- **CI:** ${report.detectedStack.hasCI ? report.detectedStack.ciDetails ?? 'yes' : 'None'}`);
      if (report.detectedStack.otherDependencies?.length) {
        lines.push(`- **Other deps:** ${report.detectedStack.otherDependencies.join(', ')}`);
      }
      lines.push('');

      if (report.monetizationReadiness) {
        lines.push(`## Monetization Readiness: ${report.monetizationReadiness.score}/100`);
        if (report.monetizationReadiness.blockers.length) {
          lines.push('');
          lines.push('### Blockers');
          report.monetizationReadiness.blockers.forEach(b => lines.push(`- ${b}`));
        }
        if (report.monetizationReadiness.quickWins.length) {
          lines.push('');
          lines.push('### Quick wins');
          report.monetizationReadiness.quickWins.forEach(w => lines.push(`- ${w}`));
        }
        lines.push('');
      }

      if (report.codeInsights?.length) {
        lines.push('## Code Findings');
        report.codeInsights.forEach(insight => {
          lines.push('');
          lines.push(`### ${insight.category.charAt(0).toUpperCase() + insight.category.slice(1)}: ${insight.finding}`);
          lines.push(`**Evidence:** \`${insight.evidence}\``);
          lines.push(`**Recommendation:** ${insight.recommendation}`);
        });
        lines.push('');
      }

      if (report.apiRoutes?.length) {
        lines.push('## API Routes Found');
        report.apiRoutes.forEach(r => lines.push(`- \`${r}\``));
        lines.push('');
      }

      if (report.conflicts.length) {
        lines.push('## Conflicts');
        report.conflicts.forEach(c => {
          lines.push('');
          lines.push(`### ${c.severity === 'blocker' ? '🚫' : '⚠️'} ${c.description}`);
          lines.push(`**Severity:** ${c.severity}`);
          lines.push(`**Resolution:** ${c.resolution}`);
          if (c.affectedFiles?.length) lines.push(`**Affected files:** ${c.affectedFiles.map(f => `\`${f}\``).join(', ')}`);
        });
        lines.push('');
      }

      lines.push('## Injection Opportunities');
      report.injectionOpportunities.forEach(opp => {
        lines.push('');
        lines.push(`### ${opp.layer.charAt(0).toUpperCase() + opp.layer.slice(1)} (${opp.effort} effort)`);
        lines.push(`**Current:** ${opp.currentState}`);
        lines.push(`**After injection:** ${opp.proposed}`);
        if (opp.gaps?.length) {
          lines.push('**Gaps:**');
          opp.gaps.forEach(g => lines.push(`- ${g}`));
        }
        if (opp.implementation) {
          lines.push(`**Implementation:** ${opp.implementation}`);
        }
        if (opp.filesToCreate.length) {
          lines.push(`**Files to create:** ${opp.filesToCreate.map(f => `\`${f}\``).join(', ')}`);
        }
        if (opp.envVarsNeeded?.length) {
          lines.push(`**Env vars needed:** ${opp.envVarsNeeded.map(v => `\`${v}\``).join(', ')}`);
        }
      });
      lines.push('');
      lines.push('---');
      lines.push('*Generated by [Prodify](https://prodify.dev)*');

      content = lines.join('\n');
      filename = `prodify-report-${project.name.replace(/\s+/g, '-').toLowerCase()}.md`;
      mime = 'text/markdown';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Shared report JSX — rendered in both 'analyzed' and 'injected' (report tab) states
  const reportContent = report ? (
    <div className="space-y-6">
      {/* Summary + monetization score */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-semibold text-gray-900">Analysis report</h2>
              {/* Download buttons */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => downloadReport('markdown')}
                  title="Download as Markdown"
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  .md
                </button>
                <button
                  onClick={() => downloadReport('json')}
                  title="Download as JSON"
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  .json
                </button>
              </div>
            </div>
            {report.appDescription && (
              <p className="text-sm text-gray-500 mb-3 italic">{report.appDescription}</p>
            )}
            <p className="text-sm text-gray-700">{report.summary}</p>
          </div>
          {report.monetizationReadiness && (
            <div className="shrink-0 text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                report.monetizationReadiness.score >= 70 ? 'bg-emerald-50 text-emerald-700' :
                report.monetizationReadiness.score >= 40 ? 'bg-amber-50 text-amber-700' :
                'bg-red-50 text-red-700'
              }`}>
                {report.monetizationReadiness.score}
              </div>
              <p className="text-xs text-gray-400 mt-1">Monetization<br/>readiness</p>
            </div>
          )}
        </div>

        {/* Stack badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <StackBadge label={`${report.detectedStack.framework}${report.detectedStack.frameworkVersion ? ` ${report.detectedStack.frameworkVersion}` : ''}`} />
          <StackBadge label={report.detectedStack.language.toUpperCase()} />
          {report.detectedStack.authProvider && <StackBadge label={`Auth: ${report.detectedStack.authProvider}`} color="amber" />}
          {report.detectedStack.dbProvider && <StackBadge label={`DB: ${report.detectedStack.dbProvider}`} color="amber" />}
          {report.detectedStack.paymentsProvider && <StackBadge label={`Payments: ${report.detectedStack.paymentsProvider}`} color="amber" />}
          {!report.detectedStack.hasAuth && <StackBadge label="No auth" color="red" />}
          {!report.detectedStack.hasPayments && <StackBadge label="No payments" color="red" />}
          {!report.detectedStack.hasDatabase && <StackBadge label="No database" color="red" />}
          {report.detectedStack.otherDependencies?.map(dep => (
            <StackBadge key={dep} label={dep} color="gray" />
          ))}
        </div>

        {/* Stack detail lines */}
        {(report.detectedStack.authDetails || report.detectedStack.paymentsDetails || report.detectedStack.dbDetails) && (
          <div className="space-y-1 mb-3">
            {report.detectedStack.authDetails && (
              <p className="text-xs text-gray-500 flex gap-1.5"><span className="text-blue-400 shrink-0">🔐</span>{report.detectedStack.authDetails}</p>
            )}
            {report.detectedStack.paymentsDetails && (
              <p className="text-xs text-gray-500 flex gap-1.5"><span className="text-emerald-400 shrink-0">💳</span>{report.detectedStack.paymentsDetails}</p>
            )}
            {report.detectedStack.dbDetails && (
              <p className="text-xs text-gray-500 flex gap-1.5"><span className="text-violet-400 shrink-0">🗄️</span>{report.detectedStack.dbDetails}</p>
            )}
          </div>
        )}

        {/* Monetization blockers + quick wins */}
        {report.monetizationReadiness && (
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-50">
            <div>
              <p className="text-xs font-semibold text-red-600 mb-2">🚧 Blockers before monetizing</p>
              <ul className="space-y-1">
                {report.monetizationReadiness.blockers.map((b, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                    <span className="text-red-400 shrink-0">•</span>{b}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-600 mb-2">⚡ Quick wins Prodify can inject</p>
              <ul className="space-y-1">
                {report.monetizationReadiness.quickWins.map((w, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                    <span className="text-emerald-400 shrink-0">•</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Conflicts / warnings */}
      {report.conflicts.length > 0 && (
        <div className="space-y-2">
          {report.conflicts.map((c, i) => (
            <div
              key={i}
              className={`rounded-xl p-4 flex gap-3 ${c.severity === 'blocker' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}
            >
              <span className="text-lg shrink-0">{c.severity === 'blocker' ? '🚫' : '⚠️'}</span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${c.severity === 'blocker' ? 'text-red-800' : 'text-amber-800'}`}>{c.description}</p>
                <p className={`text-xs mt-0.5 ${c.severity === 'blocker' ? 'text-red-600' : 'text-amber-600'}`}>Resolution: {c.resolution}</p>
                {c.affectedFiles && c.affectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.affectedFiles.map(f => (
                      <code key={f} className="text-xs bg-white border border-red-200 text-red-700 px-1.5 py-0.5 rounded">{f}</code>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Code Insights */}
      {report.codeInsights && report.codeInsights.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Code findings</h3>
          <div className="space-y-3">
            {report.codeInsights.map((insight, i) => {
              const categoryColor: Record<string, string> = {
                auth: 'bg-blue-50 border-blue-200 text-blue-700',
                payments: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                database: 'bg-violet-50 border-violet-200 text-violet-700',
                security: 'bg-red-50 border-red-200 text-red-700',
                performance: 'bg-amber-50 border-amber-200 text-amber-700',
                architecture: 'bg-gray-50 border-gray-200 text-gray-700',
              };
              const categoryIcon: Record<string, string> = {
                auth: '🔐', payments: '💳', database: '🗄️',
                security: '🛡️', performance: '⚡', architecture: '🏗️',
              };
              const colorClass = categoryColor[insight.category] ?? categoryColor.architecture;
              return (
                <div key={i} className={`rounded-xl border p-4 ${colorClass}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0">{categoryIcon[insight.category] ?? '🔍'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5">{insight.finding}</p>
                      <p className="text-xs opacity-80 font-mono mb-1.5 truncate">{insight.evidence}</p>
                      <p className="text-xs opacity-90">{insight.recommendation}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* API Routes discovered */}
      {report.apiRoutes && report.apiRoutes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">
            API routes found
            <span className="ml-2 text-xs font-normal text-gray-400">({report.apiRoutes.length} total)</span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {report.apiRoutes.map(route => (
              <code key={route} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg">
                {route}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Injection opportunities */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">What was / will be injected</h3>
        {report.injectionOpportunities.map((opp, i) => (
          <div key={i} className={`bg-white rounded-2xl border p-5 ${opp.canInject ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{LAYER_ICONS[opp.layer] ?? '📦'}</span>
              <span className="font-semibold text-gray-900 capitalize">{opp.layer}</span>
              <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${EFFORT_COLOR[opp.effort] ?? 'text-gray-600 bg-gray-100'}`}>
                {opp.effort} effort
              </span>
              {opp.canInject
                ? <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">✓ Will inject</span>
                : <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">Already present</span>
              }
            </div>
            <div className="flex items-start gap-2 text-xs mb-3 p-3 bg-gray-50 rounded-xl">
              <div className="flex-1">
                <p className="text-gray-400 font-medium mb-0.5">CURRENT</p>
                <p className="text-gray-600">{opp.currentState}</p>
              </div>
              <span className="text-gray-300 mt-4">→</span>
              <div className="flex-1">
                <p className="text-violet-500 font-medium mb-0.5">AFTER INJECTION</p>
                <p className="text-gray-700">{opp.proposed}</p>
              </div>
            </div>
            {opp.gaps && opp.gaps.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Missing pieces</p>
                <ul className="space-y-1">
                  {opp.gaps.map((gap, j) => (
                    <li key={j} className="text-xs text-gray-600 flex gap-1.5">
                      <span className="text-red-400 shrink-0">✗</span>{gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {opp.implementation && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">What Prodify will build</p>
                <p className="text-xs text-gray-600 leading-relaxed">{opp.implementation}</p>
              </div>
            )}
            {opp.filesToCreate.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Files that will be created</p>
                <div className="flex flex-wrap gap-1">
                  {opp.filesToCreate.map(f => (
                    <code key={f} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{f}</code>
                  ))}
                </div>
              </div>
            )}
            {opp.envVarsNeeded && opp.envVarsNeeded.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Env vars you'll need to add</p>
                <div className="flex flex-wrap gap-1">
                  {opp.envVarsNeeded.map(v => (
                    <code key={v} className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded">{v}</code>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← All projects
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{project.name}</h1>
          {project.repoFullName && (
            <a
              href={project.repoUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-violet-600 hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              {project.repoFullName}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            onClick={() => void deleteProject()}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Delete project"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* PENDING — needs analysis */}
      {(status === 'pending' || status === 'draft') && !analyzing && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🔍</div>
          <h2 className="font-semibold text-gray-900 mb-2">Ready to analyze</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Prodify will clone your repo and use AWS Bedrock (Claude) to detect your stack, find missing infrastructure, and plan exactly what to inject.
          </p>
          <Button
            onClick={() => void startAnalysis()}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            Analyze repository
          </Button>
        </div>
      )}

      {/* ANALYZING — progress stream */}
      {(status === 'analyzing' || analyzing) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <h2 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            Analyzing repository...
          </h2>
          <div className="space-y-3">
            {[
              { n: 1, label: 'Cloning repository' },
              { n: 2, label: 'Reading project files' },
              { n: 3, label: 'Analyzing with AI (AWS Bedrock)' },
              { n: 4, label: 'Saving results' },
            ].map(({ n, label }) => {
              const done = analysisProgress.some(p => p.step >= n);
              const active = analysisProgress.some(p => p.step === n);
              return (
                <div key={n} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`text-sm ${done ? 'text-gray-700' : active ? 'text-violet-700 font-medium' : 'text-gray-400'}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ANALYZED — report + config form */}
      {status === 'analyzed' && report && !injecting && (
        <div className="space-y-6">
          {reportContent}

          {/* Config form */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Configure injection</h3>
            <div className="space-y-5">
              <OptionGroup
                label="Pricing model"
                options={[
                  { value: 'flat', label: 'Flat rate', desc: 'Single subscription price' },
                  { value: 'per-seat', label: 'Per seat', desc: 'Charge per user/seat' },
                  { value: 'usage', label: 'Usage-based', desc: 'Metered billing' },
                ]}
                value={pricingModel}
                onChange={v => setPricingModel(v as typeof pricingModel)}
              />
              <OptionGroup
                label="User type"
                options={[
                  { value: 'individuals', label: 'Individuals', desc: 'Single-user accounts' },
                  { value: 'teams', label: 'Teams', desc: 'Orgs + memberships' },
                  { value: 'enterprise', label: 'Enterprise', desc: 'Teams + SAML SSO' },
                ]}
                value={userType}
                onChange={v => setUserType(v as typeof userType)}
              />
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">After injection</p>
                <div className="flex gap-3">
                  {[
                    { v: true, label: 'Open a PR to main', desc: 'Recommended — review before merge' },
                    { v: false, label: 'Push branch only', desc: 'You\'ll open the PR manually' },
                  ].map(opt => (
                    <button
                      key={String(opt.v)}
                      onClick={() => setOpenPR(opt.v)}
                      className={`flex-1 rounded-xl border p-3 text-left transition-all ${
                        openPR === opt.v
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Branch: <code className="font-mono">prodify/inject-{'<timestamp>'}</code>
              </p>
              <Button
                onClick={() => void startInjection()}
                className="bg-violet-600 hover:bg-violet-700 text-white"
                disabled={report.conflicts.some(c => c.severity === 'blocker')}
              >
                Inject now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* INJECTING — progress stream */}
      {injecting && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <h2 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            Injecting infrastructure...
          </h2>
          <div className="space-y-3">
            {injectProgress.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">✓</div>
                <span className="text-sm text-gray-700">{p.message}</span>
              </div>
            ))}
            {injectProgress.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <div className="w-3 h-3 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <span className="text-sm text-violet-700 font-medium">Working...</span>
              </div>
            )}
          </div>
          {injectError && <p className="text-sm text-red-600 mt-4">{injectError}</p>}
        </div>
      )}

      {/* INJECTED — tabbed: Status | Analysis Report */}
      {status === 'injected' && !injecting && (
        <div className="space-y-6">
          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {([
              { key: 'status', label: '🎉 Injection status' },
              { key: 'report', label: '🔍 Analysis report' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  viewMode === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status tab */}
          {viewMode === 'status' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🎉</span>
                  <h2 className="font-semibold text-emerald-900">Infrastructure injected successfully</h2>
                </div>
                <p className="text-sm text-emerald-700 mb-4">
                  Auth, payments, and database infrastructure have been injected and pushed to GitHub.
                </p>
                {project.prUrl && (
                  <a
                    href={project.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white border border-emerald-300 text-emerald-800 text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    View PR on GitHub →
                  </a>
                )}
                {project.branchName && (
                  <p className="text-xs text-emerald-600 mt-2">
                    Branch: <code className="font-mono">{project.branchName}</code>
                  </p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Next steps</h3>
                <ol className="space-y-3">
                  {[
                    'Review the PR — check every file before merging',
                    'Add env vars from README-prodify.md to your .env.local',
                    'Run the SQL schema / migration from prodify-layer/db/schema.sql',
                    'Merge the PR to main',
                    'Set up Stripe webhook: stripe listen --forward-to localhost:3000/api/webhooks/stripe',
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                      <span className="w-5 h-5 rounded border border-gray-300 shrink-0 mt-0.5" />
                      {text}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Re-inject config — shown inline without re-running analysis */}
              {showReinjecting && (
                <div className="bg-white rounded-2xl border border-violet-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Re-inject with new config</h3>
                    <button
                      onClick={() => setShowReinjecting(false)}
                      className="text-gray-400 hover:text-gray-600 text-sm"
                    >
                      ✕ Cancel
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">
                    Uses the existing analysis — no re-scan needed. Creates a new branch on GitHub.
                  </p>
                  <div className="space-y-5">
                    <OptionGroup
                      label="Pricing model"
                      options={[
                        { value: 'flat', label: 'Flat rate', desc: 'Single subscription price' },
                        { value: 'per-seat', label: 'Per seat', desc: 'Charge per user/seat' },
                        { value: 'usage', label: 'Usage-based', desc: 'Metered billing' },
                      ]}
                      value={pricingModel}
                      onChange={v => setPricingModel(v as typeof pricingModel)}
                    />
                    <OptionGroup
                      label="User type"
                      options={[
                        { value: 'individuals', label: 'Individuals', desc: 'Single-user accounts' },
                        { value: 'teams', label: 'Teams', desc: 'Orgs + memberships' },
                        { value: 'enterprise', label: 'Enterprise', desc: 'Teams + SAML SSO' },
                      ]}
                      value={userType}
                      onChange={v => setUserType(v as typeof userType)}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">After injection</p>
                      <div className="flex gap-3">
                        {[
                          { v: true, label: 'Open a PR to main', desc: 'Recommended — review before merge' },
                          { v: false, label: 'Push branch only', desc: "You'll open the PR manually" },
                        ].map(opt => (
                          <button
                            key={String(opt.v)}
                            onClick={() => setOpenPR(opt.v)}
                            className={`flex-1 rounded-xl border p-3 text-left transition-all ${
                              openPR === opt.v
                                ? 'border-violet-500 bg-violet-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Branch: <code className="font-mono">prodify/inject-{'<timestamp>'}</code>
                    </p>
                    <Button
                      onClick={() => { setShowReinjecting(false); void startInjection(); }}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      Inject now
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 flex-wrap">
                {!showReinjecting && (
                  <Button
                    onClick={() => setShowReinjecting(true)}
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    Re-inject
                  </Button>
                )}
                <Button variant="outline" onClick={() => void startAnalysis()}>
                  Re-analyze
                </Button>
                {report && (
                  <Button variant="outline" onClick={() => setViewMode('report')}>
                    View analysis report
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Analysis report tab */}
          {viewMode === 'report' && (
            <div className="space-y-6">
              {reportContent}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setViewMode('status')}>
                  ← Back to status
                </Button>
                <Button variant="outline" onClick={() => void startAnalysis()}>
                  Re-analyze
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ERROR */}
      {status === 'error' && !analyzing && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h2 className="font-semibold text-red-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-red-600 mb-4">The analysis or injection failed. Check your GitHub connection and try again.</p>
          <Button onClick={() => void startAnalysis()} className="bg-red-600 hover:bg-red-700 text-white">
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    draft:     { label: 'Draft',     classes: 'bg-gray-100 text-gray-500' },
    pending:   { label: 'Pending',   classes: 'bg-amber-100 text-amber-700' },
    analyzing: { label: 'Analyzing', classes: 'bg-blue-100 text-blue-700' },
    analyzed:  { label: 'Ready',     classes: 'bg-violet-100 text-violet-700' },
    injecting: { label: 'Injecting', classes: 'bg-blue-100 text-blue-700' },
    injected:  { label: 'Injected',  classes: 'bg-emerald-100 text-emerald-700' },
    error:     { label: 'Error',     classes: 'bg-red-100 text-red-700' },
  };
  const cfg = map[status] ?? map.draft;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

function StackBadge({ label, color = 'gray' }: { label: string; color?: 'gray' | 'amber' | 'red' }) {
  const classes = {
    gray: 'bg-gray-100 text-gray-600',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${classes[color]}`}>{label}</span>
  );
}

function OptionGroup({
  label, options, value, onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string; desc: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex gap-3">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-xl border p-3 text-left transition-all ${
              value === opt.value
                ? 'border-violet-500 bg-violet-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-sm font-medium text-gray-900">{opt.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
