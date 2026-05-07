import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { differenceInSeconds } from "date-fns";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const projectId = url.searchParams.get("projectId");
  const tagId = url.searchParams.get("tagId");

  const where: Record<string, unknown> = { userId: session.user.id };

  if (from || to) {
    where.startTime = {};
    if (from) (where.startTime as Record<string, unknown>).gte = new Date(from);
    if (to) (where.startTime as Record<string, unknown>).lte = new Date(to);
  }
  if (projectId) where.projectId = projectId;
  if (tagId) where.tagId = tagId;

  const entries = await prisma.timeEntry.findMany({
    where,
    include: { project: true, tag: true },
    orderBy: { startTime: "desc" },
    take: 100,
  });

  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { description, startTime, endTime, projectId, tagId, source, calendarEventId } = body;

  if (!startTime) {
    return NextResponse.json(
      { error: "startTime is required" },
      { status: 400 }
    );
  }

  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;
  const duration = end ? differenceInSeconds(end, start) : null;

  const entry = await prisma.timeEntry.create({
    data: {
      description: description || "",
      startTime: start,
      endTime: end,
      duration,
      projectId: projectId || null,
      tagId: tagId || null,
      source: source || "manual",
      calendarEventId: calendarEventId || null,
      userId: session.user.id,
    },
    include: { project: true, tag: true },
  });

  return NextResponse.json(entry, { status: 201 });
}
