import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const entry = await prisma.timeEntry.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rules = await prisma.mappingRule.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { priority: "desc" },
  });

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
        // Resolve clientId from the project
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
        const updated = await prisma.timeEntry.update({
          where: { id: entry.id },
          data,
          include: { project: true, tag: true, client: true },
        });
        return NextResponse.json({ matched: true, ruleName: rule.name, entry: updated });
      }
    }
  }

  return NextResponse.json({ matched: false });
}
