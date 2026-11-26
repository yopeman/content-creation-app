"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Post, Content, Platform } from "@/types";
import { CreatePostModal } from "@/components/calendar/create-post-modal";
import { PostStatusBadge } from "@/components/ui/status-badge";
import {
  Send,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  CalendarClock,
  Trash2,
  XCircle,
  CheckCircle2,
  Search,
  FileText,
  Plus,
} from "lucide-react";
import { formatDate, parseUtcDate } from "@/lib/utils";

function getErrorMessage(err: unknown, fallback: string): string {
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

function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function PostsPage() {
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "published" | "draft" | "failed">("all");

  // Notifications
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Create Post Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Reschedule Modal State
  const [rescheduleModalPost, setRescheduleModalPost] = useState<Post | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState<string>("");

  const showNotification = (type: "success" | "error", message: string) => {
    setBanner({ type, message });
    setTimeout(() => {
      setBanner((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await apiClient.get<Post[]>("/posts");
      return res.data;
    },
  });

  const { data: contents = [] } = useQuery<Content[]>({
    queryKey: ["contents"],
    queryFn: async () => {
      const res = await apiClient.get<Content[]>("/contents");
      return res.data;
    },
  });

  const { data: platforms = [] } = useQuery<Platform[]>({
    queryKey: ["platforms"],
    queryFn: async () => {
      const res = await apiClient.get<Platform[]>("/platforms");
      return res.data;
    },
  });

  // 1. Publish immediately
  const publishMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiClient.post(`/posts/${postId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      showNotification("success", "Post successfully dispatched and published!");
    },
    onError: (err: unknown) => {
      showNotification("error", getErrorMessage(err, "Failed to dispatch post."));
    },
  });

  // 2. Retry failed dispatch
  const retryMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiClient.post<Post>(`/posts/${postId}/publish`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (data.status === "failed") {
        showNotification("error", "Retry attempted, but dispatch failed. Please check platform connection and error details.");
      } else if (data.status === "partial") {
        showNotification("error", "Post partially dispatched. Some platform targets succeeded while others failed.");
      } else {
        showNotification("success", "Post retried and dispatched successfully!");
      }
    },
    onError: (err: unknown) => {
      showNotification("error", getErrorMessage(err, "Failed to retry post."));
    },
  });

  // 3. Reschedule post
  const rescheduleMutation = useMutation({
    mutationFn: async ({ postId, scheduledAt }: { postId: string; scheduledAt: string }) => {
      const res = await apiClient.patch<Post>(`/posts/${postId}/reschedule`, {
        scheduled_at: new Date(scheduledAt).toISOString(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setRescheduleModalPost(null);
      showNotification("success", "Post schedule updated successfully!");
    },
    onError: (err: unknown) => {
      showNotification("error", getErrorMessage(err, "Failed to reschedule post."));
    },
  });

  // 4. Cancel schedule (revert to draft)
  const cancelScheduleMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiClient.post<Post>(`/posts/${postId}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      showNotification("success", "Scheduled dispatch cancelled. Post moved back to drafts.");
    },
    onError: (err: unknown) => {
      showNotification("error", getErrorMessage(err, "Failed to cancel scheduled post."));
    },
  });

  // 5. Delete post
  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiClient.delete(`/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      showNotification("success", "Post removed from schedule.");
    },
    onError: (err: unknown) => {
      showNotification("error", getErrorMessage(err, "Failed to delete post."));
    },
  });

  // 6. Background worker trigger
  const workerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ status: string; processed_count: number }>("/posts/dispatch-due");
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      showNotification("success", `Background worker ran successfully: processed ${data.processed_count} due post(s).`);
    },
    onError: (err: unknown) => {
      showNotification("error", getErrorMessage(err, "Worker trigger failed."));
    },
  });

  const contentMap = new Map(contents.map((c) => [c._id, c]));

  // Open Reschedule Modal helper
  const openRescheduleModal = (post: Post) => {
    let initialDate: Date;
    if (post.scheduled_at) {
      initialDate = parseUtcDate(post.scheduled_at) || new Date(post.scheduled_at);
      if (initialDate.getTime() < Date.now()) {
        initialDate = new Date(Date.now() + 3600 * 1000);
      }
    } else {
      initialDate = new Date(Date.now() + 3600 * 1000);
    }
    setRescheduleDateTime(toDateTimeLocalString(initialDate));
    setRescheduleModalPost(post);
  };

  // Quick preset dates for rescheduling
  const setPresetTime = (hoursAhead: number) => {
    const d = new Date(Date.now() + hoursAhead * 3600 * 1000);
    setRescheduleDateTime(toDateTimeLocalString(d));
  };

  const setPresetTomorrowMorning = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setRescheduleDateTime(toDateTimeLocalString(d));
  };

  const setPresetTomorrowEvening = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    setRescheduleDateTime(toDateTimeLocalString(d));
  };

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    const linkedContent = contentMap.get(post.content_id);
    const titleMatch = linkedContent?.title?.toLowerCase() || "";
    const idMatch = post._id.toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    if (query && !titleMatch.includes(query) && !idMatch.includes(query)) {
      return false;
    }

    if (statusFilter === "all") return true;
    if (statusFilter === "scheduled") return post.status === "scheduled";
    if (statusFilter === "published") return post.status === "published";
    if (statusFilter === "draft") return post.status === "draft";
    if (statusFilter === "failed") {
      return post.status === "failed" || post.status === "partial" || post.targets?.some((t) => t.status === "failed");
    }
    return true;
  });

  // Calculate status counts
  const counts = {
    all: posts.length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    published: posts.filter((p) => p.status === "published").length,
    draft: posts.filter((p) => p.status === "draft").length,
    failed: posts.filter((p) => p.status === "failed" || p.status === "partial" || p.targets?.some((t) => t.status === "failed")).length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Send className="h-6 w-6 text-primary" />
            <span>Publishing & Dispatch Schedule</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Monitor, reschedule, cancel, or immediately dispatch social media posts across your connected channels.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Post</span>
          </button>

          <button
            type="button"
            disabled={workerMutation.isPending}
            onClick={() => workerMutation.mutate()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
            title="Check and process any scheduled posts that are due now"
          >
            {workerMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Process Due Posts Now</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition ${
            banner.type === "success"
              ? "bg-success-soft border-success/30 text-success"
              : "bg-danger-soft border-danger/30 text-danger"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All Posts", count: counts.all, activeClass: "bg-primary text-primary-foreground shadow-sm font-semibold" },
              { id: "scheduled", label: "Scheduled", count: counts.scheduled, activeClass: "bg-sky-600 text-white shadow-sm font-semibold" },
              { id: "published", label: "Published", count: counts.published, activeClass: "bg-emerald-600 text-white shadow-sm font-semibold" },
              { id: "draft", label: "Drafts", count: counts.draft, activeClass: "bg-purple-600 text-white shadow-sm font-semibold" },
              { id: "failed", label: "Failed / Partial", count: counts.failed, activeClass: "bg-rose-600 text-white shadow-sm font-semibold" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? tab.activeClass
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-surface-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface border border-border text-foreground placeholder-subtle-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-2xl bg-surface border border-border animate-pulse flex items-center justify-center text-xs text-muted-foreground">
          Loading post schedule...
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-surface/30">
          <Send className="h-10 w-10 text-subtle-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">
            {posts.length === 0 ? "No posts scheduled" : "No posts matching filter"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {posts.length === 0
              ? "Create or generate content in the Content Manager and schedule them for dispatch."
              : "Try switching filter tabs or clearing your search query."}
          </p>
          {posts.length === 0 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Create Post</span>
              </button>
              <Link
                href="/contents/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
              >
                <FileText className="h-4 w-4" />
                <span>Create Content</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const linkedContent = contentMap.get(post.content_id);
            const isDraft = post.status === "draft";
            const isPublished = post.status === "published";
            const isScheduled = post.status === "scheduled";
            const isFailed = post.status === "failed";
            const isPartial = post.status === "partial";

            const hasFailedTargets = post.targets?.some((t) => t.status === "failed");
            const canRetry = isFailed || isPartial || hasFailedTargets;

            const isPublishingThis = publishMutation.isPending && publishMutation.variables === post._id;
            const isRetryingThis = retryMutation.isPending && retryMutation.variables === post._id;
            const isCancellingThis = cancelScheduleMutation.isPending && cancelScheduleMutation.variables === post._id;
            const isDeletingThis = deleteMutation.isPending && deleteMutation.variables === post._id;
            const isActionPending = isPublishingThis || isRetryingThis || isCancellingThis || isDeletingThis;

            return (
              <div
                key={post._id}
                className="p-5 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-border-strong"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PostStatusBadge status={post.status} size="sm" />

                    {post.scheduled_at && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                        <Clock className="h-3 w-3 text-sky-400" />
                        <span>Scheduled for: {formatDate(post.scheduled_at)}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground truncate max-w-lg">
                      {linkedContent?.title || `Content ${post.content_id}`}
                    </h3>
                    <Link
                      href={`/contents/${post.content_id}`}
                      className="text-muted-foreground hover:text-primary transition"
                      title="View / Edit Content"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  {/* Targets List */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {post.targets?.map((t) => {
                      const isTargetFailed = t.status === "failed";
                      const isTargetPublished = t.status === "published";

                      return (
                        <div
                          key={t._id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${
                            isTargetFailed
                              ? "bg-danger-soft border border-danger/30 text-danger"
                              : isTargetPublished
                              ? "bg-success-soft border border-success/20 text-success"
                              : "bg-surface-muted border border-border text-foreground"
                          }`}
                          title={t.error || undefined}
                        >
                          <span
                            className={`font-bold font-mono text-[10px] ${
                              isTargetFailed
                                ? "text-danger"
                                : isTargetPublished
                                ? "text-success"
                                : "text-sky-400"
                            }`}
                          >
                            {t.platform_code}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{t.status}</span>
                          {isTargetFailed && <AlertCircle className="h-3 w-3 text-danger shrink-0" />}
                          {t.external_url && (
                            <a
                              href={t.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline inline-flex items-center ml-1"
                              title="View on platform"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Target error messages if failed */}
                  {post.targets
                    ?.filter((t) => t.status === "failed" && t.error)
                    .map((t) => (
                      <p
                        key={`err-${t._id}`}
                        className="mt-1.5 text-xs text-danger flex items-center gap-1.5"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
                        <span>
                          <strong className="font-semibold">{t.platform_code}:</strong> {t.error}
                        </span>
                      </p>
                    ))}
                </div>

                {/* Post Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-border w-full sm:w-auto justify-start sm:justify-end shrink-0">
                  {/* Publish Now (for Draft or Scheduled) */}
                  {(isDraft || isScheduled) && (
                    <button
                      type="button"
                      onClick={() => publishMutation.mutate(post._id)}
                      disabled={isActionPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition disabled:opacity-50"
                      title="Publish now immediately without waiting"
                    >
                      {isPublishingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      <span>Publish Now</span>
                    </button>
                  )}

                  {/* Reschedule Button (for Scheduled, Draft, or Failed) */}
                  {!isPublished && (
                    <button
                      type="button"
                      onClick={() => openRescheduleModal(post)}
                      disabled={isActionPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition disabled:opacity-50"
                      title="Change or set scheduled dispatch date and time"
                    >
                      <CalendarClock className="h-3.5 w-3.5 text-sky-400" />
                      <span>{isScheduled ? "Reschedule" : "Set Schedule"}</span>
                    </button>
                  )}

                  {/* Cancel Schedule (for Scheduled posts) */}
                  {isScheduled && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Cancel this scheduled dispatch? The post will be moved back to drafts.")) {
                          cancelScheduleMutation.mutate(post._id);
                        }
                      }}
                      disabled={isActionPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-warning-soft hover:bg-warning/20 text-warning border border-warning/20 text-xs font-medium transition disabled:opacity-50"
                      title="Cancel schedule and revert to draft"
                    >
                      {isCancellingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      <span>Cancel Schedule</span>
                    </button>
                  )}

                  {/* Retry Button (for Failed or Partial) */}
                  {canRetry && !isDraft && (
                    <button
                      type="button"
                      onClick={() => retryMutation.mutate(post._id)}
                      disabled={isActionPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger hover:bg-danger-hover text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
                      title="Retry dispatching failed post"
                    >
                      {isRetryingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      <span>Retry</span>
                    </button>
                  )}

                  {/* Delete Button (for any post) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this post from the schedule?")) {
                        deleteMutation.mutate(post._id);
                      }
                    }}
                    disabled={isActionPending}
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-danger hover:bg-danger-soft transition disabled:opacity-50"
                    title="Delete post"
                  >
                    {isDeletingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModalPost && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-sky-400" />
                <span>Reschedule Post</span>
              </h3>
              <button
                type="button"
                onClick={() => setRescheduleModalPost(null)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            {/* Target info */}
            <div className="p-3 bg-surface-muted border border-border rounded-xl space-y-1">
              <p className="text-xs font-medium text-foreground truncate">
                {contentMap.get(rescheduleModalPost.content_id)?.title || "Untitled Content"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Current status:{" "}
                <span className="text-sky-400 font-semibold capitalize">
                  {rescheduleModalPost.status}
                </span>
                {rescheduleModalPost.scheduled_at && (
                  <span> • Currently scheduled: {formatDate(rescheduleModalPost.scheduled_at)}</span>
                )}
              </p>
            </div>

            {/* DateTime Input */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-foreground">
                Select New Dispatch Date & Time
              </label>
              <input
                type="datetime-local"
                value={rescheduleDateTime}
                onChange={(e) => setRescheduleDateTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Quick Presets
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPresetTime(1)}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border text-left transition"
                >
                  +1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => setPresetTime(3)}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border text-left transition"
                >
                  +3 Hours
                </button>
                <button
                  type="button"
                  onClick={setPresetTomorrowMorning}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border text-left transition"
                >
                  Tomorrow 9:00 AM
                </button>
                <button
                  type="button"
                  onClick={setPresetTomorrowEvening}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border text-left transition"
                >
                  Tomorrow 6:00 PM
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setRescheduleModalPost(null)}
                className="px-3.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rescheduleDateTime || rescheduleMutation.isPending}
                onClick={() => {
                  if (rescheduleModalPost && rescheduleDateTime) {
                    rescheduleMutation.mutate({
                      postId: rescheduleModalPost._id,
                      scheduledAt: rescheduleDateTime,
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition"
              >
                {rescheduleMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="h-3.5 w-3.5" />
                )}
                <span>Confirm Reschedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        open={isCreateOpen}
        initialDate={null}
        contents={contents}
        platforms={platforms}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(msg) => showNotification("success", msg)}
      />
    </div>
  );
}
