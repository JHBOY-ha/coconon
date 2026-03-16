import Link from "next/link";
import { BarChart3, Clock3, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "仪表盘", icon: BarChart3 },
  { href: "/jobs", label: "任务", icon: Clock3 },
  { href: "/settings", label: "设置", icon: Settings2 },
];

export function AppShell({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath: string;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,210,154,0.35),_transparent_30%),linear-gradient(180deg,_#fffdf8_0%,_#f7f2e8_55%,_#efe7d8_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:px-8">
        <aside className="mb-6 shrink-0 lg:mb-0 lg:w-72">
          <div className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-6 shadow-[0_20px_80px_rgba(95,70,30,0.12)] backdrop-blur">
            <div className="mb-8">
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-stone-500">coconon</p>
              <h1 className="mt-3 font-serif text-4xl leading-none text-stone-950">Daily media sanity check.</h1>
              <p className="mt-4 text-sm leading-6 text-stone-600">
                从 Bilibili 观看历史里，持续观察你的注意力是否开始变窄。
              </p>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentPath === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition",
                      active
                        ? "bg-stone-900 text-stone-50 shadow-lg"
                        : "bg-stone-100/70 text-stone-700 hover:bg-stone-200/70",
                    )}
                  >
                    <span>{item.label}</span>
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8 rounded-2xl bg-stone-900 p-4 text-stone-50">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-400">MVP</p>
              <p className="mt-2 text-sm leading-6 text-stone-200">
                单用户、本地部署、定时同步。不要把这个版本直接暴露在公网。
              </p>
            </div>
          </div>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
