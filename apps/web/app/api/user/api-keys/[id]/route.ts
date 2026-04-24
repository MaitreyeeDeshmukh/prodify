import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge } from '@/lib/insforge';

// PATCH — rename a key
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const { data: key, error } = await insforge.database
    .from('api_keys')
    .update({ name })
    .eq('id', id)
    .eq('userId', session.user.id)
    .select('id, name, prefix, createdAt')
    .single();

  if (error || !key) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  return NextResponse.json({ key });
}

// DELETE — revoke a key
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await insforge.database
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('userId', session.user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
