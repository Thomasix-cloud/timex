import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Add missing columns using raw SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "billable" BOOLEAN NOT NULL DEFAULT true
    `);
    return NextResponse.json({ success: true, message: "Migration completed" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
