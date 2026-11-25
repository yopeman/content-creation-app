import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes?: number, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function parseUtcDate(dateString?: string | null): Date | null {
  if (!dateString) return null;
  const clean = dateString.trim();
  if (!clean) return null;
  // If the string lacks timezone offset or trailing 'Z', treat it as UTC
  const hasTimezone =
    clean.endsWith("Z") ||
    clean.includes("+") ||
    (clean.length > 10 && clean.lastIndexOf("-") > 10);
  const normalized = hasTimezone ? clean : `${clean}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "Not set";
  try {
    const d = parseUtcDate(dateString);
    if (!d) return dateString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

export function formatTime(dateOrString?: Date | string | null): string {
  if (!dateOrString) return "";
  try {
    const d =
      typeof dateOrString === "string"
        ? parseUtcDate(dateOrString) || new Date(dateOrString)
        : dateOrString;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}
