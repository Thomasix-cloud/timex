import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.calendarAccount.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      email: true,
      createdAt: true,
      connections: {
        select: {
          id: true,
          calendarId: true,
          calendarName: true,
          syncEnabled: true,
          lastSyncAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(accounts);
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await request.json();
  if (!accountId) {
    return NextResponse.json({ error: "Account ID required" }, { status: 400 });
  }

  // Verify ownership
  const account = await prisma.calendarAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Delete account and all its connections (cascade)
  await prisma.calendarAccount.delete({
    where: { id: accountId },
  });

  return NextResponse.json({ success: true });
}
