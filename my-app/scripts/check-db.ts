import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

async function main() {
  const adapter = new PrismaPg({ connectionString: "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable" });
  const prisma = new PrismaClient({ adapter });

  const users = await prisma.user.findMany({ select: { id: true, email: true, googleAccessToken: true, googleRefreshToken: true } });
  console.log("Users:", JSON.stringify(users, null, 2));

  const accounts = await prisma.account.findMany({ select: { userId: true, provider: true, access_token: true, refresh_token: true } });
  console.log("Accounts:", JSON.stringify(accounts, null, 2));

  process.exit(0);
}

main();
