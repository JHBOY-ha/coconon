import { prisma } from "@/lib/prisma";
import { decryptText, encryptText, maskSecret } from "@/lib/crypto";
import { getDefaultLlmBaseUrl, getDefaultLlmModel } from "@/lib/env";
import type { AppConfigRecord, BiliCredentialRecord } from "@/lib/store-types";

type BiliCookieParts = {
  sessdata: string;
  biliJct?: string;
  dedeUserId?: string;
};

export async function ensureAppConfig(): Promise<AppConfigRecord> {
  return (await prisma.appConfig.upsert({
    where: { singleton: "default" },
    update: {},
    create: {
      singleton: "default",
      llmBaseUrl: getDefaultLlmBaseUrl(),
      llmModel: getDefaultLlmModel(),
      llmEnabled: 1,
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

export async function initializeApplication() {
  await Promise.all([ensureAppConfig(), ensureBiliCredential()]);
}

export async function getDecryptedCookie() {
  const credential = await ensureBiliCredential();

  if (!credential.cookieEncrypted) {
    return null;
  }

  return decryptText(credential.cookieEncrypted);
}

export function buildBiliCookie(parts: BiliCookieParts) {
  return [
    `SESSDATA=${parts.sessdata.trim()}`,
    parts.biliJct?.trim() ? `bili_jct=${parts.biliJct.trim()}` : null,
    parts.dedeUserId?.trim() ? `DedeUserID=${parts.dedeUserId.trim()}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildCookiePreview(cookie: string) {
  const values = Object.fromEntries(
    cookie
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [key, ...rest] = entry.split("=");
        return [key, rest.join("=")];
      }),
  ) as Record<string, string>;

  const previewParts = [
    values.SESSDATA ? `SESSDATA=${maskSecret(values.SESSDATA)}` : null,
    values.bili_jct ? `bili_jct=${maskSecret(values.bili_jct)}` : null,
    values.DedeUserID ? `DedeUserID=${values.DedeUserID}` : null,
  ];

  return previewParts.filter(Boolean).join(" · ") || "已配置 Cookie";
}

export async function saveBiliCookie(cookie: string) {
  const encrypted = encryptText(cookie);
  const preview = buildCookiePreview(cookie);

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
  enabled?: boolean;
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
      llmEnabled: input.enabled == null ? current.llmEnabled : input.enabled ? 1 : 0,
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

export async function resetApplicationSettings() {
  const [config, credential] = await Promise.all([ensureAppConfig(), ensureBiliCredential()]);

  await Promise.all([
    prisma.appConfig.update({
      where: { singleton: "default" },
      data: {
        adminPasswordHash: null,
        llmBaseUrl: getDefaultLlmBaseUrl(),
        llmApiKeyEncrypted: null,
        llmModel: getDefaultLlmModel(),
        llmEnabled: 1,
        syncHour: 1,
        syncMinute: 0,
        timezone: config.timezone,
        encryptionVersion: config.encryptionVersion,
      },
    }),
    prisma.biliCredential.update({
      where: { singleton: "default" },
      data: {
        cookieEncrypted: null,
        cookiePreview: null,
        status: "UNVERIFIED",
        lastValidatedAt: null,
        failureReason: null,
      },
    }),
  ]);

  return { config, credential };
}
