import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Projects</h1>
      <p className="text-gray-500 text-sm mb-6">
        Welcome back, {session?.user?.name}. Your projects will appear here.
      </p>
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
        <p className="text-gray-400 text-sm">No projects yet. Coming in Sub-project 2.</p>
      </div>
    </div>
  );
}
