import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { differenceInSeconds } from "date-fns";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const running = await prisma.timeEntry.findFirst({
    where: { userId: session.user.id, endTime: null },
  });

  if (!running) {
    return NextResponse.json(
      { error: "No running timer found" },
      { status: 404 }
    );
  }

  const now = new Date();
  const duration = differenceInSeconds(now, running.startTime);

  const entry = await prisma.timeEntry.update({
    where: { id: running.id },
    data: { endTime: now, duration },
    include: { project: true, tag: true, client: true },
  });

  return NextResponse.json(entry);
}
