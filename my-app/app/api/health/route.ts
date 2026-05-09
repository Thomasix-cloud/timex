import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      AUTH_SECRET_length: process.env.AUTH_SECRET?.length ?? 0,
      AUTH_URL: process.env.AUTH_URL ?? "(not set)",
      GOOGLE_CLIENT_ID_length: process.env.GOOGLE_CLIENT_ID?.length ?? 0,
      GOOGLE_CLIENT_SECRET_length: process.env.GOOGLE_CLIENT_SECRET?.length ?? 0,
      DATABASE_URL_starts: process.env.DATABASE_URL?.substring(0, 20) ?? "(not set)",
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL ?? "(not set)",
    },
  };

  try {
    const { prisma } = await import("@/lib/prisma");
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    checks.database = { connected: true, result };
  } catch (error) {
    checks.database = {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return NextResponse.json(checks);
}
