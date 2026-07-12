import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  connectionProviderOptions,
  type AccountConnection,
  type ConnectionMode,
  type ConnectionProvider
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";

const providerLabels: Record<ConnectionProvider, string> = {
  GMAIL: "Gmail",
  GOOGLE_DRIVE: "Google Drive",
  DROPBOX: "Dropbox",
  PAYPAL: "PayPal",
  ONEDRIVE: "Microsoft OneDrive",
  BOX: "Box"
};

const connectionSelect = {
  accountLabel: true,
  connectedAt: true,
  lastSyncedAt: true,
  mode: true,
  provider: true
} as const;

type ConnectionRecord = {
  accountLabel: string | null;
  connectedAt: Date;
  lastSyncedAt: Date | null;
  mode: string;
  provider: string;
};

@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AccountConnection[]> {
    const records = await this.prisma.connectedAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: connectionSelect
    });
    const recordsByProvider = new Map(
      records.map((record) => [record.provider as ConnectionProvider, record])
    );

    return connectionProviderOptions.map((provider) =>
      this.toAccountConnection(provider, recordsByProvider.get(provider))
    );
  }

  connect(_userId: string, providerInput: string): never {
    const provider = this.validateProvider(providerInput);

    throw new ServiceUnavailableException(
      `${providerLabels[provider]} authorization is not configured yet.`
    );
  }

  async disconnect(userId: string, providerInput: string): Promise<AccountConnection> {
    const provider = this.validateProvider(providerInput);
    const existing = await this.prisma.connectedAccount.findUnique({
      where: {
        userId_provider: { userId, provider }
      },
      select: connectionSelect
    });

    if (!existing) {
      throw new NotFoundException(`${providerLabels[provider]} is not connected.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.connectedAccount.delete({
        where: {
          userId_provider: { userId, provider }
        }
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "connection.disconnected",
          metadata: { provider }
        }
      });
    });

    return this.toAccountConnection(provider);
  }

  private validateProvider(provider: string): ConnectionProvider {
    if (!connectionProviderOptions.includes(provider as ConnectionProvider)) {
      throw new BadRequestException("Connection provider is not supported.");
    }

    return provider as ConnectionProvider;
  }

  private toAccountConnection(
    provider: ConnectionProvider,
    record?: ConnectionRecord
  ): AccountConnection {
    return {
      accountLabel: record?.accountLabel ?? null,
      authorizationConfigured: false,
      connectedAt: record?.connectedAt.toISOString() ?? null,
      lastSyncedAt: record?.lastSyncedAt?.toISOString() ?? null,
      mode: (record?.mode as ConnectionMode | undefined) ?? null,
      provider,
      status: record ? "CONNECTED" : "NOT_CONNECTED"
    };
  }
}
