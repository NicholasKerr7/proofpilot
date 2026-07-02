import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const storageEnvSchema = z.object({
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true)
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
  expiresInSeconds?: number;
}) {
  const config = getStorageConfig();
  const command = new GetObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: input.key
  });

  return getSignedUrl(getStorageClient(), command, {
    expiresIn: input.expiresInSeconds ?? 300
  });
}

export async function deleteStoredObject(input: { key: string }) {
  const config = getStorageConfig();
  const command = new DeleteObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: input.key
  });

  await getStorageClient().send(command);
}
