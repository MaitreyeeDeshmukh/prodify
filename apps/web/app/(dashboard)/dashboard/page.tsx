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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {projects.length === 0
              ? 'No projects yet — create your first one below.'
              : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-4xl mb-3">🚀</div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">Create your first project</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
            Pick a name, choose your modules, and Prodify wires up the infrastructure.
          </p>
          <NewProjectDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={{
                ...p,
                createdAt: p.createdAt.toISOString(),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
