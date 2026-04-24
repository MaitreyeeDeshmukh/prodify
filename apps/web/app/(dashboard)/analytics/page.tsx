'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

type Project = { id: string; name: string; createdAt: string; updatedAt: string };

function BarChart({ data }: { data: { label: string; value: number; max: number }[] }) {
  return (
    <div className="space-y-3">
      {data.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs w-20 shrink-0 truncate" style={{ color: '#8589b2', fontFamily: 'var(--font-geist-mono)' }}>{item.label}</span>
          <div className="flex-1 rounded-full h-2" style={{ background: 'rgba(87,94,254,0.1)' }}>
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{ width: item.max > 0 ? `${(item.value / item.max) * 100}%` : '0%', background: 'linear-gradient(90deg, #575efe, #00d7ff)' }}
            />
          </div>
          <span className="text-xs font-medium w-4 text-right" style={{ color: '#e3f4f8' }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, change, icon }: { label: string; value: string | number; change?: string; icon: string }) {
  const isPositive = change?.startsWith('+');
  return (
    <div
      className="p-5"
      style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {change && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={
              isPositive
                ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' }
                : { background: 'rgba(239,68,68,0.12)', color: '#ef4444' }
            }
          >
            {change}
          </span>
        )}
      </div>
      <p
        className="text-2xl font-black"
        style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
      >
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: '#8589b2' }}>{label}</p>
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
        <h1
          className="text-2xl font-black"
          style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
        >
          Analytics
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8589b2' }}>Track your productivity and project activity</p>
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
        <div
          className="p-5"
          style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#e3f4f8' }}>Projects Created (Last 6 Months)</h2>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: '#8589b2' }}>Create projects to see data here</div>
          ) : (
            <BarChart data={monthData} />
          )}
        </div>

        {/* Activity feed */}
        <div
          className="p-5"
          style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#e3f4f8' }}>Recent Activity</h2>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: '#8589b2' }}>No activity yet</div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 6).map(p => {
                const isNew = new Date(p.createdAt).toDateString() === new Date(p.updatedAt).toDateString();
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs"
                      style={{ background: 'rgba(87,94,254,0.15)', border: '1px solid rgba(87,94,254,0.3)' }}
                    >
                      {isNew ? '✨' : '✏️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#e3f4f8' }}>
                        {isNew ? 'Created' : 'Updated'}{' '}
                        <span style={{ color: '#575efe' }}>{p.name}</span>
                      </p>
                      <p className="text-xs" style={{ color: '#8589b2' }}>{new Date(p.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
              {projects.length > 6 && (
                <p className="text-xs pl-10" style={{ color: '#8589b2' }}>+{projects.length - 6} more</p>
              )}
            </div>
          )}
        </div>

        {/* Projects breakdown */}
        <div
          className="p-5 col-span-2"
          style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e', borderRadius: '1rem' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#e3f4f8' }}>All Projects — Last Updated</h2>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: '#8589b2' }}>No projects yet</div>
          ) : (
            <div>
              {projects.map((p, idx) => {
                const daysAgo = Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / 86400_000);
                const freshness = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 py-3"
                    style={{ borderBottom: idx < projects.length - 1 ? '1px solid #1a1b2e' : 'none' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(87,94,254,0.15)', color: '#575efe', border: '1px solid rgba(87,94,254,0.2)' }}
                    >
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>{p.name}</p>
                      <p className="text-xs" style={{ color: '#8589b2' }}>Created {new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs" style={{ color: '#8589b2' }}>{freshness}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={
                        daysAgo < 7
                          ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' }
                          : { background: 'rgba(133,137,178,0.1)', color: '#8589b2' }
                      }
                    >
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
