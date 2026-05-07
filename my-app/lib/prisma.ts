import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Prefer direct TCP connection (required for prisma dev with Client 7.8+)
  const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString: directUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
