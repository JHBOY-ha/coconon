import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getEncryptionSecret } from "@/lib/env";

function getKey() {
  return createHash("sha256").update(getEncryptionSecret()).digest();
}

export function encryptText(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptText(payload: string) {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(":");

  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Malformed encrypted payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskSecret(value: string) {
  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
