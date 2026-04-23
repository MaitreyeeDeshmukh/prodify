'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{project.description}</p>
          )}
        </div>
        <span className={`ml-3 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {project.status === 'active' ? 'Active' : 'Draft'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {project.modules.map(mod => (
          <span
            key={mod}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium"
          >
            {MODULE_LABELS[mod]?.icon} {MODULE_LABELS[mod]?.label ?? mod}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Created {created}</span>
        <div className="flex items-center gap-3">
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              GitHub →
            </a>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Link>
  );
}
