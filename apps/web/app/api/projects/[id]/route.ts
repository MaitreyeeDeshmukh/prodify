import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insforge } from "@/lib/insforge";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { name?: string; description?: string };

  const { data: project, error: findError } = await insforge.database
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('userId', session.user.id)
    .single();

  if (findError || !project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: updated, error: updateError } = await insforge.database
    .from('projects')
    .update({
      ...(body.name?.trim() && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error("[projects PATCH] error:", updateError);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }

  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: project, error: findError } = await insforge.database
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('userId', session.user.id)
    .single();

  if (findError || !project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error: deleteError } = await insforge.database
    .from('projects')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error("[projects DELETE] error:", deleteError);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
