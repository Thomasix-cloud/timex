import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export type CalendarEvent = {
  id: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  organizer: string;
  isAllDay: boolean;
};

type CalendarAccountTokens = {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: Date | null;
};

function createOAuth2Client() {
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/calendar/callback`
  );
}

async function getOAuth2ClientForAccount(account: CalendarAccountTokens) {
  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiry ? account.tokenExpiry.getTime() : undefined,
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    await prisma.calendarAccount.update({
      where: { id: account.id },
      data: {
        accessToken: tokens.access_token ?? account.accessToken,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        ...(tokens.expiry_date && {
          tokenExpiry: new Date(tokens.expiry_date),
        }),
      },
    });
  });

  return oauth2Client;
}

// Legacy: get OAuth client from NextAuth Account table (for migration)
async function getOAuth2ClientLegacy(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!account?.access_token) {
    return null;
  }

  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  return oauth2Client;
}

export function getGoogleAuthUrl(userId: string) {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state: userId,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);

  // Get the user's email for this Google account
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token ?? null,
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    email: userInfo.data.email!,
  };
}

export async function listCalendarsForAccount(account: CalendarAccountTokens) {
  const auth = await getOAuth2ClientForAccount(account);
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.calendarList.list();

  return (
    res.data.items?.map((cal) => ({
      id: cal.id!,
      name: cal.summary ?? cal.id!,
      primary: cal.primary ?? false,
    })) ?? []
  );
}

export async function listCalendars(userId: string) {
  // Try CalendarAccount tokens first, fall back to legacy Account tokens
  const calendarAccounts = await prisma.calendarAccount.findMany({
    where: { userId, provider: "google" },
  });

  const allCalendars: Array<{ id: string; name: string; primary: boolean; accountId: string | null; accountEmail: string }> = [];

  // Try each CalendarAccount individually (skip failed ones)
  for (const acct of calendarAccounts) {
    try {
      const cals = await listCalendarsForAccount(acct);
      allCalendars.push(...cals.map(c => ({ ...c, accountId: acct.id, accountEmail: acct.email })));
    } catch (e) {
      console.error(`Failed to list calendars for account ${acct.email}:`, e instanceof Error ? e.message : e);
    }
  }

  // Also try legacy Account tokens (from NextAuth Google login)
  try {
    const legacyAuth = await getOAuth2ClientLegacy(userId);
    if (legacyAuth) {
      const calendar = google.calendar({ version: "v3", auth: legacyAuth });
      const res = await calendar.calendarList.list();
      const legacyCals = res.data.items?.map((cal) => ({
        id: cal.id!,
        name: cal.summary ?? cal.id!,
        primary: cal.primary ?? false,
        accountId: null as string | null,
        accountEmail: "" as string,
      })) ?? [];
      // Only add legacy calendars not already present from CalendarAccount
      const existingIds = new Set(allCalendars.map(c => c.id));
      for (const cal of legacyCals) {
        if (!existingIds.has(cal.id)) {
          allCalendars.push(cal);
        }
      }
    }
  } catch (e) {
    console.error("Failed to list calendars via legacy tokens:", e instanceof Error ? e.message : e);
  }

  if (allCalendars.length === 0) {
    throw new Error("No Google tokens found or all accounts failed. Please reconnect a calendar account.");
  }

  return allCalendars;
}

export async function fetchCalendarEventsForAccount(
  account: CalendarAccountTokens,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const auth = await getOAuth2ClientForAccount(account);
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  return (
    res.data.items
      ?.filter((event) => event.status !== "cancelled")
      .map((event) => {
        const isAllDay = !event.start?.dateTime;
        return {
          id: event.id!,
          summary: event.summary ?? "",
          description: event.description ?? "",
          start: new Date(event.start?.dateTime ?? event.start?.date ?? ""),
          end: new Date(event.end?.dateTime ?? event.end?.date ?? ""),
          organizer: event.organizer?.email ?? "",
          isAllDay,
        };
      }) ?? []
  );
}

export async function fetchCalendarEvents(
  userId: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  // Try to find CalendarAccount for this calendar
  const connection = await prisma.calendarConnection.findFirst({
    where: { userId, calendarId },
    include: { calendarAccount: true },
  });

  if (connection?.calendarAccount) {
    return fetchCalendarEventsForAccount(connection.calendarAccount, calendarId, timeMin, timeMax);
  }

  // Legacy fallback: use Account table tokens
  const auth = await getOAuth2ClientLegacy(userId);
  if (!auth) {
    throw new Error("No Google tokens found. Please connect a calendar account.");
  }

  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  return (
    res.data.items
      ?.filter((event) => event.status !== "cancelled")
      .map((event) => {
        const isAllDay = !event.start?.dateTime;
        return {
          id: event.id!,
          summary: event.summary ?? "",
          description: event.description ?? "",
          start: new Date(event.start?.dateTime ?? event.start?.date ?? ""),
          end: new Date(event.end?.dateTime ?? event.end?.date ?? ""),
          organizer: event.organizer?.email ?? "",
          isAllDay,
        };
      }) ?? []
  );
}
