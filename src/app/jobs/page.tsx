import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import { prisma } from "@/lib/prisma";
import type { JobRunRecord } from "@/lib/store-types";
import { formatDateTime } from "@/lib/utils";

export default async function JobsPage() {
  const jobs = (await prisma.jobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
  })) as JobRunRecord[];

  return (
    <AppShell currentPath="/jobs">
      <div className="space-y-6">
        <Panel>
          <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Jobs</p>
          <h2 className="mt-3 font-serif text-4xl text-stone-950">后台任务历史</h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">
            这里记录同步、标签生成、日报生成和完整流水线任务，便于定位 Cookie 失效、接口异常或模型超时。
          </p>
        </Panel>

        <Panel>
          <div className="space-y-4">
            {jobs.length > 0 ? (
              jobs.map((job: JobRunRecord) => (
                <div
                  key={job.id}
                  className="grid gap-4 rounded-[1.75rem] border border-stone-200 bg-stone-50/80 p-5 md:grid-cols-[0.9fr_0.6fr_1.1fr]"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{job.jobType}</p>
                    <p className="mt-2 text-lg text-stone-900">{job.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">触发方式</p>
                    <p className="mt-2 text-sm text-stone-900">{job.trigger}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">执行信息</p>
                    <p className="mt-2 text-sm leading-6 text-stone-700">
                      {formatDateTime(job.startedAt)}
                      {job.durationMs ? ` · ${job.durationMs}ms` : ""}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      {job.errorMessage ?? "执行完成，无额外错误。"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-stone-300 p-6 text-sm leading-7 text-stone-600">
                还没有任务记录。返回首页手动执行一次同步或日报生成即可。
              </div>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
