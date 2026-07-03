#!/usr/bin/env node

const config = {
  apiUrl: trimTrailingSlash(process.env.PROOFPILOT_API_URL ?? "http://localhost:4000"),
  email: process.env.PROOFPILOT_SMOKE_EMAIL ?? "nicholas.kerr@proofpilot.test",
  keepCase: isTruthy(process.env.PROOFPILOT_SMOKE_KEEP_CASE),
  password: process.env.PROOFPILOT_SMOKE_PASSWORD ?? "Password123!",
  pollMs: parsePositiveInteger(process.env.PROOFPILOT_SMOKE_POLL_MS, 2000),
  skipDownload: isTruthy(process.env.PROOFPILOT_SMOKE_SKIP_DOWNLOAD),
  timeoutMs: parsePositiveInteger(process.env.PROOFPILOT_SMOKE_TIMEOUT_MS, 90000)
};

let createdCaseId = null;
let accessToken = null;

try {
  await runSmokeTest();
} catch (error) {
  console.error("");
  console.error("Packet smoke check failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function runSmokeTest() {
  console.log(`ProofPilot packet smoke check against ${config.apiUrl}`);

  await apiRequest("/health");
  console.log("API health check passed.");

  let auth;
  try {
    auth = await apiRequest("/auth/login", {
      body: {
        email: config.email,
        password: config.password
      },
      method: "POST"
    });
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nConfirm the database is migrated, the seed has run, and the API process was restarted after recent builds.`
    );
  }

  accessToken = expectString(auth.accessToken, "auth.login accessToken");
  const currentUser = await apiRequest("/auth/me", { token: accessToken });
  const currentEmail =
    currentUser &&
    typeof currentUser === "object" &&
    "email" in currentUser &&
    typeof currentUser.email === "string"
      ? currentUser.email
      : config.email;
  console.log(`Authenticated as ${currentEmail}.`);

  const caseTypes = await apiRequest("/case-types");
  const caseTypeSlug = pickCaseTypeSlug(caseTypes);

  const createdCase = await apiRequest("/cases", {
    body: {
      caseTypeSlug,
      platform: "ProofPilot Smoke",
      summary:
        "Automated smoke test case for the authenticated packet generation flow.",
      title: `Packet smoke ${new Date().toISOString()}`
    },
    method: "POST",
    token: accessToken
  });
  createdCaseId = expectString(createdCase.id, "cases.create id");
  console.log(`Created smoke case ${createdCaseId}.`);

  try {
    await apiRequest(`/cases/${encodeURIComponent(createdCaseId)}/statement`, {
      body: {
        content:
          "This smoke-test statement verifies that the authenticated user can save appeal content before packet export."
      },
      method: "PUT",
      token: accessToken
    });
    console.log("Saved statement draft.");

    const queuedPacket = await apiRequest(
      `/cases/${encodeURIComponent(createdCaseId)}/packet/generate`,
      {
        method: "POST",
        token: accessToken
      }
    );
    const packetId = expectString(queuedPacket.id, "packet.generate id");
    console.log(`Queued packet ${packetId} with status ${queuedPacket.status}.`);

    const readyPacket = await waitForReadyPacket(createdCaseId, packetId);
    const packetExport = readyPacket.exports?.[0];
    const downloadUrl = expectString(packetExport?.downloadUrl, "ready packet downloadUrl");
    console.log(`Packet ${readyPacket.id} is ready with export ${packetExport.id}.`);

    if (config.skipDownload) {
      console.log("Skipping signed PDF download check.");
    } else {
      await verifyPdfDownload(downloadUrl);
    }

    console.log("Authenticated packet smoke check passed.");
  } finally {
    if (createdCaseId && accessToken && !config.keepCase) {
      try {
        await apiRequest(`/cases/${encodeURIComponent(createdCaseId)}`, {
          method: "DELETE",
          token: accessToken
        });
        console.log(`Archived smoke case ${createdCaseId}.`);
      } catch (error) {
        console.warn(
          `Could not archive smoke case ${createdCaseId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    } else if (createdCaseId && config.keepCase) {
      console.log(`Keeping smoke case ${createdCaseId}.`);
    }
  }
}

async function waitForReadyPacket(caseId, packetId) {
  const deadline = Date.now() + config.timeoutMs;
  let lastStatus = "unknown";

  while (Date.now() < deadline) {
    const packets = await apiRequest(`/cases/${encodeURIComponent(caseId)}/packets`, {
      token: accessToken
    });
    const packet = expectArray(packets, "cases.packets").find((item) => item.id === packetId);

    if (packet?.status && packet.status !== lastStatus) {
      lastStatus = packet.status;
      console.log(`Packet ${packetId} status: ${lastStatus}.`);
    }

    if (packet?.status === "READY") {
      return packet;
    }

    if (packet?.status === "FAILED") {
      throw new Error(
        "Packet generation failed. Check worker logs, Redis connectivity, and that the configured S3/MinIO bucket exists."
      );
    }

    await sleep(config.pollMs);
  }

  throw new Error(
    `Timed out after ${config.timeoutMs}ms waiting for packet ${packetId}. Last status: ${lastStatus}. Check that the worker is running.`
  );
}

async function verifyPdfDownload(downloadUrl) {
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Signed PDF download failed with HTTP ${response.status}.`);
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error("Signed PDF download returned an empty body.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("pdf")) {
    console.warn(`Signed download content type was ${contentType}, expected a PDF type.`);
  }

  console.log(`Verified signed PDF download (${bytes.byteLength} bytes).`);
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${config.apiUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${path} failed with HTTP ${response.status}: ${getErrorMessage(payload)}`
    );
  }

  return payload;
}

async function parseJson(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(payload) {
  if (!payload || typeof payload !== "object" || !("message" in payload)) {
    return typeof payload === "string" ? payload : responseFallbackMessage(payload);
  }

  if (Array.isArray(payload.message)) {
    return payload.message.join("; ");
  }

  return String(payload.message);
}

function responseFallbackMessage(payload) {
  return payload === null ? "No response body." : "Unexpected response body.";
}

function pickCaseTypeSlug(caseTypes) {
  const caseTypeList = expectArray(caseTypes, "case-types");
  const preferredCaseType = caseTypeList.find((caseType) => caseType.slug === "account-ban-appeal");
  const caseType = preferredCaseType ?? caseTypeList[0];
  return expectString(caseType?.slug, "case type slug");
}

function expectArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} was not an array.`);
  }

  return value;
}

function expectString(value, label) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} was missing.`);
  }

  return value;
}

function isTruthy(value) {
  return ["1", "true", "yes", "y"].includes(String(value ?? "").toLowerCase());
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
