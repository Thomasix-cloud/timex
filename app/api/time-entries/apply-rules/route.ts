import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { entryIds } = body as { entryIds?: string[] };

  if (!entryIds || entryIds.length === 0) {
    return NextResponse.json({ error: "No entries provided" }, { status: 400 });
  }

  const rules = await prisma.mappingRule.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { priority: "desc" },
  });

  if (rules.length === 0) {
    return NextResponse.json({ matched: 0, message: "No active rules" });
  }

  const entries = await prisma.timeEntry.findMany({
    where: { id: { in: entryIds }, userId: session.user.id },
  });

  let matched = 0;

  for (const entry of entries) {
    for (const rule of rules) {
      let fieldValue = "";
      switch (rule.matchField) {
        case "title":
        case "description":
          fieldValue = entry.description;
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
        const data: { projectId?: string | null; tagId?: string | null; clientId?: string | null } = {};
        if (rule.projectId) {
          data.projectId = rule.projectId;
          const project = await prisma.project.findUnique({
            where: { id: rule.projectId },
            select: { clientId: true },
          });
          if (project?.clientId) {
            data.clientId = project.clientId;
          }
        }
        if (rule.tagId) data.tagId = rule.tagId;

        if (Object.keys(data).length > 0) {
          await prisma.timeEntry.update({
            where: { id: entry.id },
            data,
          });
          matched++;
        }
        break; // first matching rule wins per entry
      }
    }
  }

  return NextResponse.json({ matched });
}
