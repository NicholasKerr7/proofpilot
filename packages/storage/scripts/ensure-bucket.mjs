import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureStorageBucket } from "../dist/index.js";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(packageDir, "..", "..");
const inheritedEnvKeys = new Set(Object.keys(process.env));

await loadEnvFile(join(repoRoot, ".env"));
await loadEnvFile(join(repoRoot, ".env.local"));

try {
  const result = await ensureStorageBucket();
  const action = result.created ? "created" : "verified";

  console.log(`Storage bucket ${action}`, {
    bucket: result.bucket,
    endpoint: result.endpoint,
    region: result.region
  });
} catch (error) {
  console.error("Storage bucket bootstrap failed", formatStorageError(error));
  process.exitCode = 1;
}

async function loadEnvFile(filePath) {
  try {
    await access(filePath);
  } catch {
    return;
  }

  const content = await readFile(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);

    if (!parsed || inheritedEnvKeys.has(parsed.key)) {
      continue;
    }

    process.env[parsed.key] = parsed.value;
  }
}

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const envLine = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const separatorIndex = envLine.indexOf("=");

  if (separatorIndex === -1) {
    return null;
  }

  const key = envLine.slice(0, separatorIndex).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return {
    key,
    value: parseEnvValue(envLine.slice(separatorIndex + 1).trim())
  };
}

function parseEnvValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll("\\n", "\n").replaceAll('\\"', '"');
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value.replace(/\s+#.*$/, "").trim();
}

function formatStorageError(error) {
  if (!error || typeof error !== "object") {
    return { error: "Unknown storage error" };
  }

  const code = error.Code ?? error.code;

  return {
    code,
    endpoint: process.env.STORAGE_ENDPOINT ?? "aws-s3",
    error: error.message || "Storage request failed",
    hint: code === "ECONNREFUSED" ? "Check that the storage endpoint is running." : undefined,
    name: error.name,
    statusCode: error.$metadata?.httpStatusCode
  };
}
