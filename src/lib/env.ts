const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const FALLBACK_ENCRYPTION_KEY = "coconon-local-dev-encryption-key";

export function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? "file:./dev.db";
}

export function getEncryptionSecret() {
  return process.env.COCONON_ENCRYPTION_KEY ?? FALLBACK_ENCRYPTION_KEY;
}

export function getDefaultLlmBaseUrl() {
  return process.env.COCONON_LLM_BASE_URL ?? DEFAULT_BASE_URL;
}

export function getDefaultLlmModel() {
  return process.env.COCONON_LLM_MODEL ?? DEFAULT_MODEL;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
