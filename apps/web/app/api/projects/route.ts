import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insforge } from "@/lib/insforge";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: projects, error } = await insforge.database
    .from('projects')
    .select('*')
    .eq('userId', session.user.id)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error("[projects GET] error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }

  return NextResponse.json({ projects: projects || [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name?: string; description?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const { data: project, error } = await insforge.database
    .from('projects')
    .insert({
      name,
      description: body.description?.trim() || null,
      userId: session.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("[projects POST] error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  return NextResponse.json({ project }, { status: 201 });
}
