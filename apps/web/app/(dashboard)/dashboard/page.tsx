'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RepoImportDialog } from '@/components/dashboard/repo-import-dialog';
import { cn } from '@/lib/utils';

type ActivityEvent = {
  id: string;
  type: string;
  message: string;
  projectId: string | null;
  projectName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  repoFullName: string | null;
  status: string;
  prUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const ACTIVITY_DOT_COLOR: Record<string, string> = {
  project_created:      '#575efe',
  analysis_started:     '#3b82f6',
  analysis_completed:   '#10b981',
  analysis_failed:      '#ef4444',
  injection_started:    '#00d7ff',
  injection_completed:  '#10b981',
  injection_failed:     '#ef4444',
  pr_opened:            '#8b5cf6',
};

const ACTIVITY_ICONS: Record<string, string> = {
  project_created:      '📁',
  analysis_started:     '🔍',
  analysis_completed:   '✅',
  analysis_failed:      '❌',
  injection_started:    '⚡',
  injection_completed:  '🎉',
  injection_failed:     '❌',
  pr_opened:            '🔀',
};

function timeAgoShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; glow: string }> = {
  draft:     { label: 'Draft',     color: '#8589b2', bg: 'rgba(133,137,178,0.12)', glow: 'rgba(133,137,178,0)' },
  pending:   { label: 'Pending',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  glow: 'rgba(245,158,11,0.2)' },
  analyzing: { label: 'Analyzing', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  glow: 'rgba(59,130,246,0.2)' },
  analyzed:  { label: 'Ready',     color: '#575efe', bg: 'rgba(87,94,254,0.12)',   glow: 'rgba(87,94,254,0.2)' },
  injecting: { label: 'Injecting', color: '#00d7ff', bg: 'rgba(0,215,255,0.12)',   glow: 'rgba(0,215,255,0.2)' },
  injected:  { label: 'Injected',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  glow: 'rgba(16,185,129,0.2)' },
  error:     { label: 'Error',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   glow: 'rgba(239,68,68,0.2)' },
};

const PROJECT_GRADIENTS = [
  'linear-gradient(135deg, #575efe, #8b5cf6)',
  'linear-gradient(135deg, #3b82f6, #575efe)',
  'linear-gradient(135deg, #10b981, #00d7ff)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
  'linear-gradient(135deg, #00d7ff, #3b82f6)',
];

function getGradient(id: string) {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PROJECT_GRADIENTS[sum % PROJECT_GRADIENTS.length];
}

function timeAgo(iso: string) {
  return timeAgoShort(iso);
}

