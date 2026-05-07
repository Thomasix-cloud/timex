import { prisma } from "@/lib/prisma";
import { fetchCalendarEvents, type CalendarEvent } from "@/lib/google-calendar";
import { differenceInSeconds } from "date-fns";

type MappingResult = {
  projectId: string | null;
  tagId: string | null;
};

async function applyMappingRules(
  userId: string,
  event: CalendarEvent
): Promise<MappingResult> {
  const rules = await prisma.mappingRule.findMany({
    where: { userId, isActive: true },
    orderBy: { priority: "desc" },
  });

  for (const rule of rules) {
    let fieldValue = "";
    switch (rule.matchField) {
      case "title":
        fieldValue = event.summary;
        break;
      case "description":
        fieldValue = event.description;
        break;
      case "organizer":
        fieldValue = event.organizer;
        break;
    }

    let matches = false;
    switch (rule.matchType) {
      case "contains":
        matches = fieldValue.toLowerCase().includes(rule.matchPattern.toLowerCase());
        break;
      case "exact":
        matches = fieldValue.toLowerCase() === rule.matchPattern.toLowerCase();
        break;
      case "regex":
        try {
          matches = new RegExp(rule.matchPattern, "i").test(fieldValue);
        } catch {
          matches = false;
        }
        break;
    }

    if (matches) {
      return {
        projectId: rule.projectId,
        tagId: rule.tagId,
      };
    }
  }

  return { projectId: null, tagId: null };
}

export async function syncCalendarForUser(userId: string) {
  const connections = await prisma.calendarConnection.findMany({
    where: { userId, syncEnabled: true },
  });

  if (connections.length === 0) {
    return { synced: 0, created: 0, updated: 0, skipped: 0 };
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalSynced = 0;

  for (const connection of connections) {
    const now = new Date();
    // Sync from last sync time (or 24h ago) to 1 hour ahead
    const timeMin = connection.lastSyncAt
      ? new Date(connection.lastSyncAt.getTime() - 5 * 60 * 1000) // 5min overlap
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 60 * 60 * 1000);

    let events: CalendarEvent[];
    try {
      events = await fetchCalendarEvents(
        userId,
        connection.calendarId,
        timeMin,
        timeMax
      );
    } catch (error) {
      console.error(
        `Failed to fetch events for calendar ${connection.calendarId}:`,
        error
      );
      continue;
    }

    for (const event of events) {
      // Skip all-day events
      if (event.isAllDay) {
        totalSkipped++;
        continue;
      }

      // Skip future events (only log past/current events)
      if (event.start > now) {
        totalSkipped++;
        continue;
      }

      totalSynced++;

      // Check if we already have this event
      const existing = await prisma.timeEntry.findFirst({
        where: { calendarEventId: event.id, userId },
      });

      const mapping = await applyMappingRules(userId, event);
      const duration = differenceInSeconds(event.end, event.start);

      if (existing) {
        // Update if event times changed
        if (
          existing.startTime.getTime() !== event.start.getTime() ||
          (existing.endTime && existing.endTime.getTime() !== event.end.getTime())
        ) {
          await prisma.timeEntry.update({
            where: { id: existing.id },
            data: {
              startTime: event.start,
              endTime: event.end,
              duration,
              description: event.summary,
              ...(mapping.projectId && !existing.projectId && { projectId: mapping.projectId }),
              ...(mapping.tagId && !existing.tagId && { tagId: mapping.tagId }),
            },
          });
          totalUpdated++;
        } else {
          totalSkipped++;
        }
      } else {
        // Create new entry
        await prisma.timeEntry.create({
          data: {
            description: event.summary,
            startTime: event.start,
            endTime: event.end,
            duration,
            source: "calendar",
            calendarEventId: event.id,
            projectId: mapping.projectId,
            tagId: mapping.tagId,
            userId,
          },
        });
        totalCreated++;
      }
    }

    // Update last sync time
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: now },
    });
  }

  return {
    synced: totalSynced,
    created: totalCreated,
    updated: totalUpdated,
    skipped: totalSkipped,
  };
}
