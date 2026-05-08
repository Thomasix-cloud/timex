import { prisma } from "@/lib/prisma";
import { fetchCalendarEvents, type CalendarEvent } from "@/lib/google-calendar";
import { differenceInSeconds } from "date-fns";

type MappingResult = {
  projectId: string | null;
  tagId: string | null;
};

type MappingRule = {
  matchField: string;
  matchType: string;
  matchPattern: string;
  projectId: string | null;
  tagId: string | null;
};

function applyMappingRules(
  rules: MappingRule[],
  event: CalendarEvent
): MappingResult {
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
  // Pre-fetch mapping rules once for this user
  const [connections, rules] = await Promise.all([
    prisma.calendarConnection.findMany({
      where: { userId, syncEnabled: true },
    }),
    prisma.mappingRule.findMany({
      where: { userId, isActive: true },
      orderBy: { priority: "desc" },
    }),
  ]);

  if (connections.length === 0) {
    return { synced: 0, created: 0, updated: 0, skipped: 0 };
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalSynced = 0;

  for (const connection of connections) {
    const now = new Date();
    const timeMin = connection.lastSyncAt
      ? new Date(connection.lastSyncAt.getTime() - 5 * 60 * 1000)
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

    // Filter events: skip all-day and future
    const relevantEvents = events.filter((event) => {
      if (event.isAllDay || event.start > now) {
        totalSkipped++;
        return false;
      }
      return true;
    });

    if (relevantEvents.length === 0) {
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: now },
      });
      continue;
    }

    totalSynced += relevantEvents.length;

    // Batch-fetch all existing entries for these events in one query
    const eventIds = relevantEvents.map((e) => e.id);
    const existingEntries = await prisma.timeEntry.findMany({
      where: { calendarEventId: { in: eventIds }, userId },
    });
    const existingByEventId = new Map(
      existingEntries.map((e) => [e.calendarEventId, e])
    );

    // Process events sequentially — each query releases connection back to pool
    for (const event of relevantEvents) {
      const existing = existingByEventId.get(event.id);
      const mapping = applyMappingRules(rules, event);
      const duration = differenceInSeconds(event.end, event.start);

      if (existing) {
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
