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

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId: session.user.id,
      startTime: { gte: new Date(from), lte: new Date(to) },
      endTime: { not: null },
    },
    include: { project: true, tag: true },
    orderBy: { startTime: "asc" },
  });

  // Aggregate based on groupBy
  if (groupBy === "project") {
    const grouped: Record<string, { name: string; color: string; totalSeconds: number; count: number }> = {};
    for (const entry of entries) {
      const key = entry.projectId ?? "none";
      if (!grouped[key]) {
        grouped[key] = {
          name: entry.project?.name ?? "No Project",
          color: entry.project?.color ?? "#94a3b8",
          totalSeconds: 0,
          count: 0,
        };
      }
      grouped[key].totalSeconds += entry.duration ?? 0;
      grouped[key].count++;
    }
    return NextResponse.json(Object.values(grouped));
  }

  if (groupBy === "tag") {
    const grouped: Record<string, { name: string; color: string; totalSeconds: number; count: number }> = {};
    for (const entry of entries) {
      const key = entry.tagId ?? "none";
      if (!grouped[key]) {
        grouped[key] = {
          name: entry.tag?.name ?? "No Tag",
          color: entry.tag?.color ?? "#94a3b8",
          totalSeconds: 0,
          count: 0,
        };
      }
      grouped[key].totalSeconds += entry.duration ?? 0;
      grouped[key].count++;
    }
    return NextResponse.json(Object.values(grouped));
  }

  if (groupBy === "day") {
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

  return NextResponse.json(entries);
}
