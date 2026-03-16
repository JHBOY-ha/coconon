import { prisma } from "@/lib/prisma";
import { decryptText, encryptText } from "@/lib/crypto";
import { getDefaultLlmBaseUrl, getDefaultLlmModel } from "@/lib/env";
import type { AppConfigRecord, BiliCredentialRecord } from "@/lib/store-types";

export async function ensureAppConfig(): Promise<AppConfigRecord> {
  return (await prisma.appConfig.upsert({
    where: { singleton: "default" },
    update: {},
    create: {
      singleton: "default",
      llmBaseUrl: getDefaultLlmBaseUrl(),
      llmModel: getDefaultLlmModel(),
    },
  })) as AppConfigRecord;
}

export async function ensureBiliCredential(): Promise<BiliCredentialRecord> {
  return (await prisma.biliCredential.upsert({
    where: { singleton: "default" },
    update: {},
    create: { singleton: "default" },
  })) as BiliCredentialRecord;
}

export async function getDecryptedCookie() {
  const credential = await ensureBiliCredential();

  if (!credential.cookieEncrypted) {
    return null;
  }

  return decryptText(credential.cookieEncrypted);
}

export async function saveBiliCookie(cookie: string) {
  const encrypted = encryptText(cookie);
  const preview = cookie
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("SESSDATA=") || entry.startsWith("DedeUserID="))
    .join("; ");

  return (await prisma.biliCredential.upsert({
    where: { singleton: "default" },
    update: {
      cookieEncrypted: encrypted,
      cookiePreview: preview || "已配置 Cookie",
      status: "UNVERIFIED",
      failureReason: null,
    },
    create: {
      singleton: "default",
      cookieEncrypted: encrypted,
      cookiePreview: preview || "已配置 Cookie",
    },
  })) as BiliCredentialRecord;
}

export async function saveLlmConfig(input: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  syncHour?: number;
  syncMinute?: number;
}) {
  const current = await ensureAppConfig();

  return (await prisma.appConfig.update({
    where: { singleton: "default" },
    data: {
      llmBaseUrl: input.baseUrl ?? current.llmBaseUrl ?? getDefaultLlmBaseUrl(),
      llmApiKeyEncrypted: input.apiKey
        ? encryptText(input.apiKey)
        : current.llmApiKeyEncrypted,
      llmModel: input.model ?? current.llmModel ?? getDefaultLlmModel(),
      syncHour: input.syncHour ?? current.syncHour,
      syncMinute: input.syncMinute ?? current.syncMinute,
    },
  })) as AppConfigRecord;
}

export async function getLlmConfig() {
  const config = await ensureAppConfig();

  return {
    ...config,
    apiKey: config.llmApiKeyEncrypted ? decryptText(config.llmApiKeyEncrypted) : null,
  };
}
