import { prisma } from "@/lib/prisma";
import { syncCalendarForUser } from "@/lib/sync-engine";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all users with active calendar connections
  const users = await prisma.user.findMany({
    where: {
      calendarConnections: { some: { syncEnabled: true } },
      googleAccessToken: { not: null },
    },
    select: { id: true },
  });

  const results = [];

  for (const user of users) {
    try {
      const result = await syncCalendarForUser(user.id);
      results.push({ userId: user.id, ...result });
    } catch (error) {
      console.error(`Cron sync failed for user ${user.id}:`, error);
      results.push({ userId: user.id, error: "sync failed" });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
