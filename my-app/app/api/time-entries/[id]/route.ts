import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { differenceInSeconds } from "date-fns";

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

  const existing = await prisma.timeEntry.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const startTime = body.startTime ? new Date(body.startTime) : existing.startTime;
  const endTime = body.endTime ? new Date(body.endTime) : existing.endTime;
  const duration = endTime ? differenceInSeconds(endTime, startTime) : null;

  const entry = await prisma.timeEntry.update({
    where: { id },
    data: {
      ...(body.description !== undefined && { description: body.description }),
      startTime,
      endTime,
      duration,
      ...(body.projectId !== undefined && { projectId: body.projectId || null }),
      ...(body.tagId !== undefined && { tagId: body.tagId || null }),
      ...(body.clientId !== undefined && { clientId: body.clientId || null }),
      ...(body.billable !== undefined && { billable: body.billable }),
    },
    include: { project: true, tag: true, client: true },
  });

  return NextResponse.json(entry);
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

  const existing = await prisma.timeEntry.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.timeEntry.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
