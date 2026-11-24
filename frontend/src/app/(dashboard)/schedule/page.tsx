"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Post, Content } from "@/types";
import {
  Send,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

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

export default function SchedulePage() {
  const queryClient = useQueryClient();

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

  const publishMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiClient.post(`/posts/${postId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      alert("Post successfully dispatched!");
    },
    onError: (err: unknown) => {
      alert(`Error dispatching post: ${getErrorMessage(err, "Failed to dispatch post.")}`);
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiClient.post<Post>(`/posts/${postId}/publish`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (data.status === "failed") {
        alert("Retry attempted, but dispatch failed. Please check platform connection and error details.");
      } else if (data.status === "partial") {
        alert("Post partially dispatched. Some targets succeeded while others failed.");
      } else {
        alert("Post retried and dispatched successfully!");
      }
    },
    onError: (err: unknown) => {
      alert(`Error retrying post: ${getErrorMessage(err, "Failed to retry post.")}`);
    },
  });

  const workerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/posts/dispatch-due");
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      alert(`Background worker ran successfully: processed ${data.processed_count} due post(s).`);
    },
    onError: (err: unknown) => {
      alert(`Error running background worker: ${getErrorMessage(err, "Worker trigger failed.")}`);
    },
  });

  const contentMap = new Map(contents.map((c) => [c._id, c]));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Send className="h-6 w-6 text-indigo-400" />
            <span>Publishing & Dispatch Schedule</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Monitor scheduled social media posts and live dispatch results across channels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={workerMutation.isPending}
            onClick={() => workerMutation.mutate()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 transition"
            title="Check and process any scheduled posts that are due now"
          >
            {workerMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
            )}
            <span>Process Due Posts Now</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-2xl bg-neutral-900 border border-neutral-800 animate-pulse flex items-center justify-center text-xs text-neutral-500">
          Loading post schedule...
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-12 text-center bg-neutral-900/30">
          <Send className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No posts scheduled</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Create or generate content in the Studio or Content Manager and schedule them for dispatch.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const linkedContent = contentMap.get(post.content_id);
            const isDraft = post.status === "draft";
            const isPublished = post.status === "published";
            const isScheduled = post.status === "scheduled";
            const isFailed = post.status === "failed";
            const isPartial = post.status === "partial";
            const isPublishing = post.status === "publishing";

            const hasFailedTargets = post.targets?.some((t) => t.status === "failed");
            const canRetry = isFailed || isPartial || hasFailedTargets;

            const isPublishingThis = publishMutation.isPending && publishMutation.variables === post._id;
            const isRetryingThis = retryMutation.isPending && retryMutation.variables === post._id;
            const isActionPending = isPublishingThis || isRetryingThis;

            return (
              <div
                key={post._id}
                className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                        isPublished
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : isScheduled
                          ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          : isFailed
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : isPartial
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : isPublishing
                          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {post.status}
                    </span>

                    {post.scheduled_at && (
                      <span className="text-xs text-neutral-400 flex items-center gap-1 font-medium">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(post.scheduled_at)}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white">
                    {linkedContent?.title || `Content ${post.content_id}`}
                  </h3>

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
                              ? "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                              : isTargetPublished
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                              : "bg-neutral-800/80 border border-neutral-700/60 text-neutral-300"
                          }`}
                          title={t.error || undefined}
                        >
                          <span
                            className={`font-bold font-mono text-[10px] ${
                              isTargetFailed
                                ? "text-rose-400"
                                : isTargetPublished
                                ? "text-emerald-400"
                                : "text-sky-400"
                            }`}
                          >
                            {t.platform_code}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{t.status}</span>
                          {isTargetFailed && <AlertCircle className="h-3 w-3 text-rose-400 shrink-0" />}
                          {t.external_url && (
                            <a
                              href={t.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:text-indigo-300 inline-flex items-center ml-1"
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
                        className="mt-1.5 text-xs text-rose-400/90 flex items-center gap-1.5"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                        <span>
                          <strong className="font-semibold">{t.platform_code}:</strong> {t.error}
                        </span>
                      </p>
                    ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => publishMutation.mutate(post._id)}
                      disabled={isActionPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                    >
                      {isPublishingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      <span>Publish Now</span>
                    </button>
                  )}

                  {canRetry && !isDraft && (
                    <button
                      type="button"
                      onClick={() => retryMutation.mutate(post._id)}
                      disabled={isActionPending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition disabled:opacity-50"
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
