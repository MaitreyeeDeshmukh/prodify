import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge, getUserInsforge } from '@/lib/insforge';

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userInsforge = getUserInsforge((session as any).accessToken);

  const { error } = await userInsforge.database
    .from('github_connections')
    .delete()
    .eq('userId', session.user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect GitHub' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
