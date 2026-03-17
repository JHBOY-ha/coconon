import { clsx } from "clsx";

const VALID_VIEWING_PERIODS = new Set(["凌晨", "上午", "下午", "晚间"]);

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

export function startOfWeek(input: Date) {
  const date = startOfDay(input);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

export function endOfWeek(input: Date) {
  const date = startOfWeek(input);
  date.setDate(date.getDate() + 6);
  return endOfDay(date);
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

export function formatWeekKey(input: Date) {
  return formatDay(startOfWeek(input));
}

export function formatDateTime(input: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  })
    .format(input)
    .replaceAll("/", "-");
}

export function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

export function parseWeekKey(weekKey: string) {
  return startOfWeek(parseDayKey(weekKey));
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

export function estimateWatchedSeconds(duration: number, progress: number | null) {
  if (duration <= 0) {
    return 0;
  }

  if (progress == null) {
    return duration;
  }

  // Bilibili history commonly uses -1 to indicate the video was watched to the end.
  if (progress === -1) {
    return duration;
  }

  if (progress <= 0) {
    return Math.min(duration, 5);
  }

  return Math.min(progress, duration);
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function signedPercent(value: number) {
  const rounded = Math.round(value * 100);
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
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

export function sanitizeViewingAtLabel(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized && VALID_VIEWING_PERIODS.has(normalized) ? normalized : null;
}

export function sanitizeContentLabel(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.includes("Invalid Date") || normalized.includes("NaN")) {
    return null;
  }

  return normalized;
}
