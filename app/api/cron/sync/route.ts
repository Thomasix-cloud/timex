import { prisma } from "@/lib/prisma";
import { syncCalendarForUser } from "@/lib/sync-engine";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const maxDuration = 60;

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
      OR: [
        { googleAccessToken: { not: null } },
        { calendarAccounts: { some: {} } },
      ],
    },
    select: { id: true },
  });

  // Process users concurrently in batches of 5
  const BATCH_SIZE = 5;
  const results: Array<{ userId: string; [key: string]: unknown }> = [];

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((user) => syncCalendarForUser(user.id).then((r) => ({ userId: user.id, ...r })))
    );
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        const userId = batch[batchResults.indexOf(result)]?.id ?? "unknown";
        console.error(`Cron sync failed for user ${userId}:`, result.reason);
        results.push({ userId, error: "sync failed" });
      }
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
