import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type BucketLocationConstraint,
  type CreateBucketCommandInput,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const booleanEnvSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  return value;
}, z.boolean());

const storageEnvSchema = z.object({
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_FORCE_PATH_STYLE: booleanEnvSchema.default(true)
});

let client: S3Client | null = null;

export function getStorageConfig(env: NodeJS.ProcessEnv = process.env) {
  return storageEnvSchema.parse(env);
}

export function getStorageClient(env: NodeJS.ProcessEnv = process.env) {
  const config = getStorageConfig(env);

  if (!client) {
    const clientConfig: S3ClientConfig = {
      forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
      region: config.STORAGE_REGION,
      credentials: {
        accessKeyId: config.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY
      }
    };

    if (config.STORAGE_ENDPOINT) {
      clientConfig.endpoint = config.STORAGE_ENDPOINT;
    }

    client = new S3Client(clientConfig);
  }

  return client;
}

export async function ensureStorageBucket(env: NodeJS.ProcessEnv = process.env) {
  const config = getStorageConfig(env);
  const storageClient = getStorageClient(env);

  try {
    await storageClient.send(new HeadBucketCommand({ Bucket: config.STORAGE_BUCKET }));

    return {
      bucket: config.STORAGE_BUCKET,
      created: false,
      endpoint: config.STORAGE_ENDPOINT ?? "aws-s3",
      region: config.STORAGE_REGION
    };
  } catch (error) {
    if (!isMissingBucketError(error)) {
      throw error;
    }
  }

  const createInput: CreateBucketCommandInput = {
    Bucket: config.STORAGE_BUCKET
  };

  if (!config.STORAGE_ENDPOINT && config.STORAGE_REGION !== "us-east-1") {
    createInput.CreateBucketConfiguration = {
      LocationConstraint: config.STORAGE_REGION as BucketLocationConstraint
    };
  }

  await storageClient.send(new CreateBucketCommand(createInput));
  await storageClient.send(new HeadBucketCommand({ Bucket: config.STORAGE_BUCKET }));

  return {
    bucket: config.STORAGE_BUCKET,
    created: true,
    endpoint: config.STORAGE_ENDPOINT ?? "aws-s3",
    region: config.STORAGE_REGION
  };
}

export async function createPresignedUploadUrl(input: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const config = getStorageConfig();
  const command = new PutObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: input.key,
    ContentType: input.contentType
  });

  return getSignedUrl(getStorageClient(), command, {
    expiresIn: input.expiresInSeconds ?? 900
  });
}

export async function createPresignedDownloadUrl(input: {
  key: string;
  disposition?: "attachment" | "inline";
  expiresInSeconds?: number;
  fileName?: string;
}) {
  const config = getStorageConfig();
  const command = new GetObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: input.key,
    ...(input.disposition
      ? {
          ResponseContentDisposition: `${input.disposition}; filename="${sanitizeDownloadFileName(input.fileName)}"`
        }
      : {})
  });

  return getSignedUrl(getStorageClient(), command, {
    expiresIn: input.expiresInSeconds ?? 300
  });
}

function sanitizeDownloadFileName(value: string | undefined) {
  const sanitized = (value ?? "proofpilot-packet.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized || "proofpilot-packet.pdf";
}

export async function deleteStoredObject(input: { key: string }) {
  const config = getStorageConfig();
  const command = new DeleteObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: input.key
  });

  await getStorageClient().send(command);
}

export async function copyStoredObject(input: {
  destinationKey: string;
  sourceEtag: string;
  sourceKey: string;
}) {
  const config = getStorageConfig();
  const command = new CopyObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    CopySource: createCopySource(config.STORAGE_BUCKET, input.sourceKey),
    CopySourceIfMatch: input.sourceEtag,
    Key: input.destinationKey
  });
  const response = await getStorageClient().send(command);

  return {
    etag: response.CopyObjectResult?.ETag ?? null
  };
}

export async function headStoredObject(input: { key: string }) {
  const config = getStorageConfig();
  const command = new HeadObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: input.key
  });
  const response = await getStorageClient().send(command);

  return {
    byteSize: response.ContentLength ?? 0,
    contentType: response.ContentType ?? null,
    etag: response.ETag ?? null,
    lastModified: response.LastModified ?? null
  };
}

export async function writeStoredObjectBytes(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}) {
  const config = getStorageConfig();
  const command = new PutObjectCommand({
    Body: input.body,
    Bucket: config.STORAGE_BUCKET,
    ContentType: input.contentType,
    Key: input.key
  });

  await getStorageClient().send(command);
}

export async function readStoredObjectBytes(input: { key: string }) {
  const config = getStorageConfig();
  const command = new GetObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: input.key
  });
  const response = await getStorageClient().send(command);

  if (!response.Body) {
    return Buffer.from([]);
  }

  return Buffer.from(await response.Body.transformToByteArray());
}

export async function readStoredObjectChunks(input: { key: string }) {
  const config = getStorageConfig();
  const command = new GetObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: input.key
  });
  const response = await getStorageClient().send(command);

  if (!isAsyncByteIterable(response.Body)) {
    throw new Error("Stored object body is not available as a byte stream.");
  }

  return {
    chunks: response.Body,
    etag: response.ETag ?? null
  };
}

function isAsyncByteIterable(value: unknown): value is AsyncIterable<Uint8Array> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof (value as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function"
  );
}

function isMissingBucketError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorWithMetadata = error as {
    $metadata?: { httpStatusCode?: number };
    Code?: string;
    code?: string;
    name?: string;
  };
  const statusCode = errorWithMetadata.$metadata?.httpStatusCode;
  const errorCode = errorWithMetadata.Code ?? errorWithMetadata.code ?? errorWithMetadata.name;

  return statusCode === 404 || errorCode === "NotFound" || errorCode === "NoSuchBucket";
}

function createCopySource(bucket: string, key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${encodeURIComponent(bucket)}/${encodedKey}`;
}
