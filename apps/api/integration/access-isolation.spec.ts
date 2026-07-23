import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createHash, randomBytes } from "node:crypto";
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
let attackerId = "";
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
    const attacker = await prismaClient.user.findUnique({
      where: { email: attackerEmail },
      select: { id: true }
    });

    if (!attacker) {
      throw new Error("Integration collaborator account was not created.");
    }

    attackerId = attacker.id;
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

  it("accepts a matching invitation once and binds it to the authenticated account", async () => {
    const rawToken = randomBytes(32).toString("base64url");
    const inviteTokenHash = createHash("sha256").update(rawToken).digest("hex");
    await requirePrisma().caseCollaborator.update({
      where: { id: isolationIds.collaborator },
      data: {
        acceptedAt: null,
        email: attackerEmail,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        inviteTokenHash,
        invitedAt: new Date(),
        name: null,
        role: "VIEWER",
        status: "PENDING",
        userId: null
      }
    });

    const preview = await send<{
      caseTitle: string;
      invitedEmail: string;
      role: string;
      status: string;
    }>({ path: `/collaboration/invitations/${rawToken}` }, null, 200);
    expect(preview).toMatchObject({
      caseTitle: "Foreign ownership fixture",
      invitedEmail: attackerEmail,
      role: "VIEWER",
      status: "PENDING"
    });

    const acceptance = await send<{ caseId: string; ok: boolean; role: string }>(
      {
        method: "POST",
        path: `/collaboration/invitations/${rawToken}/accept`
      },
      attackerToken,
      200
    );
    expect(acceptance).toMatchObject({
      caseId: isolationIds.case,
      ok: true,
      role: "VIEWER"
    });
    await send({ path: `/collaboration/invitations/${rawToken}` }, null, 404);
    await send(
      {
        method: "POST",
        path: `/collaboration/invitations/${rawToken}/accept`
      },
      attackerToken,
      404
    );

    const collaborator = await requirePrisma().caseCollaborator.findUnique({
      where: { id: isolationIds.collaborator },
      select: {
        acceptedAt: true,
        expiresAt: true,
        inviteTokenHash: true,
        status: true,
        userId: true
      }
    });
    expect(collaborator).toMatchObject({
      expiresAt: null,
      inviteTokenHash: null,
      status: "ACTIVE",
      userId: attackerId
    });
    expect(collaborator?.acceptedAt).toBeInstanceOf(Date);
  });

  it("allows viewer reads while denying writes, downloads, and owner controls", async () => {
    await requirePrisma().caseSharingSettings.update({
      where: { caseId: isolationIds.case },
      data: { preventDownloads: true }
    });

    const caseRecord = await send<{
      access: {
        canDownload: boolean;
        canEdit: boolean;
        canManage: boolean;
        role: string;
      };
      id: string;
    }>({ path: `/cases/${isolationIds.case}` }, attackerToken, 200);
    expect(caseRecord).toMatchObject({
      id: isolationIds.case,
      access: {
        canDownload: false,
        canEdit: false,
        canManage: false,
        role: "VIEWER"
      }
    });

    const cases = await send<Array<{ access: { role: string }; id: string }>>(
      { path: "/cases" },
      attackerToken,
      200
    );
    expect(cases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: isolationIds.case,
          access: expect.objectContaining({ role: "VIEWER" })
        })
      ])
    );
    await send({ path: `/cases/${isolationIds.case}/documents` }, attackerToken, 200);
    await send({ path: `/cases/${isolationIds.case}/proof-map` }, attackerToken, 200);
    await send({ path: `/cases/${isolationIds.case}/submissions` }, attackerToken, 200);
    const document = await send<{ downloadUrl: string | null }>(
      { path: `/documents/${isolationIds.document}` },
      attackerToken,
      200
    );
    expect(document.downloadUrl).toBeNull();
    await send({ path: `/cases/${isolationIds.case}/packets` }, attackerToken, 404);
    await send(
      {
        body: { title: "Viewer write must fail" },
        method: "PATCH",
        path: `/cases/${isolationIds.case}`
      },
      attackerToken,
      404
    );
    await send(
      {
        body: {
          message: "Viewer reminder must fail",
          remindAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        method: "POST",
        path: `/cases/${isolationIds.case}/reminders`
      },
      attackerToken,
      404
    );
    await send(
      { path: `/cases/${isolationIds.case}/collaboration` },
      attackerToken,
      404
    );
    await send(
      { method: "DELETE", path: `/cases/${isolationIds.case}` },
      attackerToken,
      404
    );
  });

  it("allows editor writes while preserving owner-only management", async () => {
    await requirePrisma().caseCollaborator.update({
      where: { id: isolationIds.collaborator },
      data: { role: "EDITOR" }
    });

    await send(
      {
        body: { title: "Editor-updated collaboration fixture" },
        method: "PATCH",
        path: `/cases/${isolationIds.case}`
      },
      attackerToken,
      200
    );
    const caseRecord = await send<{
      access: {
        canDownload: boolean;
        canEdit: boolean;
        canManage: boolean;
        role: string;
      };
    }>({ path: `/cases/${isolationIds.case}` }, attackerToken, 200);
    expect(caseRecord.access).toEqual({
      canDownload: true,
      canEdit: true,
      canManage: false,
      role: "EDITOR"
    });
    await send(
      { path: `/cases/${isolationIds.case}/collaboration` },
      attackerToken,
      404
    );
    await send(
      { method: "DELETE", path: `/cases/${isolationIds.case}` },
      attackerToken,
      404
    );

    const editorAudit = await requirePrisma().auditLog.findFirst({
      where: {
        action: "case.updated",
        caseId: isolationIds.case,
        userId: attackerId
      },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });
    expect(editorAudit).not.toBeNull();
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
