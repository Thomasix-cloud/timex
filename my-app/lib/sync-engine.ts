import { prisma } from "@/lib/prisma";
import { fetchCalendarEvents, type CalendarEvent } from "@/lib/google-calendar";
import { differenceInSeconds } from "date-fns";

type MappingResult = {
  projectId: string | null;
  tagId: string | null;
  clientId: string | null;
};

type MappingRule = {
  matchField: string;
  matchType: string;
  matchPattern: string;
  projectId: string | null;
  tagId: string | null;
  project: { clientId: string | null } | null;
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
      case "wildcard": {
        const escaped = rule.matchPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        const wildcardRegex = new RegExp("^" + escaped.replace(/\*/g, ".*") + "$", "i");
        matches = wildcardRegex.test(fieldValue);
        break;
      }
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
        clientId: rule.project?.clientId ?? null,
      };
    }
  }

  return { projectId: null, tagId: null, clientId: null };
}

export async function syncCalendarForUser(userId: string) {
  // Pre-fetch mapping rules and all projects (for clientId resolution) once
  const [connections, rules, projects] = await Promise.all([
    prisma.calendarConnection.findMany({
      where: { userId, syncEnabled: true },
    }),
    prisma.mappingRule.findMany({
      where: { userId, isActive: true },
      orderBy: { priority: "desc" },
      include: { project: { select: { clientId: true } } },
    }),
    prisma.project.findMany({
      where: { userId },
      select: { id: true, clientId: true },
    }),
  ]);

  const projectClientMap = new Map(
    projects.map((p) => [p.id, p.clientId])
  );

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
      include: { project: { select: { clientId: true } } },
    });
    const existingByEventId = new Map(
      existingEntries.map((e) => [e.calendarEventId, e])
    );

    // Collect all DB operations and execute in a single transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const operations: any[] = [];

    for (const event of relevantEvents) {
      const existing = existingByEventId.get(event.id);
      const mapping = applyMappingRules(rules, event);
      const duration = differenceInSeconds(event.end, event.start);

      if (existing) {
        const timeChanged =
          existing.startTime.getTime() !== event.start.getTime() ||
          (existing.endTime && existing.endTime.getTime() !== event.end.getTime());

        // Build update data for missing fields (project, tag, client)
        const missingFields: Record<string, string> = {};
        if (mapping.projectId && !existing.projectId) missingFields.projectId = mapping.projectId;
        if (mapping.tagId && !existing.tagId) missingFields.tagId = mapping.tagId;
        if (!existing.clientId) {
          // Resolve clientId: from mapping, from existing entry's project, or from newly assigned project
          const resolvedClientId = mapping.clientId
            ?? (existing.projectId ? projectClientMap.get(existing.projectId) ?? null : null)
            ?? (missingFields.projectId ? projectClientMap.get(missingFields.projectId) ?? null : null);
          if (resolvedClientId) missingFields.clientId = resolvedClientId;
        }

        if (timeChanged || Object.keys(missingFields).length > 0) {
          operations.push(
            prisma.timeEntry.update({
              where: { id: existing.id },
              data: {
                ...(timeChanged && {
                  startTime: event.start,
                  endTime: event.end,
                  duration,
                  description: event.summary,
                }),
                ...missingFields,
              },
            })
          );
          totalUpdated++;
        } else {
          totalSkipped++;
        }
      } else {
        // Resolve clientId from mapping or from project's client
        const clientId = mapping.clientId
          ?? (mapping.projectId ? projectClientMap.get(mapping.projectId) ?? null : null);
        operations.push(
          prisma.timeEntry.create({
            data: {
              description: event.summary,
              startTime: event.start,
              endTime: event.end,
              duration,
              source: "calendar",
              calendarEventId: event.id,
              projectId: mapping.projectId,
              tagId: mapping.tagId,
              clientId,
              userId,
            },
          })
        );
        totalCreated++;
      }
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
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
