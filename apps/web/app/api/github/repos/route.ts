import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge } from '@/lib/insforge';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get stored GitHub access token
  const { data: conn } = await insforge.database
    .from('github_connections')
    .select('access_token, github_login')
    .eq('userId', session.user.id)
    .single();

  if (!conn) {
    return NextResponse.json({ connected: false, repos: [] });
  }

  const res = await fetch(
    'https://api.github.com/user/repos?sort=pushed&per_page=100&type=owner',
    {
      headers: {
        Authorization: `Bearer ${conn.access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch repos from GitHub' }, { status: 502 });
  }

  const raw = await res.json() as Array<{
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    clone_url: string;
    language: string | null;
    stargazers_count: number;
    pushed_at: string;
    private: boolean;
    default_branch: string;
  }>;

  const repos = raw.map(r => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    url: r.html_url,
    cloneUrl: r.clone_url,
    language: r.language,
    stars: r.stargazers_count,
    pushedAt: r.pushed_at,
    private: r.private,
    defaultBranch: r.default_branch,
  }));

  return NextResponse.json({ connected: true, login: conn.github_login, repos });
}
