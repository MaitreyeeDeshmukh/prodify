import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge } from '@/lib/insforge';

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Delete in dependency order
  await insforge.database.from('api_keys').delete().eq('userId', userId);
  await insforge.database.from('activity_events').delete().eq('userId', userId);
  await insforge.database.from('github_connections').delete().eq('userId', userId);
  await insforge.database.from('projects').delete().eq('userId', userId);

  const { error } = await insforge.database
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error('[delete account] error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
