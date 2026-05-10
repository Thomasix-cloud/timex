import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const results: string[] = [];
  const migrations = [
    // TimeEntry columns
    `ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "billable" BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "clientId" TEXT`,
    `ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual'`,
    `ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT`,
    `ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "tagId" TEXT`,
    // TimeEntry indexes
    `CREATE INDEX IF NOT EXISTS "TimeEntry_userId_startTime_idx" ON "TimeEntry"("userId", "startTime")`,
    `CREATE INDEX IF NOT EXISTS "TimeEntry_userId_endTime_idx" ON "TimeEntry"("userId", "endTime")`,
    `CREATE INDEX IF NOT EXISTS "TimeEntry_calendarEventId_idx" ON "TimeEntry"("calendarEventId")`,
    // TimeEntry foreign keys (safe with IF NOT EXISTS pattern)
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_clientId_fkey') THEN ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL; END IF; END $$`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_tagId_fkey') THEN ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL; END IF; END $$`,
    // User columns
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleAccessToken" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleRefreshToken" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleTokenExpiry" TIMESTAMP(3)`,
    // Client table
    `CREATE TABLE IF NOT EXISTS "Client" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT NOT NULL DEFAULT '#3b82f6', "isDefault" BOOLEAN NOT NULL DEFAULT false, "userId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Client_pkey" PRIMARY KEY ("id"))`,
    `CREATE INDEX IF NOT EXISTS "Client_userId_idx" ON "Client"("userId")`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Client_userId_fkey') THEN ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE; END IF; END $$`,
    // MappingRule table
    `CREATE TABLE IF NOT EXISTS "MappingRule" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "matchPattern" TEXT NOT NULL, "matchField" TEXT NOT NULL DEFAULT 'title', "matchType" TEXT NOT NULL DEFAULT 'contains', "priority" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "projectId" TEXT, "tagId" TEXT, "userId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "MappingRule_pkey" PRIMARY KEY ("id"))`,
    `CREATE INDEX IF NOT EXISTS "MappingRule_userId_idx" ON "MappingRule"("userId")`,
    // CalendarConnection table
    `CREATE TABLE IF NOT EXISTS "CalendarConnection" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "provider" TEXT NOT NULL DEFAULT 'google', "calendarId" TEXT NOT NULL, "calendarName" TEXT NOT NULL DEFAULT '', "syncEnabled" BOOLEAN NOT NULL DEFAULT true, "lastSyncAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id"))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CalendarConnection_userId_provider_calendarId_key" ON "CalendarConnection"("userId", "provider", "calendarId")`,
    `CREATE INDEX IF NOT EXISTS "CalendarConnection_userId_idx" ON "CalendarConnection"("userId")`,
    // Project columns
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientId" TEXT`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_clientId_fkey') THEN ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL; END IF; END $$`,
    // User password for credentials login
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password" TEXT`,
    // CalendarAccount table
    `CREATE TABLE IF NOT EXISTS "CalendarAccount" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "provider" TEXT NOT NULL DEFAULT 'google', "email" TEXT NOT NULL, "accessToken" TEXT NOT NULL, "refreshToken" TEXT, "tokenExpiry" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CalendarAccount_pkey" PRIMARY KEY ("id"))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "CalendarAccount_userId_provider_email_key" ON "CalendarAccount"("userId", "provider", "email")`,
    `CREATE INDEX IF NOT EXISTS "CalendarAccount_userId_idx" ON "CalendarAccount"("userId")`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarAccount_userId_fkey') THEN ALTER TABLE "CalendarAccount" ADD CONSTRAINT "CalendarAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE; END IF; END $$`,
    // CalendarConnection -> CalendarAccount link
    `ALTER TABLE "CalendarConnection" ADD COLUMN IF NOT EXISTS "calendarAccountId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "CalendarConnection_calendarAccountId_idx" ON "CalendarConnection"("calendarAccountId")`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarConnection_calendarAccountId_fkey') THEN ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_calendarAccountId_fkey" FOREIGN KEY ("calendarAccountId") REFERENCES "CalendarAccount"("id") ON DELETE SET NULL; END IF; END $$`,
  ];

  for (const sql of migrations) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push(`OK: ${sql.substring(0, 60)}...`);
    } catch (error) {
      results.push(`FAIL: ${sql.substring(0, 60)}... - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return NextResponse.json({ results });
}
