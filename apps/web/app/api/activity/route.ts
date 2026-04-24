import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge } from '@/lib/insforge';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: events, error } = await insforge.database
    .from('activity_events')
    .select('id, type, message, projectId, projectName, metadata, createdAt')
    .eq('userId', session.user.id)
    .order('createdAt', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ events: [] });
  }

  return NextResponse.json({ events: events ?? [] });
}
