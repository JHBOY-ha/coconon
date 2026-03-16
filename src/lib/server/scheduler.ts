import cron, { ScheduledTask } from "node-cron";

import { ensureAppConfig } from "@/lib/server/config";
import { runFullPipeline } from "@/lib/server/jobs";

type SchedulerState = {
  task: ScheduledTask | null;
  signature: string | null;
};

const globalForScheduler = globalThis as {
  cocoonScheduler?: SchedulerState;
};

function getState() {
  if (!globalForScheduler.cocoonScheduler) {
    globalForScheduler.cocoonScheduler = {
      task: null,
      signature: null,
    };
  }

  return globalForScheduler.cocoonScheduler;
}

export async function ensureScheduler() {
  const config = await ensureAppConfig();
  const signature = `${config.syncMinute} ${config.syncHour} ${config.timezone}`;
  const state = getState();

  if (state.signature === signature) {
    return;
  }

  state.task?.stop();

  state.task = cron.schedule(
    `${config.syncMinute} ${config.syncHour} * * *`,
    () => {
      void runFullPipeline("scheduler");
    },
    {
      timezone: config.timezone,
    },
  );

  state.signature = signature;
}
