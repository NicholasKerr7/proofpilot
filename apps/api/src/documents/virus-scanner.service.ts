import { Injectable } from "@nestjs/common";
import { readStoredObjectChunks } from "@proofpilot/storage";
import { createConnection, type Socket } from "node:net";
import { getApiEnv } from "../config/env.js";

const clamAvCommand = Buffer.from("zINSTREAM\0", "ascii");
const clamAvEndOfStream = Buffer.alloc(4);
const maxClamAvReplyBytes = 4_096;

export interface ClamAvConnectionConfig {
  host: string;
  port: number;
  timeoutMs: number;
}

export type VirusScanResult =
  | { engine: "clamav"; status: "clean" }
  | { engine: "clamav"; status: "infected"; threatName: string }
  | { engine: null; reason: "disabled"; status: "skipped" };

export interface StoredObjectVirusScanResult {
  result: VirusScanResult;
  sourceEtag: string | null;
}

@Injectable()
export class VirusScannerService {
  private readonly env = getApiEnv();

  async scanStoredObject(input: { key: string }): Promise<StoredObjectVirusScanResult> {
    if (this.env.VIRUS_SCAN_MODE === "disabled") {
      return {
        result: {
          engine: null,
          reason: "disabled",
          status: "skipped"
        },
        sourceEtag: null
      };
    }

    const storedObject = await readStoredObjectChunks({ key: input.key });

    try {
      return {
        result: await scanChunksWithClamAv(storedObject.chunks, {
          host: this.env.CLAMAV_HOST,
          port: this.env.CLAMAV_PORT,
          timeoutMs: this.env.CLAMAV_TIMEOUT_MS
        }),
        sourceEtag: storedObject.etag
      };
    } finally {
      await closeByteStream(storedObject.chunks);
    }
  }
}

export function scanChunksWithClamAv(
  chunks: AsyncIterable<Uint8Array>,
  config: ClamAvConnectionConfig
) {
  return new Promise<VirusScanResult>((resolve, reject) => {
    let reply = Buffer.alloc(0);
    let settled = false;
    const socket = createConnection({ host: config.host, port: config.port });

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      reject(toVirusScannerError(error));
    };

    const succeed = (result: VirusScanResult) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(config.timeoutMs);
    socket.once("timeout", () => {
      fail(new Error(`ClamAV did not respond within ${config.timeoutMs}ms.`));
    });
    socket.once("error", fail);
    socket.once("close", () => {
      if (!settled) {
        fail(new Error("ClamAV closed the connection without a complete response."));
      }
    });
    socket.on("data", (chunk) => {
      if (settled) {
        return;
      }

      reply = Buffer.concat([reply, chunk]);

      if (reply.byteLength > maxClamAvReplyBytes) {
        fail(new Error("ClamAV returned an oversized response."));
        return;
      }

      const terminatorIndex = reply.indexOf(0);

      if (terminatorIndex === -1) {
        return;
      }

      try {
        succeed(parseClamAvReply(reply.subarray(0, terminatorIndex).toString("utf8")));
      } catch (error) {
        fail(error);
      }
    });
    socket.once("connect", () => {
      socket.setNoDelay(true);
      void sendClamAvStream(socket, chunks, () => settled).catch(fail);
    });
  });
}

async function sendClamAvStream(
  socket: Socket,
  chunks: AsyncIterable<Uint8Array>,
  isSettled: () => boolean
) {
  await writeSocket(socket, clamAvCommand);

  for await (const sourceChunk of chunks) {
    if (isSettled()) {
      return;
    }

    const chunk = Buffer.from(sourceChunk);

    if (chunk.byteLength === 0) {
      continue;
    }

    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(chunk.byteLength);
    await writeSocket(socket, length);
    await writeSocket(socket, chunk);
  }

  if (!isSettled()) {
    await writeSocket(socket, clamAvEndOfStream);
  }
}

function writeSocket(socket: Socket, chunk: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    if (socket.destroyed) {
      reject(new Error("ClamAV connection closed while streaming an upload."));
      return;
    }

    socket.write(chunk, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function parseClamAvReply(value: string): VirusScanResult {
  const reply = value.trim();

  if (/^stream:\s+OK$/i.test(reply)) {
    return { engine: "clamav", status: "clean" };
  }

  const infectedMatch = /^stream:\s+(.+)\s+FOUND$/i.exec(reply);

  if (infectedMatch?.[1]) {
    return {
      engine: "clamav",
      status: "infected",
      threatName: infectedMatch[1].slice(0, 200)
    };
  }

  throw new Error("ClamAV returned an unexpected scan response.");
}

function toVirusScannerError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error("ClamAV scan failed.");
}

async function closeByteStream(chunks: AsyncIterable<Uint8Array>) {
  try {
    await chunks[Symbol.asyncIterator]().return?.();
  } catch {
    return;
  }
}
