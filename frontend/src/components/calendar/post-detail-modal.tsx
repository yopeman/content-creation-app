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
import { formatDate, parseUtcDate } from "@/lib/utils";
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
      ? parseUtcDate(post.scheduled_at) || new Date(post.scheduled_at)
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
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
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
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 text-sky-400" />
                    <span>{formatDate(post.scheduled_at)}</span>
                  </span>
                )}
              </div>
              <h1 id={titleId} className="text-base font-bold text-foreground truncate">
                {content?.title || `Content ${post.content_id}`}
              </h1>
            </div>

            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label="Close post details"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content Preview */}
          {textPreview && (
            <p className="text-xs text-foreground bg-surface-muted border border-border rounded-xl p-3.5 line-clamp-4 whitespace-pre-line">
              {textPreview}
            </p>
          )}

          {/* Targets */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Platform Targets</span>
            {post.targets?.length ? (
              <div className="space-y-2">
                {post.targets.map((t) => (
                  <div
                    key={t._id}
                    className="p-3 rounded-xl bg-surface-muted border border-border flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-[11px] text-sky-400">
                          {t.platform_code}
                        </span>
                        <span className="capitalize text-foreground font-medium">{t.status}</span>
                        {t.published_at && (
                          <span className="text-[11px] text-muted-foreground">
                            • {formatDate(t.published_at)}
                          </span>
                        )}
                      </div>
                      {t.error && (
                        <p className="text-[11px] text-danger flex items-center gap-1">
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
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
                      >
                        <span>View</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-subtle-foreground">No platform targets configured.</p>
            )}
          </div>

          {/* Inline Reschedule Form */}
          {showReschedule && post.status !== "published" && (
            <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-2.5">
              <label htmlFor={rescheduleInputId} className="block text-xs font-medium text-foreground">
                New Schedule Date &amp; Time
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={rescheduleInputId}
                  type="datetime-local"
                  value={rescheduleValue}
                  onChange={(e) => setRescheduleValue(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-surface border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
            <Link
              href={`/contents/${post.content_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition disabled:opacity-50"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition disabled:opacity-50"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-warning-soft hover:bg-warning/20 text-warning border border-warning/20 text-xs font-medium transition disabled:opacity-50"
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
                className="p-1.5 rounded-xl text-muted-foreground hover:text-danger hover:bg-danger-soft transition disabled:opacity-50"
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
