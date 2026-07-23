import { createHmac, timingSafeEqual } from "node:crypto";

const recipientTokenVersion = "pp1";

interface PacketShareRecipientTokenPayload {
  recipientId: string;
  shareId: string;
}

export function createPacketShareRecipientToken(
  payload: PacketShareRecipientTokenPayload,
  secret: string
) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const value = `${recipientTokenVersion}.${encodedPayload}`;
  return `${value}.${sign(value, secret)}`;
}

export function verifyPacketShareRecipientToken(
  token: string,
  secret: string
): PacketShareRecipientTokenPayload | null {
  const [version, encodedPayload, signature, ...remainder] = token.split(".");

  if (
    version !== recipientTokenVersion ||
    !encodedPayload ||
    !signature ||
    remainder.length
  ) {
    return null;
  }

  const expectedSignature = sign(`${version}.${encodedPayload}`, secret);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<PacketShareRecipientTokenPayload>;

    if (!isResourceId(parsed.shareId) || !isResourceId(parsed.recipientId)) {
      return null;
    }

    return {
      recipientId: parsed.recipientId,
      shareId: parsed.shareId
    };
  } catch {
    return null;
  }
}

export function hashPacketShareAccessCode(
  challengeId: string,
  code: string,
  secret: string
) {
  return sign(`packet-share-access:${challengeId}:${code}`, secret);
}

export function verifyPacketShareAccessCode(
  challengeId: string,
  code: string,
  expectedHash: string,
  secret: string
) {
  return safeEqual(
    hashPacketShareAccessCode(challengeId, code, secret),
    expectedHash
  );
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isResourceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}
