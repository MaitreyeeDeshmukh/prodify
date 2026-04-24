'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

const EFFORT_COLOR: Record<string, { color: string; bg: string }> = {
  low:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
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
  // ── Injection config — all ProdifyAnswers fields ─────────────────────────────
  const [pricingModel, setPricingModel] = useState<'flat' | 'per-seat' | 'usage' | 'hybrid' | 'one-time' | 'credits'>('flat');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [onboardingFlow, setOnboardingFlow] = useState<'pay-upfront' | 'trial-card' | 'trial-no-card' | 'freemium'>('pay-upfront');
  const [trialDays, setTrialDays] = useState(14);
  const [userType, setUserType] = useState<'individuals' | 'teams' | 'enterprise'>('individuals');
  const [authMethods, setAuthMethods] = useState<string[]>(['google', 'github']);
  const [deployTarget, setDeployTarget] = useState<'vercel' | 'railway' | 'fly' | 'aws' | 'none'>('vercel');
  const [complianceRegion, setComplianceRegion] = useState<'global' | 'eu-gdpr' | 'us'>('global');
  const [openPR, setOpenPR] = useState(true);

  const showBillingInterval = pricingModel !== 'one-time' && pricingModel !== 'credits';
  const showTrial = onboardingFlow === 'trial-card' || onboardingFlow === 'trial-no-card';

  function toggleAuthMethod(method: string) {
    setAuthMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method],
    );
  }

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
      body: JSON.stringify({
        pricingModel,
        billingInterval: showBillingInterval ? billingInterval : 'monthly',
        onboardingFlow,
        trialDays: showTrial ? trialDays : undefined,
        userType,
        authMethods,
        emailProvider: 'resend',
        deployTarget,
        complianceRegion,
        openPR,
      }),
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
        <div
          className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#575efe', borderTopColor: 'transparent' }}
        />
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
      <div className="p-6" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-semibold" style={{ color: '#e3f4f8' }}>Analysis report</h2>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => downloadReport('markdown')}
                  title="Download as Markdown"
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: '#8589b2', background: 'rgba(255,255,255,0.04)', border: '1px solid #323779' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e3f4f8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8589b2'; }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  .md
                </button>
                <button
                  onClick={() => downloadReport('json')}
                  title="Download as JSON"
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: '#8589b2', background: 'rgba(255,255,255,0.04)', border: '1px solid #323779' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e3f4f8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8589b2'; }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  .json
                </button>
              </div>
            </div>
            {report.appDescription && (
              <p className="text-sm mb-3 italic" style={{ color: '#8589b2' }}>{report.appDescription}</p>
            )}
            <p className="text-sm" style={{ color: '#e3f4f8' }}>{report.summary}</p>
          </div>
          {report.monetizationReadiness && (
            <div className="shrink-0 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black"
                style={{
                  fontFamily: 'var(--font-unbounded)',
                  background: report.monetizationReadiness.score >= 70 ? 'rgba(16,185,129,0.15)' : report.monetizationReadiness.score >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  color: report.monetizationReadiness.score >= 70 ? '#10b981' : report.monetizationReadiness.score >= 40 ? '#f59e0b' : '#ef4444',
                  border: `1px solid ${report.monetizationReadiness.score >= 70 ? 'rgba(16,185,129,0.3)' : report.monetizationReadiness.score >= 40 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}
              >
                {report.monetizationReadiness.score}
              </div>
              <p className="text-xs mt-1" style={{ color: '#8589b2' }}>Monetization<br/>readiness</p>
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

        {(report.detectedStack.authDetails || report.detectedStack.paymentsDetails || report.detectedStack.dbDetails) && (
          <div className="space-y-1 mb-3">
            {report.detectedStack.authDetails && (
              <p className="text-xs flex gap-1.5" style={{ color: '#8589b2' }}><span className="shrink-0">🔐</span>{report.detectedStack.authDetails}</p>
            )}
            {report.detectedStack.paymentsDetails && (
              <p className="text-xs flex gap-1.5" style={{ color: '#8589b2' }}><span className="shrink-0">💳</span>{report.detectedStack.paymentsDetails}</p>
            )}
            {report.detectedStack.dbDetails && (
              <p className="text-xs flex gap-1.5" style={{ color: '#8589b2' }}><span className="shrink-0">🗄️</span>{report.detectedStack.dbDetails}</p>
            )}
          </div>
        )}

        {report.monetizationReadiness && (
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid #1a1b2e' }}>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#ef4444' }}>🚧 Blockers before monetizing</p>
              <ul className="space-y-1">
                {report.monetizationReadiness.blockers.map((b, i) => (
                  <li key={i} className="text-xs flex gap-1.5" style={{ color: '#8589b2' }}>
                    <span style={{ color: '#ef4444' }} className="shrink-0">•</span>{b}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#10b981' }}>⚡ Quick wins Prodify can inject</p>
              <ul className="space-y-1">
                {report.monetizationReadiness.quickWins.map((w, i) => (
                  <li key={i} className="text-xs flex gap-1.5" style={{ color: '#8589b2' }}>
                    <span style={{ color: '#10b981' }} className="shrink-0">•</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Conflicts */}
      {report.conflicts.length > 0 && (
        <div className="space-y-2">
          {report.conflicts.map((c, i) => (
            <div
              key={i}
              className="rounded-xl p-4 flex gap-3"
              style={c.severity === 'blocker' ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' } : { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <span className="text-lg shrink-0">{c.severity === 'blocker' ? '🚫' : '⚠️'}</span>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: c.severity === 'blocker' ? '#ef4444' : '#f59e0b' }}>{c.description}</p>
                <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>Resolution: {c.resolution}</p>
                {c.affectedFiles && c.affectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.affectedFiles.map(f => (
                      <code key={f} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: 'var(--font-geist-mono)' }}>{f}</code>
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
        <div className="p-6" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}>
          <h3 className="font-semibold mb-4" style={{ color: '#e3f4f8' }}>Code findings</h3>
          <div className="space-y-3">
            {report.codeInsights.map((insight, i) => {
              const categoryStyle: Record<string, { bg: string; border: string; color: string }> = {
                auth:         { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.3)',  color: '#3b82f6' },
                payments:     { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)',  color: '#10b981' },
                database:     { bg: 'rgba(87,94,254,0.08)',   border: 'rgba(87,94,254,0.3)',   color: '#575efe' },
                security:     { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',   color: '#ef4444' },
                performance:  { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)',  color: '#f59e0b' },
                architecture: { bg: 'rgba(133,137,178,0.08)', border: 'rgba(133,137,178,0.3)', color: '#8589b2' },
              };
              const categoryIcon: Record<string, string> = {
                auth: '🔐', payments: '💳', database: '🗄️',
                security: '🛡️', performance: '⚡', architecture: '🏗️',
              };
              const style = categoryStyle[insight.category] ?? categoryStyle.architecture;
              return (
                <div key={i} className="rounded-xl border p-4" style={{ background: style.bg, borderColor: style.border }}>
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0">{categoryIcon[insight.category] ?? '🔍'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5" style={{ color: style.color }}>{insight.finding}</p>
                      <p className="text-xs mb-1.5 truncate" style={{ color: '#8589b2', fontFamily: 'var(--font-geist-mono)' }}>{insight.evidence}</p>
                      <p className="text-xs" style={{ color: '#e3f4f8' }}>{insight.recommendation}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* API Routes */}
      {report.apiRoutes && report.apiRoutes.length > 0 && (
        <div className="p-6" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}>
          <h3 className="font-semibold mb-3" style={{ color: '#e3f4f8' }}>
            API routes found
            <span className="ml-2 text-xs font-normal" style={{ color: '#8589b2' }}>({report.apiRoutes.length} total)</span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {report.apiRoutes.map(route => (
              <code key={route} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(87,94,254,0.08)', border: '1px solid rgba(87,94,254,0.2)', color: '#00d7ff', fontFamily: 'var(--font-geist-mono)' }}>
                {route}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Injection opportunities */}
      <div className="space-y-4">
        <h3 className="font-semibold" style={{ color: '#e3f4f8' }}>What was / will be injected</h3>
        {report.injectionOpportunities.map((opp, i) => {
          const effortStyle = EFFORT_COLOR[opp.effort] ?? EFFORT_COLOR.medium;
          return (
            <div key={i} className="p-5" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem', opacity: opp.canInject ? 1 : 0.6 }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{LAYER_ICONS[opp.layer] ?? '📦'}</span>
                <span className="font-semibold capitalize" style={{ color: '#e3f4f8' }}>{opp.layer}</span>
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: effortStyle.color, background: effortStyle.bg }}>
                  {opp.effort} effort
                </span>
                {opp.canInject
                  ? <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: '#10b981', background: 'rgba(16,185,129,0.12)' }}>✓ Will inject</span>
                  : <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#8589b2', background: 'rgba(133,137,178,0.1)' }}>Already present</span>
                }
              </div>
              <div className="flex items-start gap-2 text-xs mb-3 p-3 rounded-xl" style={{ background: 'rgba(3,7,18,0.6)', border: '1px solid #1a1b2e' }}>
                <div className="flex-1">
                  <p className="font-medium mb-0.5" style={{ color: '#8589b2', fontFamily: 'var(--font-geist-mono)' }}>CURRENT</p>
                  <p style={{ color: '#8589b2' }}>{opp.currentState}</p>
                </div>
                <span className="mt-4" style={{ color: '#323779' }}>→</span>
                <div className="flex-1">
                  <p className="font-medium mb-0.5" style={{ color: '#575efe', fontFamily: 'var(--font-geist-mono)' }}>AFTER INJECTION</p>
                  <p style={{ color: '#e3f4f8' }}>{opp.proposed}</p>
                </div>
              </div>
              {opp.gaps && opp.gaps.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold mb-1.5" style={{ color: '#8589b2' }}>Missing pieces</p>
                  <ul className="space-y-1">
                    {opp.gaps.map((gap, j) => (
                      <li key={j} className="text-xs flex gap-1.5" style={{ color: '#8589b2' }}>
                        <span style={{ color: '#ef4444' }} className="shrink-0">✗</span>{gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {opp.implementation && (
                <div className="mb-3">
                  <p className="text-xs font-semibold mb-1.5" style={{ color: '#8589b2' }}>What Prodify will build</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#e3f4f8' }}>{opp.implementation}</p>
                </div>
              )}
              {opp.filesToCreate.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold mb-1.5" style={{ color: '#8589b2' }}>Files that will be created</p>
                  <div className="flex flex-wrap gap-1">
                    {opp.filesToCreate.map(f => (
                      <code key={f} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(87,94,254,0.08)', border: '1px solid rgba(87,94,254,0.2)', color: '#00d7ff', fontFamily: 'var(--font-geist-mono)' }}>{f}</code>
                    ))}
                  </div>
                </div>
              )}
              {opp.envVarsNeeded && opp.envVarsNeeded.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: '#8589b2' }}>Env vars you&apos;ll need to add</p>
                  <div className="flex flex-wrap gap-1">
                    {opp.envVarsNeeded.map(v => (
                      <code key={v} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontFamily: 'var(--font-geist-mono)' }}>{v}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm transition-colors" style={{ color: '#00d7ff' }}>
          ← All projects
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-black mb-1"
            style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
          >
            {project.name}
          </h1>
          {project.repoFullName && (
            <a
              href={project.repoUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm flex items-center gap-1 transition-colors"
              style={{ color: '#00d7ff' }}
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
            className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ color: '#8589b2' }}
            title="Delete project"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8589b2'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* PENDING — needs analysis */}
      {(status === 'pending' || status === 'draft') && !analyzing && (
        <div className="p-8 text-center" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
            style={{ background: 'rgba(87,94,254,0.1)', border: '1px solid rgba(87,94,254,0.3)' }}
          >
            🔍
          </div>
          <h2 className="font-semibold mb-2" style={{ color: '#e3f4f8' }}>Ready to analyze</h2>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#8589b2' }}>
            Prodify will clone your repo and use AWS Bedrock (Claude) to detect your stack, find missing infrastructure, and plan exactly what to inject.
          </p>
          <button
            onClick={() => void startAnalysis()}
            className="py-2.5 px-6 rounded-full font-semibold text-sm transition-all duration-200"
            style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)'; }}
          >
            Analyze repository
          </button>
        </div>
      )}

      {/* ANALYZING — progress stream */}
      {(status === 'analyzing' || analyzing) && (
        <div className="p-8" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}>
          <h2 className="font-semibold mb-6 flex items-center gap-2" style={{ color: '#e3f4f8' }}>
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#575efe', borderTopColor: 'transparent' }} />
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
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={
                      done
                        ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
                        : active
                        ? { background: 'rgba(87,94,254,0.15)', color: '#575efe', border: '1px solid rgba(87,94,254,0.3)' }
                        : { background: 'rgba(133,137,178,0.1)', color: '#8589b2', border: '1px solid #1a1b2e' }
                    }
                  >
                    {done ? '✓' : n}
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: done ? '#e3f4f8' : active ? '#575efe' : '#8589b2', fontWeight: active ? 500 : 400 }}
                  >
                    {label}
                  </span>
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
          <div className="p-6" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}>
            <h3 className="font-semibold mb-1" style={{ color: '#e3f4f8' }}>Configure injection</h3>
            {/* Trust badge */}
            <p className="text-xs mb-5" style={{ color: '#8589b2', borderBottom: '1px solid #1a1b2e', paddingBottom: '12px' }}>
              🔒 We inject code. Your Stripe handles payments. We never see your keys or customer data.
            </p>
            <div className="space-y-6">

              {/* Pricing model — 6 options */}
              <OptionGroup
                label="How do you charge?"
                options={[
                  { value: 'flat',       label: 'Flat subscription',   desc: 'One price / month or year' },
                  { value: 'per-seat',   label: 'Per seat',            desc: 'Charge per user / team member' },
                  { value: 'usage',      label: 'Usage-based',         desc: 'Metered — charge per API call or event' },
                  { value: 'hybrid',     label: 'Flat + overages',     desc: 'Base subscription + usage charges (e.g. Vercel)' },
                  { value: 'one-time',   label: 'One-time payment',    desc: 'Lifetime deal, template, or course' },
                  { value: 'credits',    label: 'Credits / token pool', desc: 'Users buy credits upfront, spend on AI calls' },
                ]}
                value={pricingModel}
                onChange={v => setPricingModel(v as typeof pricingModel)}
              />

              {/* Billing interval (hidden for one-time and credits) */}
              {showBillingInterval && (
                <OptionGroup
                  label="Billing interval"
                  options={[
                    { value: 'monthly', label: 'Monthly only', desc: 'Single Stripe price ID' },
                    { value: 'annual',  label: 'Monthly + Annual', desc: 'Two price IDs — annual typically 15–20% off' },
                  ]}
                  value={billingInterval}
                  onChange={v => setBillingInterval(v as typeof billingInterval)}
                />
              )}

              {/* Onboarding flow */}
              <OptionGroup
                label="How do users start?"
                options={[
                  { value: 'pay-upfront',   label: 'Pay upfront',         desc: 'Must pay before getting access' },
                  { value: 'trial-card',    label: 'Free trial (card)',    desc: 'N days free, card required' },
                  { value: 'trial-no-card', label: 'Free trial (no card)', desc: 'N days free, no card — higher signups' },
                  { value: 'freemium',      label: 'Freemium',            desc: 'Always free up to a limit, pay to unlock more' },
                ]}
                value={onboardingFlow}
                onChange={v => setOnboardingFlow(v as typeof onboardingFlow)}
              />

              {/* Trial days (conditional) */}
              {showTrial && (
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: '#e3f4f8' }}>Trial length (days)</p>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={trialDays}
                    onChange={e => setTrialDays(Number(e.target.value))}
                    className="w-24 px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(27,30,61,0.8)', border: '1px solid #323779', color: '#e3f4f8' }}
                  />
                  <p className="text-xs mt-1" style={{ color: '#8589b2' }}>Injected as STRIPE_FREE_TRIAL_DAYS env key</p>
                </div>
              )}

              {/* User type */}
              <OptionGroup
                label="Who are your users?"
                options={[
                  { value: 'individuals', label: 'Single users',       desc: 'One account per person, no teams' },
                  { value: 'teams',       label: 'Companies / teams',  desc: 'Multiple people share one account' },
                  { value: 'enterprise',  label: 'Enterprise (SSO)',   desc: 'SAML/SSO, admin controls, audit logs' },
                ]}
                value={userType}
                onChange={v => setUserType(v as typeof userType)}
              />

              {/* Auth methods — multi-select checkboxes */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: '#e3f4f8' }}>Login methods</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'google',     label: 'Google OAuth',      desc: 'Best for consumer apps' },
                    { value: 'github',     label: 'GitHub OAuth',      desc: 'Best for developer tools' },
                    { value: 'magic-link', label: 'Magic link',        desc: 'Passwordless — higher conversion' },
                    { value: 'email-pass', label: 'Email + password',  desc: 'Classic credentials' },
                    ...(userType === 'enterprise'
                      ? [{ value: 'saml', label: 'SAML / SSO', desc: 'Okta, Azure AD, Google Workspace' }]
                      : []),
                  ] as { value: string; label: string; desc: string }[]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => toggleAuthMethod(opt.value)}
                      className="rounded-xl p-3 text-left transition-all"
                      style={
                        authMethods.includes(opt.value)
                          ? { border: '1px solid #575efe', background: 'rgba(87,94,254,0.1)' }
                          : { border: '1px solid #323779', background: 'transparent' }
                      }
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            border: authMethods.includes(opt.value) ? '1px solid #575efe' : '1px solid #8589b2',
                            background: authMethods.includes(opt.value) ? '#575efe' : 'transparent',
                          }}
                        >
                          {authMethods.includes(opt.value) && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>{opt.label}</p>
                      </div>
                      <p className="text-xs mt-1 ml-6" style={{ color: '#8589b2' }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
                {authMethods.length === 0 && (
                  <p className="text-xs mt-2" style={{ color: '#ef4444' }}>Select at least one login method</p>
                )}
              </div>

              {/* Deploy target */}
              <OptionGroup
                label="Where will you deploy?"
                options={[
                  { value: 'vercel',   label: 'Vercel',         desc: 'Next.js native — preview deploys per PR' },
                  { value: 'railway',  label: 'Railway',        desc: 'Docker-based, Postgres included' },
                  { value: 'fly',      label: 'Fly.io',         desc: 'Global edge, persistent VMs' },
                  { value: 'aws',      label: 'AWS Lightsail',  desc: 'AWS container deployment' },
                  { value: 'none',     label: 'None / other',   desc: 'Inject a build-only CI check' },
                ]}
                value={deployTarget}
                onChange={v => setDeployTarget(v as typeof deployTarget)}
              />

              {/* Compliance region */}
              <OptionGroup
                label="Where are your users?"
                options={[
                  { value: 'global',   label: 'Global',           desc: 'Basic Terms of Service only' },
                  { value: 'eu-gdpr',  label: 'EU / GDPR',        desc: 'Cookie consent banner + Privacy policy' },
                  { value: 'us',       label: 'US / CCPA',        desc: 'CCPA notice template' },
                ]}
                value={complianceRegion}
                onChange={v => setComplianceRegion(v as typeof complianceRegion)}
              />

              {/* PR option */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: '#e3f4f8' }}>After injection</p>
                <div className="flex gap-3">
                  {[
                    { v: true, label: 'Open a PR to main', desc: 'Recommended — review before merge' },
                    { v: false, label: 'Push branch only', desc: "You'll open the PR manually" },
                  ].map(opt => (
                    <button
                      key={String(opt.v)}
                      onClick={() => setOpenPR(opt.v)}
                      className="flex-1 rounded-xl p-3 text-left transition-all"
                      style={
                        openPR === opt.v
                          ? { border: '1px solid #575efe', background: 'rgba(87,94,254,0.1)' }
                          : { border: '1px solid #323779', background: 'transparent' }
                      }
                    >
                      <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>{opt.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div className="mt-6 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid #1a1b2e' }}>
              <p className="text-xs" style={{ color: '#8589b2' }}>
                Branch: <code style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d7ff' }}>prodify/inject-{'<timestamp>'}</code>
              </p>
              <button
                onClick={() => void startInjection()}
                disabled={report.conflicts.some(c => c.severity === 'blocker') || authMethods.length === 0}
                className="py-2.5 px-6 rounded-full font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)'; }}
              >
                Inject now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INJECTING — progress stream */}
      {injecting && (
        <div className="p-8" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}>
          <h2 className="font-semibold mb-6 flex items-center gap-2" style={{ color: '#e3f4f8' }}>
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#575efe', borderTopColor: 'transparent' }} />
            Injecting infrastructure...
          </h2>
          <div className="space-y-3">
            {injectProgress.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                >
                  ✓
                </div>
                <span className="text-sm" style={{ color: '#e3f4f8' }}>{p.message}</span>
              </div>
            ))}
            {injectProgress.length > 0 && (
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(87,94,254,0.15)', border: '1px solid rgba(87,94,254,0.3)' }}
                >
                  <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#575efe', borderTopColor: 'transparent' }} />
                </div>
                <span className="text-sm font-medium" style={{ color: '#575efe' }}>Working...</span>
              </div>
            )}
          </div>
          {injectError && <p className="text-sm mt-4" style={{ color: '#ef4444' }}>{injectError}</p>}
        </div>
      )}

      {/* INJECTED — tabbed: Status | Analysis Report */}
      {status === 'injected' && !injecting && (
        <div className="space-y-6">
          {/* Tab bar */}
          <div
            className="flex gap-1 p-1 rounded-xl w-fit"
            style={{ background: 'rgba(27,30,61,0.8)', border: '1px solid #1a1b2e' }}
          >
            {([
              { key: 'status', label: '🎉 Injection status' },
              { key: 'report', label: '🔍 Analysis report' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={
                  viewMode === tab.key
                    ? { background: 'rgba(87,94,254,0.2)', color: '#e3f4f8', border: '1px solid rgba(87,94,254,0.3)' }
                    : { color: '#8589b2', border: '1px solid transparent' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status tab */}
          {viewMode === 'status' && (
            <div className="space-y-6">
              <div
                className="rounded-2xl p-6"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🎉</span>
                  <h2 className="font-semibold" style={{ color: '#10b981' }}>Infrastructure injected successfully</h2>
                </div>
                <p className="text-sm mb-4" style={{ color: '#8589b2' }}>
                  Auth, payments, and database infrastructure have been injected and pushed to GitHub.
                </p>
                {project.prUrl && (
                  <a
                    href={project.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-all"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', boxShadow: '0 0 12px rgba(16,185,129,0.2)' }}
                  >
                    View PR on GitHub →
                  </a>
                )}
                {project.branchName && (
                  <p className="text-xs mt-2" style={{ color: '#8589b2' }}>
                    Branch: <code style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d7ff' }}>{project.branchName}</code>
                  </p>
                )}
              </div>

              <div className="p-6" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}>
                <h3 className="font-semibold mb-4" style={{ color: '#e3f4f8' }}>Next steps</h3>
                <ol className="space-y-3">
                  {[
                    'Review the PR — check every file before merging',
                    'Add env vars from README-prodify.md to your .env.local',
                    'Run the SQL schema / migration from prodify-layer/db/schema.sql',
                    'Merge the PR to main',
                    'Set up Stripe webhook: stripe listen --forward-to localhost:3000/api/webhooks/stripe',
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm" style={{ color: '#8589b2' }}>
                      <span
                        className="w-5 h-5 rounded shrink-0 mt-0.5 flex items-center justify-center text-xs"
                        style={{ border: '1px solid #323779', color: '#8589b2' }}
                      />
                      {text}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Re-inject config — shown inline without re-running analysis */}
              {showReinjecting && (
                <div className="p-6" style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid rgba(87,94,254,0.3)', borderRadius: '1rem' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold" style={{ color: '#e3f4f8' }}>Re-inject with new config</h3>
                    <button
                      onClick={() => setShowReinjecting(false)}
                      className="text-sm transition-colors"
                      style={{ color: '#8589b2' }}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                  <p className="text-xs mb-5" style={{ color: '#8589b2' }}>
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
                      <p className="text-sm font-medium mb-2" style={{ color: '#e3f4f8' }}>After injection</p>
                      <div className="flex gap-3">
                        {[
                          { v: true, label: 'Open a PR to main', desc: 'Recommended — review before merge' },
                          { v: false, label: 'Push branch only', desc: "You'll open the PR manually" },
                        ].map(opt => (
                          <button
                            key={String(opt.v)}
                            onClick={() => setOpenPR(opt.v)}
                            className="flex-1 rounded-xl p-3 text-left transition-all"
                            style={
                              openPR === opt.v
                                ? { border: '1px solid #575efe', background: 'rgba(87,94,254,0.1)' }
                                : { border: '1px solid #323779', background: 'transparent' }
                            }
                          >
                            <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>{opt.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid #1a1b2e' }}>
                    <p className="text-xs" style={{ color: '#8589b2' }}>
                      Branch: <code style={{ fontFamily: 'var(--font-geist-mono)', color: '#00d7ff' }}>prodify/inject-{'<timestamp>'}</code>
                    </p>
                    <button
                      onClick={() => { setShowReinjecting(false); void startInjection(); }}
                      className="py-2.5 px-6 rounded-full font-semibold text-sm transition-all duration-200"
                      style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)'; }}
                    >
                      Inject now
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 flex-wrap">
                {!showReinjecting && (
                  <button
                    onClick={() => setShowReinjecting(true)}
                    className="py-2.5 px-5 rounded-full font-semibold text-sm transition-all duration-200"
                    style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)'; }}
                  >
                    Re-inject
                  </button>
                )}
                <button
                  onClick={() => void startAnalysis()}
                  className="py-2.5 px-5 rounded-full font-semibold text-sm transition-all"
                  style={{ border: '1px solid #323779', color: '#e3f4f8', background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#575efe'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779'; }}
                >
                  Re-analyze
                </button>
                {report && (
                  <button
                    onClick={() => setViewMode('report')}
                    className="py-2.5 px-5 rounded-full font-semibold text-sm transition-all"
                    style={{ border: '1px solid #323779', color: '#e3f4f8', background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#575efe'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779'; }}
                  >
                    View analysis report
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Analysis report tab */}
          {viewMode === 'report' && (
            <div className="space-y-6">
              {reportContent}
              <div className="flex gap-3">
                <button
                  onClick={() => setViewMode('status')}
                  className="py-2.5 px-5 rounded-full font-semibold text-sm transition-all"
                  style={{ border: '1px solid #323779', color: '#e3f4f8', background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#575efe'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779'; }}
                >
                  ← Back to status
                </button>
                <button
                  onClick={() => void startAnalysis()}
                  className="py-2.5 px-5 rounded-full font-semibold text-sm transition-all"
                  style={{ border: '1px solid #323779', color: '#e3f4f8', background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#575efe'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779'; }}
                >
                  Re-analyze
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ERROR */}
      {status === 'error' && !analyzing && (
        <div
          className="rounded-2xl p-6"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <h2 className="font-semibold mb-2" style={{ color: '#ef4444' }}>Something went wrong</h2>
          <p className="text-sm mb-4" style={{ color: '#8589b2' }}>The analysis or injection failed. Check your GitHub connection and try again.</p>
          <button
            onClick={() => void startAnalysis()}
            className="py-2.5 px-5 rounded-full font-semibold text-sm transition-all"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.25)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; glow: string }> = {
    draft:     { label: 'Draft',     color: '#8589b2', bg: 'rgba(133,137,178,0.12)', glow: 'transparent' },
    pending:   { label: 'Pending',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  glow: 'rgba(245,158,11,0.2)' },
    analyzing: { label: 'Analyzing', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  glow: 'rgba(59,130,246,0.2)' },
    analyzed:  { label: 'Ready',     color: '#575efe', bg: 'rgba(87,94,254,0.12)',   glow: 'rgba(87,94,254,0.2)' },
    injecting: { label: 'Injecting', color: '#00d7ff', bg: 'rgba(0,215,255,0.12)',   glow: 'rgba(0,215,255,0.2)' },
    injected:  { label: 'Injected',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  glow: 'rgba(16,185,129,0.2)' },
    error:     { label: 'Error',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   glow: 'rgba(239,68,68,0.2)' },
  };
  const cfg = map[status] ?? map.draft;
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ color: cfg.color, background: cfg.bg, boxShadow: `0 0 8px ${cfg.glow}` }}
    >
      {cfg.label}
    </span>
  );
}

function StackBadge({ label, color = 'gray' }: { label: string; color?: 'gray' | 'amber' | 'red' }) {
  const styles = {
    gray:  { color: '#8589b2', background: 'rgba(133,137,178,0.1)', border: '1px solid rgba(133,137,178,0.2)' },
    amber: { color: '#f59e0b', background: 'rgba(245,158,11,0.1)',  border: '1px solid rgba(245,158,11,0.2)' },
    red:   { color: '#ef4444', background: 'rgba(239,68,68,0.1)',   border: '1px solid rgba(239,68,68,0.2)' },
  };
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={styles[color]}
    >
      {label}
    </span>
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
      <p className="text-sm font-medium mb-2" style={{ color: '#e3f4f8' }}>{label}</p>
      <div className="flex gap-3">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex-1 rounded-xl p-3 text-left transition-all"
            style={
              value === opt.value
                ? { border: '1px solid #575efe', background: 'rgba(87,94,254,0.1)' }
                : { border: '1px solid #323779', background: 'transparent' }
            }
          >
            <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>{opt.label}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
