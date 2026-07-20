import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

let prisma: PrismaClient | null = null;
let pool: Pool | null = null;

export * from "@prisma/client";
export * from "./checklist-analysis.js";

export function getPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }

  if (!prisma) {
    pool = new Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({
      adapter: new PrismaPg(pool)
    });
  }

  return prisma;
}

export async function closePrismaClient() {
  await prisma?.$disconnect();
  await pool?.end();
  prisma = null;
  pool = null;
}
