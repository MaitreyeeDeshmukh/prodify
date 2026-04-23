import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MODULE_INFO: Record<string, { label: string; icon: string; desc: string; color: string; border: string }> = {
  auth: {
    label: 'Authentication',
    icon: '🔐',
    desc: 'Email + password sign-up/login, GitHub OAuth, JWT sessions, forgot/reset password flow, middleware route protection.',
    color: 'rgba(87,94,254,0.08)',
    border: 'rgba(87,94,254,0.3)',
  },
  database: {
    label: 'Database',
    icon: '🗄️',
    desc: 'Prisma ORM with PostgreSQL. Schema auto-generated for your models. Neon serverless DB compatible. Migration scripts included.',
    color: 'rgba(0,215,255,0.08)',
    border: 'rgba(0,215,255,0.3)',
  },
  payments: {
    label: 'Payments',
    icon: '💳',
    desc: 'Stripe Checkout sessions, webhook handler with idempotency, customer portal, subscription status synced to DB.',
    color: 'rgba(0,215,255,0.05)',
    border: 'rgba(87,94,254,0.2)',
  },
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.userId !== session!.user!.id!) notFound();

  const created = new Date(project.createdAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm transition-colors" style={{ color: '#8589b2' }}
          onMouseEnter={undefined}>
          ← All projects
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}>
          {project.name}
        </h1>
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
          style={project.status === 'active'
            ? { background: 'rgba(0,215,255,0.1)', color: '#00d7ff' }
            : { background: 'rgba(133,137,178,0.15)', color: '#8589b2' }
          }
        >
          {project.status === 'active' ? 'Active' : 'Draft'}
        </span>
      </div>
      {project.description && (
        <p className="text-sm mb-1" style={{ color: '#8589b2' }}>{project.description}</p>
      )}
      <p className="text-xs mb-8" style={{ color: '#8589b2' }}>Created {created}</p>

      <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#8589b2' }}>
        Injected modules
      </h2>
      <div className="space-y-3 mb-8">
        {project.modules.map(mod => {
          const info = MODULE_INFO[mod] ?? { label: mod, icon: '📦', desc: '', color: 'rgba(87,94,254,0.08)', border: '#323779' };
          return (
            <div key={mod} className="rounded-2xl p-4" style={{ background: info.color, border: `1px solid ${info.border}` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{info.icon}</span>
                <span className="font-semibold text-sm" style={{ color: '#e3f4f8' }}>{info.label}</span>
                <span className="ml-auto text-xs font-medium" style={{ color: '#00d7ff' }}>✓ Injected</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#8589b2' }}>{info.desc}</p>
            </div>
          );
        })}
      </div>

      {project.repoUrl && (
        <div className="rounded-2xl p-4 mb-8" style={{ background: '#25284c', border: '1px solid #323779' }}>
          <div className="text-sm font-medium mb-1" style={{ color: '#e3f4f8' }}>GitHub repository</div>
          <a href={project.repoUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm break-all" style={{ color: '#575efe' }}>
            {project.repoUrl}
          </a>
        </div>
      )}

      <div className="rounded-2xl p-5" style={{ background: '#25284c', border: '1px solid #323779' }}>
        <div className="text-sm font-semibold mb-3" style={{ color: '#e3f4f8' }}>Next steps</div>
        <ol className="space-y-3">
          {[
            <>Run <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: '#1b1e3d', color: '#00d7ff', border: '1px solid #323779' }}>npx prodify inject</code> in your project directory</>,
            <>Add your environment variables to <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: '#1b1e3d', color: '#00d7ff', border: '1px solid #323779' }}>.env.local</code></>,
            <>Push to GitHub — Prodify creates a branch and opens a PR automatically</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm" style={{ color: '#8589b2' }}>
              <span className="font-mono font-bold shrink-0" style={{ color: '#575efe' }}>{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
