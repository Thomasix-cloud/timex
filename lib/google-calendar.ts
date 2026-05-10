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

async function getOAuth2Client(userId: string) {
  // Get tokens from Account table (where NextAuth stores them)
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!account?.access_token) {
    throw new Error("No Google tokens found. Please reconnect your calendar.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    await prisma.account.updateMany({
      where: { userId, provider: "google" },
      data: {
        access_token: tokens.access_token ?? undefined,
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
        ...(tokens.expiry_date && {
          expires_at: Math.floor(tokens.expiry_date / 1000),
        }),
      },
    });
  });

  return oauth2Client;
}

export async function listCalendars(userId: string) {
  const auth = await getOAuth2Client(userId);
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

export async function fetchCalendarEvents(
  userId: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const auth = await getOAuth2Client(userId);
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
