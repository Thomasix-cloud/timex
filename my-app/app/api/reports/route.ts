import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const groupBy = url.searchParams.get("groupBy") || "project"; // "project" | "tag" | "day"

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to are required" },
      { status: 400 }
    );
  }

  const whereBase = {
    userId: session.user.id,
    startTime: { gte: new Date(from), lte: new Date(to) },
    endTime: { not: null },
  } as const;

  if (groupBy === "project") {
    const grouped = await prisma.timeEntry.groupBy({
      by: ["projectId"],
      where: whereBase,
      _sum: { duration: true },
      _count: true,
    });

    const projectIds = grouped
      .map((g) => g.projectId)
      .filter((id): id is string => id !== null);
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, color: true },
    });
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    const result = grouped.map((g) => {
      const project = g.projectId ? projectMap.get(g.projectId) : null;
      return {
        name: project?.name ?? "No Project",
        color: project?.color ?? "#94a3b8",
        totalSeconds: g._sum.duration ?? 0,
        count: g._count,
      };
    });

    return NextResponse.json(result);
  }

  if (groupBy === "tag") {
    const grouped = await prisma.timeEntry.groupBy({
      by: ["tagId"],
      where: whereBase,
      _sum: { duration: true },
      _count: true,
    });

    const tagIds = grouped
      .map((g) => g.tagId)
      .filter((id): id is string => id !== null);
    const tags = await prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true, name: true, color: true },
    });
    const tagMap = new Map(tags.map((t) => [t.id, t]));

    const result = grouped.map((g) => {
      const tag = g.tagId ? tagMap.get(g.tagId) : null;
      return {
        name: tag?.name ?? "No Tag",
        color: tag?.color ?? "#94a3b8",
        totalSeconds: g._sum.duration ?? 0,
        count: g._count,
      };
    });

    return NextResponse.json(result);
  }

  if (groupBy === "day") {
    // For day grouping, use a raw query to group by date
    const entries = await prisma.timeEntry.findMany({
      where: whereBase,
      select: { startTime: true, duration: true },
      orderBy: { startTime: "asc" },
    });

    const grouped: Record<string, { date: string; totalSeconds: number; count: number }> = {};
    for (const entry of entries) {
      const day = entry.startTime.toISOString().split("T")[0];
      if (!grouped[day]) {
        grouped[day] = { date: day, totalSeconds: 0, count: 0 };
      }
      grouped[day].totalSeconds += entry.duration ?? 0;
      grouped[day].count++;
    }
    return NextResponse.json(
      Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
    );
  }

  return NextResponse.json([]);
}
