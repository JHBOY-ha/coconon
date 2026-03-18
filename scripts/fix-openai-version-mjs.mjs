import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const openaiDir = path.join(process.cwd(), "node_modules", "openai");
const packageJsonPath = path.join(openaiDir, "package.json");
const versionMjsPath = path.join(openaiDir, "version.mjs");

if (!existsSync(packageJsonPath) || existsSync(versionMjsPath)) {
  process.exit(0);
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version ?? "unknown";

writeFileSync(
  versionMjsPath,
  `export const VERSION = '${version}'; // x-release-please-version\n//# sourceMappingURL=version.mjs.map\n`,
  "utf8",
);
