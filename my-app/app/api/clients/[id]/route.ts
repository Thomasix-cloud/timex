import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, color, isDefault } = body;

  const existing = await prisma.client.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If setting as default, unset any existing default
  if (isDefault) {
    await prisma.client.updateMany({
      where: { userId: session.user.id, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(color && { color }),
      ...(isDefault !== undefined && { isDefault }),
    },
  });

  return NextResponse.json(client);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.client.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.client.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
