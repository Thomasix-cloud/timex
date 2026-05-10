import { auth } from "@/lib/auth";
import { listCalendars } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: filter by account
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");

  try {
    const calendars = await listCalendars(session.user.id);

    // Filter by account if specified
    const filtered = accountId
      ? calendars.filter((c) => c.accountId === accountId)
      : calendars;

    // Get existing connections
    const connections = await prisma.calendarConnection.findMany({
      where: { userId: session.user.id },
    });

    const connectionMap = new Map(
      connections.map((c) => [c.calendarId, c])
    );

    return NextResponse.json(
      filtered.map((cal) => {
        const conn = connectionMap.get(cal.id);
        return {
          ...cal,
          connected: !!conn?.syncEnabled,
          connection: conn
            ? {
                id: conn.id,
                syncEnabled: conn.syncEnabled,
                lastSyncAt: conn.lastSyncAt,
              }
            : null,
        };
      })
    );
  } catch (error) {
    console.error("Failed to list calendars:", error);
    return NextResponse.json(
      { error: "Failed to list calendars", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { calendarId, calendarName, syncEnabled, accountId } = body;

  if (!calendarId) {
    return NextResponse.json(
      { error: "Calendar ID is required" },
      { status: 400 }
    );
  }

  const connection = await prisma.calendarConnection.upsert({
    where: {
      userId_provider_calendarId: {
        userId: session.user.id,
        provider: "google",
        calendarId,
      },
    },
    create: {
      userId: session.user.id,
      provider: "google",
      calendarId,
      calendarName: calendarName || "",
      syncEnabled: syncEnabled ?? true,
      calendarAccountId: accountId || null,
    },
    update: {
      syncEnabled: syncEnabled ?? true,
      calendarName: calendarName || undefined,
      calendarAccountId: accountId || undefined,
    },
  });

  return NextResponse.json(connection);
}
