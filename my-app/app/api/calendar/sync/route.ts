import { auth } from "@/lib/auth";
import { syncCalendarForUser } from "@/lib/sync-engine";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncCalendarForUser(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Calendar sync failed:", error);
    return NextResponse.json(
      { error: "Calendar sync failed. Please check your calendar connection." },
      { status: 500 }
    );
  }
}