const glassCard: React.CSSProperties = {
  background: 'rgba(27,30,61,0.5)',
  backdropFilter: 'blur(20px)',
  border: '1px solid #1a1b2e',
  borderRadius: '1rem',
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/projects');
    const data = await res.json() as { projects: Project[] };
    setProjects(data.projects ?? []);
    setLoading(false);
  }, []);

  const fetchActivity = useCallback(async () => {
    const res = await fetch('/api/activity');
    if (res.ok) {
      const data = await res.json() as { events: ActivityEvent[] };
      setActivity(data.events ?? []);
    }
  }, []);

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);
  useEffect(() => { void fetchActivity(); }, [fetchActivity]);

  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const injected = projects.filter(p => p.status === 'injected').length;

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-black"
            style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
          >
            {greeting},{' '}
            <span style={{ background: 'linear-gradient(90deg, #575efe, #00d7ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {firstName}
            </span>
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8589b2' }}>
            {projects.length === 0
              ? 'Import your first GitHub repo to get started'
              : `${projects.length} project${projects.length !== 1 ? 's' : ''} · ${injected} injected`}
          </p>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 py-2.5 px-5 rounded-full font-semibold text-sm transition-all duration-200"
          style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)'; }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Import repo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Total Projects',
            value: projects.length,
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            ),
            iconBg: 'rgba(87,94,254,0.15)',
            iconColor: '#575efe',
          },
          {
            label: 'Injections Done',
            value: injected,
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            ),
            iconBg: 'rgba(16,185,129,0.15)',
            iconColor: '#10b981',
          },
          {
            label: 'In Progress',
            value: projects.filter(p => ['analyzing', 'injecting', 'analyzed'].includes(p.status)).length,
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ),
            iconBg: 'rgba(0,215,255,0.15)',
            iconColor: '#00d7ff',
          },
        ].map(stat => (
          <div key={stat.label} className="p-5 flex items-center gap-4" style={glassCard}>
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: stat.iconBg, color: stat.iconColor }}
            >
              {stat.icon}
            </div>
            <div>
              <p
                className="text-2xl font-black"
                style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
              >
                {stat.value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Projects grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-5 animate-pulse" style={glassCard}>
              <div className="w-10 h-10 rounded-xl mb-4" style={{ background: '#1a1b2e' }} />
              <div className="h-4 rounded w-3/4 mb-2" style={{ background: '#1a1b2e' }} />
              <div className="h-3 rounded w-1/2" style={{ background: '#1a1b2e' }} />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ border: '2px dashed #323779', background: 'rgba(27,30,61,0.3)' }}
        >
          {/* Terminal-style icon */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(87,94,254,0.1)', border: '1px solid rgba(87,94,254,0.3)' }}
          >
            <svg className="w-8 h-8" style={{ color: '#575efe' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <h3
            className="font-black mb-1"
            style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8', fontSize: '1rem' }}
          >
            No projects yet
          </h3>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: '#8589b2' }}>
            Import a GitHub repo and Prodify will analyze it and inject production-ready auth, payments, and database infrastructure.
          </p>
          <button
            onClick={() => setImportOpen(true)}
            className="py-2.5 px-6 rounded-full font-semibold text-sm transition-all duration-200"
            style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)'; }}
          >
            Import your first repo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map(project => {
            const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft;
            return (
              <div
                key={project.id}
                onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                className="cursor-pointer p-5 transition-all duration-200 group"
                style={{
                  ...glassCard,
                  borderColor: '#1a1b2e',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#575efe';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 24px rgba(87,94,254,0.15)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#1a1b2e';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: getGradient(project.id) }}
                  >
                    {project.name[0]?.toUpperCase()}
                  </div>
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      color: statusCfg.color,
                      background: statusCfg.bg,
                      boxShadow: `0 0 8px ${statusCfg.glow}`,
                    }}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                <h3
                  className="font-semibold text-sm mb-0.5 truncate"
                  style={{ color: '#e3f4f8' }}
                >
                  {project.name}
                </h3>
                {project.repoFullName ? (
                  <p className="text-xs truncate mb-3" style={{ color: '#8589b2', fontFamily: 'var(--font-geist-mono)' }}>
                    {project.repoFullName}
                  </p>
                ) : (
                  <p className="text-xs mb-3" style={{ color: '#8589b2' }}>
                    {project.description ?? 'No description'}
                  </p>
                )}

                <div
                  className="flex items-center justify-between pt-3"
                  style={{ borderTop: '1px solid #1a1b2e' }}
                >
                  <span className="text-xs" style={{ color: '#8589b2' }}>{timeAgo(project.updatedAt ?? project.createdAt)}</span>
                  {project.prUrl ? (
                    <a
                      href={project.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs font-medium transition-colors"
                      style={{ color: '#00d7ff' }}
                    >
                      View PR →
                    </a>
                  ) : project.status === 'pending' ? (
                    <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>Needs analysis</span>
                  ) : project.status === 'analyzed' ? (
                    <span className="text-xs font-medium" style={{ color: '#575efe' }}>Ready to inject</span>
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* Add new card */}
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-2 transition-all min-h-[180px] group"
            style={{ border: '2px dashed #323779', background: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#575efe';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(87,94,254,0.05)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{ border: '1px solid #323779', color: '#8589b2' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium" style={{ color: '#8589b2' }}>Import repo</span>
          </button>
        </div>
      )}

      {/* Activity feed */}
      {activity.length > 0 && (
        <div className="mt-8">
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: '#8589b2', fontFamily: 'var(--font-geist-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Recent Activity
          </h2>
          <div style={{ ...glassCard, borderRadius: '1rem', overflow: 'hidden' }}>
            {activity.slice(0, 8).map((event, idx) => (
              <div
                key={event.id}
                className="flex items-start gap-3 px-4 py-3"
                style={{ borderBottom: idx < Math.min(activity.length, 8) - 1 ? '1px solid #1a1b2e' : 'none' }}
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center shrink-0 mt-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: ACTIVITY_DOT_COLOR[event.type] ?? '#8589b2' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: '#e3f4f8' }}>
                    <span className="mr-1.5">{ACTIVITY_ICONS[event.type] ?? '📌'}</span>
                    {event.message}
                  </p>
                  {event.projectName && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#8589b2' }}>{event.projectName}</p>
                  )}
                </div>
                <span className="text-xs shrink-0 mt-0.5" style={{ color: '#8589b2' }}>{timeAgoShort(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RepoImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={fetchProjects} />
    </div>
  );
}
