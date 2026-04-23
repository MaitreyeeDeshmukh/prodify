import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MODULE_INFO: Record<string, { label: string; icon: string; desc: string; color: string }> = {
  auth: {
    label: 'Authentication',
    icon: '🔐',
    desc: 'Email + password sign-up/login, GitHub OAuth, JWT sessions, forgot/reset password flow, middleware route protection.',
    color: 'bg-blue-50 border-blue-200 text-blue-900',
  },
  database: {
    label: 'Database',
    icon: '🗄️',
    desc: 'Prisma ORM with PostgreSQL. Schema auto-generated for your models. Neon serverless DB compatible. Migration scripts included.',
    color: 'bg-purple-50 border-purple-200 text-purple-900',
  },
  payments: {
    label: 'Payments',
    icon: '💳',
    desc: 'Stripe Checkout sessions, webhook handler with idempotency, customer portal, subscription status synced to DB.',
    color: 'bg-green-50 border-green-200 text-green-900',
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
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← All projects
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {project.status === 'active' ? 'Active' : 'Draft'}
        </span>
      </div>
      {project.description && (
        <p className="text-gray-500 text-sm mb-1">{project.description}</p>
      )}
      <p className="text-xs text-gray-400 mb-8">Created {created}</p>

      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Injected modules
      </h2>
      <div className="space-y-3 mb-8">
        {project.modules.map(mod => {
          const info = MODULE_INFO[mod] ?? { label: mod, icon: '📦', desc: '', color: 'bg-gray-50 border-gray-200 text-gray-900' };
          return (
            <div key={mod} className={`border rounded-xl p-4 ${info.color}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{info.icon}</span>
                <span className="font-semibold text-sm">{info.label}</span>
                <span className="ml-auto text-xs font-medium opacity-60">Injected</span>
              </div>
              <p className="text-xs opacity-80 leading-relaxed">{info.desc}</p>
            </div>
          );
        })}
      </div>

      {project.repoUrl && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8">
          <div className="text-sm font-medium text-gray-700 mb-1">GitHub repository</div>
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:underline break-all"
          >
            {project.repoUrl}
          </a>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-gray-700 mb-2">Next steps</div>
        <ol className="space-y-2">
          <li className="flex gap-2 text-sm text-gray-600">
            <span className="text-indigo-500 font-mono font-semibold">1.</span>
            Run <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-xs font-mono">npx prodify inject</code> in your project directory
          </li>
          <li className="flex gap-2 text-sm text-gray-600">
            <span className="text-indigo-500 font-mono font-semibold">2.</span>
            Add your environment variables to <code className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code>
          </li>
          <li className="flex gap-2 text-sm text-gray-600">
            <span className="text-indigo-500 font-mono font-semibold">3.</span>
            Push to GitHub — Prodify creates a branch and opens a PR automatically
          </li>
        </ol>
      </div>
    </div>
  );
}
