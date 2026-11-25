import { Post } from "@/types";

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
    return new Date(post.scheduled_at);
  }

  if (post.status === "published" || post.status === "partial") {
    const publishedTimestamps = post.targets
      ?.map((t) => t.published_at)
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d).getTime())
      .filter((t) => !Number.isNaN(t));

    if (publishedTimestamps && publishedTimestamps.length > 0) {
      return new Date(Math.min(...publishedTimestamps));
    }
  }

  const raw = post.scheduled_at || post.updated_at || post.created_at;
  return new Date(raw);
}

export function getStatusBadgeClasses(status: Post["status"]): string {
  switch (status) {
    case "published":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "scheduled":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "failed":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    case "partial":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "publishing":
      return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
    default:
      return "bg-neutral-800 text-neutral-300 border-neutral-700";
  }
}
