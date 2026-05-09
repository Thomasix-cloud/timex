import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// One-time fix: set clientId on time entries from their associated project
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all projects with clientId for this user
  const projects = await prisma.project.findMany({
    where: { userId: session.user.id, clientId: { not: null } },
    select: { id: true, clientId: true },
  });

  const projectClientMap = new Map(
    projects.map((p) => [p.id, p.clientId!])
  );

  // Find all entries with projectId set but clientId null
  const entries = await prisma.timeEntry.findMany({
    where: {
      userId: session.user.id,
      clientId: null,
      projectId: { not: null },
    },
    select: { id: true, projectId: true },
  });

  const toFix = entries.filter((e) => e.projectId && projectClientMap.has(e.projectId));

  if (toFix.length === 0) {
    return NextResponse.json({ fixed: 0, message: "No entries to fix" });
  }

  // Batch update
  const operations = toFix.map((e) =>
    prisma.timeEntry.update({
      where: { id: e.id },
      data: { clientId: projectClientMap.get(e.projectId!) },
    })
  );

  await prisma.$transaction(operations);

  return NextResponse.json({
    fixed: toFix.length,
    message: `Fixed clientId on ${toFix.length} entries`,
  });
}
