import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProjectCard } from '@/components/projects/project-card';
import { NewProjectDialog } from '@/components/projects/new-project-dialog';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const projects = await prisma.project.findMany({
    where: { userId: session!.user!.id! },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight mb-1" style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}>
            Projects
          </h1>
          <p className="text-sm" style={{ color: '#8589b2' }}>
            {projects.length === 0
              ? 'No projects yet — create your first one.'
              : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-3xl p-16 text-center" style={{ border: '2px dashed #323779' }}>
          <div className="text-5xl mb-4">🚀</div>
          <h3 className="text-base font-bold mb-2" style={{ color: '#e3f4f8' }}>Create your first project</h3>
          <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: '#8589b2' }}>
            Pick a name, choose your modules, and Prodify wires up the infrastructure.
          </p>
          <NewProjectDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={{ ...p, createdAt: p.createdAt.toISOString() }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
