import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(200).optional(),
  modules: z.array(z.enum(['auth', 'database', 'payments'])).min(1),
  repoUrl: z.string().url().optional().or(z.literal('')),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, description, modules, repoUrl } = result.data;

  const project = await prisma.project.create({
    data: {
      name,
      description,
      modules,
      repoUrl: repoUrl || null,
      status: 'active',
      userId: session.user.id,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
