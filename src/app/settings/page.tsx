import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import { SettingsClient } from "@/components/settings-client";
import {
  buildCookiePreview,
  ensureAppConfig,
  ensureBiliCredential,
  getDecryptedCookie,
} from "@/lib/server/config";

export default async function SettingsPage() {
  const [config, credential, rawCookie] = await Promise.all([
    ensureAppConfig(),
    ensureBiliCredential(),
    getDecryptedCookie(),
  ]);
  const cookiePreview = rawCookie ? buildCookiePreview(rawCookie) : credential.cookiePreview;

  return (
    <AppShell currentPath="/settings">
      <div className="space-y-6">
        <Panel>
          <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Settings</p>
          <h2 className="mt-3 font-serif text-4xl text-stone-950">配置数据源、模型和定时策略</h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">
            这是单用户、本地部署版本。Cookie 和 LLM Key 都只保存在当前机器的 SQLite 中，并在入库前加密。
          </p>
        </Panel>

        <Panel>
          <SettingsClient
            cookiePreview={cookiePreview}
            llmBaseUrl={config.llmBaseUrl}
            llmModel={config.llmModel}
            syncHour={config.syncHour}
            syncMinute={config.syncMinute}
          />
        </Panel>
      </div>
    </AppShell>
  );
}
