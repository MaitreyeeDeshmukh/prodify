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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#8589b2', bg: 'rgba(133,137,178,0.1)' },
  pending:   { label: 'Pending',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  analyzing: { label: 'Analyzing', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  analyzed:  { label: 'Ready',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  injecting: { label: 'Injecting', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  injected:  { label: 'Injected',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  error:     { label: 'Error',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const PROJECT_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-500',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-yellow-500',
];

function getColor(id: string) {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PROJECT_COLORS[sum % PROJECT_COLORS.length];
}

function timeAgo(iso: string) {
  return timeAgoShort(iso);
}

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
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {firstName}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {projects.length === 0
              ? 'Import your first GitHub repo to get started'
              : `${projects.length} project${projects.length !== 1 ? 's' : ''} · ${injected} injected`}
          </p>
        </div>
        <Button
          onClick={() => setImportOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Import repo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Projects', value: projects.length, icon: '📁', color: 'bg-violet-50 text-violet-700' },
          { label: 'Injections Done', value: injected, icon: '⚡', color: 'bg-emerald-50 text-emerald-700' },
          { label: 'In Progress', value: projects.filter(p => ['analyzing','injecting','analyzed'].includes(p.status)).length, icon: '🔄', color: 'bg-blue-50 text-blue-700' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-lg', stat.color)}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Projects grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="w-10 h-10 bg-gray-100 rounded-lg mb-4" />
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-violet-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <h3 className="text-gray-900 font-semibold mb-1">No projects yet</h3>
          <p className="text-gray-500 text-sm mb-6">Import a GitHub repo and Prodify will analyze it and inject production-ready auth, payments, and database infrastructure.</p>
          <Button
            onClick={() => setImportOpen(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            Import your first repo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map(project => {
            const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft;
            return (
              <div
                key={project.id}
                onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                className="bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all cursor-pointer p-5 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-semibold text-sm shrink-0', getColor(project.id))}>
                    {project.name[0]?.toUpperCase()}
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ color: statusCfg.color, background: statusCfg.bg }}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                <h3 className="font-semibold text-gray-900 text-sm mb-0.5 truncate">{project.name}</h3>
                {project.repoFullName ? (
                  <p className="text-xs text-gray-400 truncate mb-3">{project.repoFullName}</p>
                ) : (
                  <p className="text-xs text-gray-400 mb-3">{project.description ?? 'No description'}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">{timeAgo(project.updatedAt ?? project.createdAt)}</span>
                  {project.prUrl ? (
                    <a
                      href={project.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-violet-600 hover:underline font-medium"
                    >
                      View PR →
                    </a>
                  ) : project.status === 'pending' ? (
                    <span className="text-xs text-amber-600 font-medium">Needs analysis</span>
                  ) : project.status === 'analyzed' ? (
                    <span className="text-xs text-violet-600 font-medium">Ready to inject</span>
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* Add new card */}
          <button
            onClick={() => setImportOpen(true)}
            className="bg-gray-50 hover:bg-gray-100 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-300 p-5 text-center flex flex-col items-center justify-center gap-2 transition-all min-h-[180px] group"
          >
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center group-hover:border-violet-300 group-hover:text-violet-600 text-gray-400 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm text-gray-500 font-medium">Import repo</span>
          </button>
        </div>
      )}

      {/* Activity feed */}
      {activity.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h2>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {activity.slice(0, 8).map(event => (
              <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                <span className="text-base shrink-0 mt-0.5">{ACTIVITY_ICONS[event.type] ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{event.message}</p>
                  {event.projectName && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{event.projectName}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">{timeAgoShort(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RepoImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={fetchProjects} />
    </div>
  );
}
