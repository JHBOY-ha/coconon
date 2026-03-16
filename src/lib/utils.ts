import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function startOfDay(input: Date) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(input: Date) {
  const date = new Date(input);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(input: Date, amount: number) {
  const date = new Date(input);
  date.setDate(date.getDate() + amount);
  return date;
}

export function formatDay(input: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  })
    .format(input)
    .replaceAll("/", "-");
}

export function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

export function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain > 0 ? `${hours} 小时 ${remain} 分钟` : `${hours} 小时`;
}

export function formatMinutesFromSeconds(seconds: number) {
  return formatDuration(Math.max(1, Math.round(seconds / 60)));
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function takeTopEntries<T extends { count: number }>(items: T[], limit = 5) {
  return [...items].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function describeDelta(value: number) {
  if (Math.abs(value) < 0.05) {
    return "基本持平";
  }

  return value > 0 ? "有所收窄" : "有所扩散";
}
