import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@proofpilot/database";
import { Pool } from "pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required to initialize Prisma.");
    }

    const pool = new Pool({ connectionString: databaseUrl });
    super({
      adapter: new PrismaPg(pool)
    });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
