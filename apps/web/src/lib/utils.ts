import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "5 minutes ago", "2 hours ago", etc. Falls back to "just now" under a minute. */
export function formatRelativeTime(date: string | Date): string {
  const seconds = (Date.now() - new Date(date).getTime()) / 1000;
  if (seconds < 60) return "just now";

  for (const [unit, unitSeconds] of RELATIVE_TIME_UNITS) {
    if (seconds >= unitSeconds) {
      return relativeTimeFormatter.format(-Math.floor(seconds / unitSeconds), unit);
    }
  }
  return relativeTimeFormatter.format(-Math.floor(seconds / 60), "minute");
}
