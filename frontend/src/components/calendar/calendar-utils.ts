import { Post } from "@/types";
import { parseUtcDate } from "@/lib/utils";

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "response" in err) {
    const res = (err as { response?: { data?: { detail?: string } } }).response;
    if (res?.data?.detail) {
      return res.data.detail;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Resolves the primary calendar timestamp for a post:
 * - Scheduled posts use `scheduled_at`
 * - Published/partial posts prefer the earliest `published_at` on targets, falling back to `scheduled_at` or `updated_at`
 * - Draft/failed posts fall back to `scheduled_at`, `updated_at`, or `created_at`
 */
export function getPostCalendarDate(post: Post): Date {
  if (post.status === "scheduled" && post.scheduled_at) {
    return parseUtcDate(post.scheduled_at) || new Date(post.scheduled_at);
  }

  if (post.status === "published" || post.status === "partial") {
    const publishedTimestamps = post.targets
      ?.map((t) => t.published_at)
      .filter((d): d is string => Boolean(d))
      .map((d) => (parseUtcDate(d) || new Date(d)).getTime())
      .filter((t) => !Number.isNaN(t));

    if (publishedTimestamps && publishedTimestamps.length > 0) {
      return new Date(Math.min(...publishedTimestamps));
    }
  }

  const raw = post.scheduled_at || post.updated_at || post.created_at;
  return parseUtcDate(raw) || new Date(raw);
}

export function getStatusBadgeClasses(status: Post["status"]): string {
  switch (status) {
    case "published":
      return "bg-success-soft text-success border-success/30";
    case "scheduled":
      return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    case "failed":
      return "bg-danger-soft text-danger border-danger/30";
    case "partial":
      return "bg-warning-soft text-warning border-warning/30";
    case "publishing":
      return "bg-primary-soft text-primary border-primary-border";
    default:
      return "bg-surface-muted text-muted-foreground border-border";
  }
}
