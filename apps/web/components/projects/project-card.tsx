'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const MODULE_LABELS: Record<string, { label: string; icon: string }> = {
  auth: { label: 'Auth', icon: '🔐' },
  database: { label: 'Database', icon: '🗄️' },
  payments: { label: 'Payments', icon: '💳' },
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  modules: string[];
  status: string;
  repoUrl: string | null;
  createdAt: string;
};

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const created = new Date(project.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="block rounded-3xl p-6 transition-all duration-200 group"
      style={{ background: '#25284c', border: '1px solid #323779' }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#575efe'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#323779'; }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-base truncate group-hover:transition-colors" style={{ color: '#e3f4f8' }}>
          {project.name}
        </h3>
        <span
          className="ml-3 flex-shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full"
          style={project.status === 'active'
            ? { background: 'rgba(0,215,255,0.1)', color: '#00d7ff' }
            : { background: 'rgba(133,137,178,0.15)', color: '#8589b2' }
          }
        >
          {project.status === 'active' ? 'Active' : 'Draft'}
        </span>
      </div>

      {project.description && (
        <p className="text-sm mb-3 truncate" style={{ color: '#8589b2' }}>{project.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {project.modules.map(mod => (
          <span
            key={mod}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(87,94,254,0.15)', color: '#575efe', border: '1px solid rgba(87,94,254,0.3)' }}
          >
            {MODULE_LABELS[mod]?.icon} {MODULE_LABELS[mod]?.label ?? mod}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: '#8589b2' }}>Created {created}</span>
        <div className="flex items-center gap-3">
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs transition-colors"
              style={{ color: '#8589b2' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#00d7ff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#8589b2')}
            >
              GitHub →
            </a>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs transition-colors disabled:opacity-50"
            style={{ color: '#8589b2' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ff6b6b')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8589b2')}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Link>
  );
}
