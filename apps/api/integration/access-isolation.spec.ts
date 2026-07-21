import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { AddressInfo } from "node:net";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service.js";
import {
  attackerEmail,
  createIsolationCase,
  isolationIds,
  ownerEmail,
  readProtectedState,
  removeIsolationFixtures
} from "./access-isolation.fixtures.js";
import {
  crossUserReads,
  getCrossUserMutations,
  guardedPaths,
  ownerScopedCollections,
  type RequestSpec
} from "./access-isolation.requests.js";

const password = "Password123!";

interface AuthResponse {
  accessToken: string;
}

let app: INestApplication | undefined;
let apiBaseUrl = "";
let attackerToken = "";
let prisma: PrismaService | undefined;
let protectedStateBefore: unknown;

if (!process.env.DATABASE_URL) {
  loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
}

describe.sequential("API access isolation", () => {
  beforeAll(async () => {
    const [{ AppModule }, { HttpExceptionFilter }, { ErrorMonitoringService }, prismaModule] =
      await Promise.all([
        import("../src/app.module.js"),
        import("../src/common/filters/http-exception.filter.js"),
        import("../src/monitoring/error-monitoring.service.js"),
        import("../src/prisma/prisma.service.js")
      ]);

    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true
      })
    );
    app.useGlobalFilters(new HttpExceptionFilter(app.get(ErrorMonitoringService)));
    await app.listen(0, "127.0.0.1");

    const address = app.getHttpServer().address() as AddressInfo;
    apiBaseUrl = `http://127.0.0.1:${address.port}`;
    const prismaClient = app.get(prismaModule.PrismaService);
    prisma = prismaClient;

    const owner = await prismaClient.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true }
    });

    if (!owner) {
      throw new Error("Run pnpm db:seed before the access-isolation integration suite.");
    }

    await createIsolationCase(prismaClient, owner.id);
    protectedStateBefore = await readProtectedState(prismaClient);

    const registration = await send<AuthResponse>(
      {
        body: {
          email: attackerEmail,
          name: "Isolation Attacker",
          password
        },
        method: "POST",
        path: "/auth/register"
      },
      null,
      201
    );
    attackerToken = registration.accessToken;
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      await removeIsolationFixtures(prisma);
    }

    await app?.close();
  }, 30_000);

  it("requires authentication across every user-owned controller", async () => {
    for (const path of guardedPaths) {
      await send({ path }, null, 401);
    }
  });

  it("returns not found for cross-user reads without confirming resource existence", async () => {
    for (const path of crossUserReads) {
      await send({ path }, attackerToken, 404);
    }
  });

  it("keeps owner-scoped collection responses free of foreign records", async () => {
    for (const path of ownerScopedCollections) {
      const response = await send<unknown>({ path }, attackerToken, 200);
      const serialized = JSON.stringify(response);
      expect(serialized).not.toContain(isolationIds.case);
      expect(serialized).not.toContain(ownerEmail);
      expect(serialized).not.toContain("Foreign ownership fixture");
    }
  });

  it("denies cross-user mutations across nested and direct resources", async () => {
    for (const mutation of getCrossUserMutations()) {
      await send(mutation, attackerToken, 404);
    }
  }, 30_000);

  it("leaves every protected foreign record unchanged after denied requests", async () => {
    expect(await readProtectedState(requirePrisma())).toEqual(protectedStateBefore);
  });
});

async function send<T = unknown>(
  request: RequestSpec,
  token: string | null,
  expectedStatus: number
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${request.path}`, {
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    headers: {
      ...(request.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    method: request.method ?? "GET"
  });
  const responseText = await response.text();

  expect(
    response.status,
    `${request.method ?? "GET"} ${request.path} returned ${response.status}: ${responseText}`
  ).toBe(expectedStatus);

  if (!responseText) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

function requirePrisma() {
  if (!prisma) {
    throw new Error("Prisma was not initialized.");
  }

  return prisma;
}
