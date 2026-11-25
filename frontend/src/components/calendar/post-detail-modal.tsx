"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Content, Post } from "@/types";
import {
  getApiErrorMessage,
  getStatusBadgeClasses,
  toDateTimeLocalString,
} from "./calendar-utils";

interface PostDetailModalProps {
  post: Post | null;
  content: Content | undefined;
  onClose: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
}

export function PostDetailModal({ post, content, onClose, onNotify }: PostDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const rescheduleInputId = useId();
  const queryClient = useQueryClient();

  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleValue, setRescheduleValue] = useState(() => {
    const baseDate = post?.scheduled_at
      ? new Date(post.scheduled_at)
      : new Date(Date.now() + 3600 * 1000);
    return toDateTimeLocalString(baseDate);
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (post && !dialog.open) {
      dialog.showModal();
    } else if (!post && dialog.open) {
      dialog.close();
    }
  }, [post]);

  // Light-dismiss fallback for browsers without <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
    };

    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("pointerup", onPointerUp);
    return () => {
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const publishMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiClient.post(`/posts/${postId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onNotify("success", "Post published!");
      onClose();
    },
    onError: (err: unknown) => {
      onNotify("error", getApiErrorMessage(err, "Failed to publish post."));
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ postId, scheduledAt }: { postId: string; scheduledAt: string }) => {
      await apiClient.patch(`/posts/${postId}/reschedule`, {
        scheduled_at: new Date(scheduledAt).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onNotify("success", "Post rescheduled!");
      onClose();
    },
    onError: (err: unknown) => {
      onNotify("error", getApiErrorMessage(err, "Failed to reschedule post."));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiClient.post(`/posts/${postId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onNotify("success", "Schedule cancelled. Post moved to drafts.");
      onClose();
    },
    onError: (err: unknown) => {
      onNotify("error", getApiErrorMessage(err, "Failed to cancel schedule."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiClient.delete(`/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onNotify("success", "Post deleted.");
      onClose();
    },
    onError: (err: unknown) => {
      onNotify("error", getApiErrorMessage(err, "Failed to delete post."));
    },
  });

  const isBusy =
    publishMutation.isPending ||
    rescheduleMutation.isPending ||
    cancelMutation.isPending ||
    deleteMutation.isPending;

  const textPreview = content?.details?.find((d) => d.type === "text")?.text;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = "";
        onClose();
      }}
      {...({ closedby: "any" } as Record<string, string>)}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-0 text-neutral-100 shadow-2xl"
    >
      {post && (
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize border ${getStatusBadgeClasses(
                    post.status
                  )}`}
                >
                  {post.status}
                </span>
                {post.scheduled_at && (
                  <span className="text-xs text-neutral-400 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-sky-400" />
                    <span>{formatDate(post.scheduled_at)}</span>
                  </span>
                )}
              </div>
              <h1 id={titleId} className="text-base font-bold text-white truncate">
                {content?.title || `Content ${post.content_id}`}
              </h1>
            </div>

            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label="Close post details"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content Preview */}
          {textPreview && (
            <p className="text-xs text-neutral-300 bg-neutral-800/50 border border-neutral-800 rounded-xl p-3.5 line-clamp-4 whitespace-pre-line">
              {textPreview}
            </p>
          )}

          {/* Targets */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-neutral-400">Platform Targets</span>
            {post.targets?.length ? (
              <div className="space-y-2">
                {post.targets.map((t) => (
                  <div
                    key={t._id}
                    className="p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/60 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-[11px] text-sky-400">
                          {t.platform_code}
                        </span>
                        <span className="capitalize text-neutral-200 font-medium">{t.status}</span>
                        {t.published_at && (
                          <span className="text-[11px] text-neutral-400">
                            • {formatDate(t.published_at)}
                          </span>
                        )}
                      </div>
                      {t.error && (
                        <p className="text-[11px] text-rose-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span className="truncate">{t.error}</span>
                        </p>
                      )}
                    </div>

                    {t.external_url && (
                      <a
                        href={t.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 shrink-0"
                      >
                        <span>View</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No platform targets configured.</p>
            )}
          </div>

          {/* Inline Reschedule Form */}
          {showReschedule && post.status !== "published" && (
            <div className="p-3.5 rounded-xl bg-neutral-800/60 border border-neutral-700 space-y-2.5">
              <label htmlFor={rescheduleInputId} className="block text-xs font-medium text-neutral-300">
                New Schedule Date &amp; Time
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={rescheduleInputId}
                  type="datetime-local"
                  value={rescheduleValue}
                  onChange={(e) => setRescheduleValue(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  disabled={!rescheduleValue || isBusy}
                  onClick={() =>
                    rescheduleMutation.mutate({ postId: post._id, scheduledAt: rescheduleValue })
                  }
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  {rescheduleMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-800">
            <Link
              href={`/contents/${post.content_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Edit Content</span>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {post.status !== "published" && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setShowReschedule((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition disabled:opacity-50"
                >
                  <CalendarClock className="h-3.5 w-3.5 text-sky-400" />
                  <span>Reschedule</span>
                </button>
              )}

              {(post.status === "draft" || post.status === "scheduled" || post.status === "failed") && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => publishMutation.mutate(post._id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {publishMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Publish Now</span>
                </button>
              )}

              {post.status === "scheduled" && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => cancelMutation.mutate(post._id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-medium transition disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
              )}

              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  if (confirm("Delete this post?")) {
                    deleteMutation.mutate(post._id);
                  }
                }}
                aria-label="Delete post"
                className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
