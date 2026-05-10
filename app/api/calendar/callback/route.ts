import { auth } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?error=no_code", request.url)
    );
  }

  // Verify state matches the logged-in user
  if (state !== session.user.id) {
    return NextResponse.redirect(
      new URL("/settings?error=invalid_state", request.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Upsert the calendar account
    await prisma.calendarAccount.upsert({
      where: {
        userId_provider_email: {
          userId: session.user.id,
          provider: "google",
          email: tokens.email,
        },
      },
      create: {
        userId: session.user.id,
        provider: "google",
        email: tokens.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.tokenExpiry,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? undefined,
        tokenExpiry: tokens.tokenExpiry,
      },
    });

    return NextResponse.redirect(
      new URL("/settings?tab=calendar&connected=true", request.url)
    );
  } catch (error) {
    console.error("Calendar connect failed:", error);
    return NextResponse.redirect(
      new URL("/settings?error=connect_failed", request.url)
    );
  }
}
