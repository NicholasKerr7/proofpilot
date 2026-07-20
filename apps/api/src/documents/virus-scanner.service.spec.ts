import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  scanChunksWithClamAv,
  type ClamAvConnectionConfig
} from "./virus-scanner.service.js";

const openServers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        })
    )
  );
});

describe("scanChunksWithClamAv", () => {
  it("streams length-prefixed chunks and accepts a clean result", async () => {
    const fixture = await startClamAvFixture("stream: OK\0");

    const result = await scanChunksWithClamAv(
      toAsyncChunks([Buffer.from("first "), Buffer.from("second")]),
      fixture.config
    );

    expect(result).toEqual({ engine: "clamav", status: "clean" });
    await expect(fixture.received).resolves.toEqual({
      command: "zINSTREAM",
      payload: Buffer.from("first second")
    });
  });

  it("returns the bounded signature name for infected content", async () => {
    const fixture = await startClamAvFixture("stream: Eicar-Signature FOUND\0");

    await expect(
      scanChunksWithClamAv(toAsyncChunks([Buffer.from("unsafe")]), fixture.config)
    ).resolves.toEqual({
      engine: "clamav",
      status: "infected",
      threatName: "Eicar-Signature"
    });
  });

  it("rejects unexpected daemon replies", async () => {
    const fixture = await startClamAvFixture("stream: scanner error ERROR\0");

    await expect(
      scanChunksWithClamAv(toAsyncChunks([Buffer.from("payload")]), fixture.config)
    ).rejects.toThrow("unexpected scan response");
  });

  it("times out when the daemon does not return a result", async () => {
    const fixture = await startClamAvFixture(null, 50);

    await expect(
      scanChunksWithClamAv(toAsyncChunks([Buffer.from("payload")]), fixture.config)
    ).rejects.toThrow("did not respond within 50ms");
  });
});

async function startClamAvFixture(response: string | null, timeoutMs = 1_000) {
  let resolveReceived: (value: { command: string; payload: Buffer }) => void = () => undefined;
  const received = new Promise<{ command: string; payload: Buffer }>((resolve) => {
    resolveReceived = resolve;
  });
  const server = createServer((socket) => {
    let command: string | null = null;
    let input = Buffer.alloc(0);
    const payloadChunks: Buffer[] = [];

    socket.on("data", (chunk) => {
      input = Buffer.concat([input, chunk]);

      if (command === null) {
        const terminatorIndex = input.indexOf(0);

        if (terminatorIndex === -1) {
          return;
        }

        command = input.subarray(0, terminatorIndex).toString("ascii");
        input = input.subarray(terminatorIndex + 1);
      }

      while (input.byteLength >= 4) {
        const chunkLength = input.readUInt32BE(0);

        if (chunkLength === 0) {
          input = input.subarray(4);
          resolveReceived({ command, payload: Buffer.concat(payloadChunks) });

          if (response !== null) {
            socket.end(Buffer.from(response, "utf8"));
          }

          return;
        }

        if (input.byteLength < chunkLength + 4) {
          return;
        }

        payloadChunks.push(input.subarray(4, chunkLength + 4));
        input = input.subarray(chunkLength + 4);
      }
    });
  });

  openServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("ClamAV test fixture did not bind a TCP port.");
  }

  const config: ClamAvConnectionConfig = {
    host: "127.0.0.1",
    port: address.port,
    timeoutMs
  };

  return { config, received };
}

async function* toAsyncChunks(chunks: Uint8Array[]) {
  yield* chunks;
}
