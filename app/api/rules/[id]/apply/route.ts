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

  const rule = await prisma.mappingRule.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!rule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Find all time entries for this user
  const entries = await prisma.timeEntry.findMany({
    where: { userId: session.user.id },
  });

  let matched = 0;

  for (const entry of entries) {
    let fieldValue = "";
    switch (rule.matchField) {
      case "title":
        fieldValue = entry.description;
        break;
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
      const data: { projectId?: string | null; tagId?: string | null } = {};
      if (rule.projectId) data.projectId = rule.projectId;
      if (rule.tagId) data.tagId = rule.tagId;

      if (Object.keys(data).length > 0) {
        await prisma.timeEntry.update({
          where: { id: entry.id },
          data,
        });
        matched++;
      }
    }
  }

  return NextResponse.json({ matched });
}
