import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import "dotenv/config";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const entries = await prisma.timeEntry.findMany({
    where: { startTime: { gte: new Date("2026-05-09T00:00:00Z") } },
    select: { id: true, description: true, projectId: true, clientId: true },
    orderBy: { startTime: "desc" },
  });

  console.log("=== Entries from 2026-05-09 ===");
  for (const e of entries) {
    console.log(
      (e.description ?? "").substring(0, 40).padEnd(42),
      "proj:", e.projectId ? "YES" : "null",
      "client:", e.clientId ? e.clientId.substring(0, 10) : "null"
    );
  }

  console.log("\n=== Projects with clients ===");
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, clientId: true },
  });
  for (const p of projects) {
    console.log(p.name.padEnd(30), "clientId:", p.clientId ?? "null");
  }

  console.log("\n=== Clients ===");
  const clients = await prisma.client.findMany();
  for (const c of clients) {
    console.log(c.id, c.name, c.color);
  }

  await prisma.$disconnect();
}

main();
