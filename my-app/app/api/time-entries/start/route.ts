import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if there's already a running timer
  const running = await prisma.timeEntry.findFirst({
    where: { userId: session.user.id, endTime: null },
  });

  if (running) {
    return NextResponse.json(
      { error: "A timer is already running. Stop it first." },
      { status: 409 }
    );
  }

  const body = await request.json();
  const { description, projectId, tagId, clientId } = body;

  const entry = await prisma.timeEntry.create({
    data: {
      description: description || "",
      startTime: new Date(),
      projectId: projectId || null,
      tagId: tagId || null,
      clientId: clientId || null,
      source: "tracker",
      userId: session.user.id,
    },
    include: { project: true, tag: true, client: true },
  });

  return NextResponse.json(entry, { status: 201 });
}
