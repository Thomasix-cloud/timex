import { auth } from "@/lib/auth";
import { getGoogleAuthUrl } from "@/lib/google-calendar";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = getGoogleAuthUrl(session.user.id);
  return NextResponse.json({ url });
}
