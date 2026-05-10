import { auth } from "@/lib/auth";
import { listCalendars } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const calendars = await listCalendars(session.user.id);

    // Get existing connections
    const connections = await prisma.calendarConnection.findMany({
      where: { userId: session.user.id },
    });

    const connectedIds = new Set(connections.map((c) => c.calendarId));

    return NextResponse.json(
      calendars.map((cal) => ({
        ...cal,
        connected: connectedIds.has(cal.id),
        connection: connections.find((c) => c.calendarId === cal.id) ?? null,
      }))
    );
  } catch (error) {
    console.error("Failed to list calendars:", error);
    return NextResponse.json(
      { error: "Failed to list calendars. Please reconnect your Google account." },
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
  const { calendarId, calendarName, syncEnabled } = body;

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
    },
    update: {
      syncEnabled: syncEnabled ?? true,
      calendarName: calendarName || undefined,
    },
  });

  return NextResponse.json(connection);
}
