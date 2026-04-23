'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

type Project = { id: string; name: string; createdAt: string; updatedAt: string };

function BarChart({ data }: { data: { label: string; value: number; max: number }[] }) {
  return (
    <div className="space-y-3">
      {data.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-20 shrink-0 truncate">{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div
              className="bg-violet-500 h-2 rounded-full transition-all duration-700"
              style={{ width: item.max > 0 ? `${(item.value / item.max) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs font-medium text-gray-700 w-4 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, change, icon }: { label: string; value: string | number; change?: string; icon: string }) {
  const isPositive = change?.startsWith('+');
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {change && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/projects');
    const data = await res.json() as { projects: Project[] };
    setProjects(data.projects ?? []);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Compute analytics from real project data
  const now = new Date();
  const thisMonth = projects.filter(p => {
    const d = new Date(p.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const lastMonth = projects.filter(p => {
    const d = new Date(p.createdAt);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }).length;
  const activeThisWeek = projects.filter(p => new Date(p.updatedAt) > new Date(Date.now() - 7 * 86400_000)).length;

  // Activity by month (last 6 months)
  const monthData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const count = projects.filter(p => {
      const pd = new Date(p.createdAt);
      return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
    }).length;
    return {
      label: d.toLocaleString('default', { month: 'short' }),
      value: count,
      max: Math.max(...Array.from({ length: 6 }, (_, j) => {
        const md = new Date(now.getFullYear(), now.getMonth() - (5 - j), 1);
        return projects.filter(p => {
          const pd = new Date(p.createdAt);
          return pd.getMonth() === md.getMonth() && pd.getFullYear() === md.getFullYear();
        }).length;
      }), 1),
    };
  });

  const firstName = session?.user?.name?.split(' ')[0] ?? 'You';

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Track your productivity and project activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Projects" value={projects.length} icon="📁" change={thisMonth > 0 ? `+${thisMonth} this month` : undefined} />
        <StatCard label="Created This Month" value={thisMonth} icon="🆕" change={lastMonth > 0 ? `vs ${lastMonth} last month` : undefined} />
        <StatCard label="Active This Week" value={activeThisWeek} icon="⚡" />
        <StatCard label="Avg. Projects/Month" value={projects.length > 0 ? (projects.length / 6).toFixed(1) : '0'} icon="📊" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Projects over time */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Projects Created (Last 6 Months)</h2>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Create projects to see data here</div>
          ) : (
            <BarChart data={monthData} />
          )}
        </div>

        {/* Activity feed */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No activity yet</div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 6).map(p => {
                const isNew = new Date(p.createdAt).toDateString() === new Date(p.updatedAt).toDateString();
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 text-xs">
                      {isNew ? '✨' : '✏️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {isNew ? 'Created' : 'Updated'} <span className="text-violet-700">{p.name}</span>
                      </p>
                      <p className="text-xs text-gray-400">{new Date(p.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
              {projects.length > 6 && (
                <p className="text-xs text-gray-400 pl-10">+{projects.length - 6} more</p>
              )}
            </div>
          )}
        </div>

        {/* Projects breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">All Projects — Last Updated</h2>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No projects yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {projects.map(p => {
                const daysAgo = Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / 86400_000);
                const freshness = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
                return (
                  <div key={p.id} className="flex items-center gap-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">Created {new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs text-gray-500">{freshness}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${daysAgo < 7 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {daysAgo < 7 ? 'Active' : 'Idle'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
