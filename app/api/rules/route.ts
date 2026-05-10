import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await prisma.mappingRule.findMany({
    where: { userId: session.user.id },
    include: { project: { include: { client: true } }, tag: true },
    orderBy: { priority: "desc" },
  });

  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, matchPattern, matchField, matchType, priority, projectId, tagId } = body;

  if (!name || !matchPattern) {
    return NextResponse.json(
      { error: "Name and match pattern are required" },
      { status: 400 }
    );
  }

  // Validate regex if matchType is regex
  if (matchType === "regex") {
    try {
      new RegExp(matchPattern);
    } catch {
      return NextResponse.json(
        { error: "Invalid regex pattern" },
        { status: 400 }
      );
    }
  }

  const rule = await prisma.mappingRule.create({
    data: {
      name: name.trim(),
      matchPattern: matchPattern.trim().replace(/^"|"$/g, ''),
      matchField: matchField || "title",
      matchType: matchType || "contains",
      priority: priority ?? 0,
      projectId: projectId || null,
      tagId: tagId || null,
      userId: session.user.id,
    },
    include: { project: true, tag: true },
  });

  return NextResponse.json(rule, { status: 201 });
}
