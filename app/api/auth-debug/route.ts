import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {};

  try {
    const session = await auth();
    checks.session = session ? { userId: session.user?.id, email: session.user?.email } : null;

    const { prisma } = await import("@/lib/prisma");

    if (session?.user?.id) {
      // Check CalendarAccount entries
      const calAccounts = await prisma.calendarAccount.findMany({
        where: { userId: session.user.id },
      });
      
      // Test each CalendarAccount token
      const accountResults = [];
      for (const acct of calAccounts) {
        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
          );
          oauth2Client.setCredentials({
            access_token: acct.accessToken,
            refresh_token: acct.refreshToken,
          });
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });
          const res = await calendar.calendarList.list();
          accountResults.push({
            email: acct.email,
            status: "OK",
            calendarCount: res.data.items?.length ?? 0,
          });
        } catch (e: unknown) {
          const err = e as { message?: string; code?: number; errors?: unknown };
          accountResults.push({
            email: acct.email,
            status: "FAIL",
            error: err.message ?? String(e),
            code: err.code,
            errors: err.errors,
          });
        }
      }
      checks.calendarAccountTests = accountResults;

      // Test legacy Account token
      const legacyAccount = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "google" },
      });
      if (legacyAccount?.access_token) {
        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
          );
          oauth2Client.setCredentials({
            access_token: legacyAccount.access_token,
            refresh_token: legacyAccount.refresh_token,
          });
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });
          const res = await calendar.calendarList.list();
          checks.legacyTest = {
            status: "OK",
            calendarCount: res.data.items?.length ?? 0,
            scope: legacyAccount.scope,
          };
        } catch (e: unknown) {
          const err = e as { message?: string; code?: number; errors?: unknown };
          checks.legacyTest = {
            status: "FAIL",
            error: err.message ?? String(e),
            code: err.code,
            scope: legacyAccount.scope,
          };
        }
      }

      // Test User google tokens
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { googleAccessToken: true, googleRefreshToken: true },
      });
      if (user?.googleAccessToken) {
        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
          );
          oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken,
          });
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });
          const res = await calendar.calendarList.list();
          checks.userTokenTest = {
            status: "OK",
            calendarCount: res.data.items?.length ?? 0,
          };
        } catch (e: unknown) {
          const err = e as { message?: string; code?: number; errors?: unknown };
          checks.userTokenTest = {
            status: "FAIL",
            error: err.message ?? String(e),
            code: err.code,
          };
        }
      }
    }
  } catch (e) {
    checks.error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(checks);
}
