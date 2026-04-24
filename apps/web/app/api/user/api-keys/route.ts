import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { insforge, getUserInsforge } from '@/lib/insforge';
import { randomBytes } from 'crypto';

// GET — list the user's API keys (token value is never returned after creation)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userInsforge = getUserInsforge((session as any).accessToken);

  const { data: keys } = await userInsforge.database
    .from('api_keys')
    .select('id, name, prefix, createdAt, lastUsedAt')
    .eq('userId', session.user.id)
    .order('createdAt', { ascending: false });

  return NextResponse.json({ keys: keys ?? [] });
}

// POST — generate a new API key
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userInsforge = getUserInsforge((session as any).accessToken);

  // Limit to 5 keys per user
  const { data: existing } = await userInsforge.database
    .from('api_keys')
    .select('id')
    .eq('userId', session.user.id);

  if ((existing?.length ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Maximum of 5 API keys allowed. Delete one to create a new key.' },
      { status: 400 }
    );
  }

  const rawToken = `pdfy_${randomBytes(32).toString('hex')}`;
  const prefix = rawToken.slice(0, 12); // e.g. "pdfy_a1b2c3"

  const { data: key, error } = await userInsforge.database
    .from('api_keys')
    .insert({
      userId: session.user.id,
      name: `Key ${(existing?.length ?? 0) + 1}`,
      token: rawToken,
      prefix,
    })
    .select('id, name, prefix, createdAt')
    .single();

  if (error || !key) {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }

  // Return the full token ONCE — it will never be shown again
  return NextResponse.json({ key: { ...key, token: rawToken } }, { status: 201 });
}
