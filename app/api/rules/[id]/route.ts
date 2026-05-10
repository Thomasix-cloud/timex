import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.mappingRule.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.matchType === "regex" && body.matchPattern) {
    try {
      new RegExp(body.matchPattern);
    } catch {
      return NextResponse.json(
        { error: "Invalid regex pattern" },
        { status: 400 }
      );
    }
  }

  const rule = await prisma.mappingRule.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name.trim() }),
      ...(body.matchPattern && { matchPattern: body.matchPattern.trim().replace(/^"|"$/g, '') }),
      ...(body.matchField && { matchField: body.matchField }),
      ...(body.matchType && { matchType: body.matchType }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.projectId !== undefined && { projectId: body.projectId || null }),
      ...(body.tagId !== undefined && { tagId: body.tagId || null }),
    },
    include: { project: true, tag: true },
  });

  return NextResponse.json(rule);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.mappingRule.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.mappingRule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
