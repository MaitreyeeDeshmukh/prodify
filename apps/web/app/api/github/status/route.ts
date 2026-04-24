import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge, getUserInsforge } from '@/lib/insforge';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userInsforge = getUserInsforge((session as any).accessToken);

  const { data: conn } = await userInsforge.database
    .from('github_connections')
    .select('github_login, github_avatar, createdAt')
    .eq('userId', session.user.id)
    .single();

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    login: conn.github_login,
    avatar: conn.github_avatar,
  });
}
