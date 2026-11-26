"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  Check,
  Clock,
  FileText,
  Loader2,
  Radio,
  Send,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Content, Platform, Post } from "@/types";
import { getApiErrorMessage, toDateTimeLocalString } from "./calendar-utils";

interface CreatePostModalProps {
  open: boolean;
  initialDate: Date | null;
  contents: Content[];
  platforms: Platform[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

type DispatchMode = "scheduled" | "published" | "draft";

function getDefaultScheduleString(initialDate: Date | null): string {
  const now = new Date();
  if (!initialDate) {
    return toDateTimeLocalString(new Date(now.getTime() + 3600 * 1000));
  }

  const candidate = new Date(initialDate);
  const isToday =
    candidate.getFullYear() === now.getFullYear() &&
    candidate.getMonth() === now.getMonth() &&
    candidate.getDate() === now.getDate();

  if (isToday) {
    return toDateTimeLocalString(new Date(now.getTime() + 3600 * 1000));
  }

  candidate.setHours(9, 0, 0, 0);
  return toDateTimeLocalString(candidate);
}

export function CreatePostModal({
  open,
  initialDate,
  contents,
  platforms,
  onClose,
  onSuccess,
}: CreatePostModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const contentSelectId = useId();
  const scheduleInputId = useId();
  const queryClient = useQueryClient();

  const [selectedContentId, setSelectedContentId] = useState<string>(
    () => contents[0]?._id || ""
  );
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>(() => {
    const connected = platforms.filter((p) => p.status === "connected");
    return connected.length > 0 ? [connected[0]._id] : platforms[0] ? [platforms[0]._id] : [];
  });
  const [mode, setMode] = useState<DispatchMode>("scheduled");
  const [scheduledAt, setScheduledAt] = useState<string>(() =>
    getDefaultScheduleString(initialDate)
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Sync modal open state with native <dialog>.showModal()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    if (open) {
      if ((!selectedContentId || !contents.some((c) => c._id === selectedContentId)) && contents.length > 0) {
        setSelectedContentId(contents[0]._id);
      }
      if (selectedPlatformIds.length === 0 && platforms.length > 0) {
        const connected = platforms.filter((p) => p.status === "connected");
        setSelectedPlatformIds(connected.length > 0 ? [connected[0]._id] : [platforms[0]._id]);
      }
      setScheduledAt(getDefaultScheduleString(initialDate));
      setFormError(null);
    }
  }, [open, contents, platforms, initialDate, selectedContentId, selectedPlatformIds.length]);

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const selectedPlatforms = platforms.filter((p) => selectedPlatformIds.includes(p._id));
      const isoSchedule =
        mode === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined;

      const res = await apiClient.post<Post>("/posts", {
        content_id: selectedContentId,
        status: mode,
        scheduled_at: isoSchedule,
        targets: selectedPlatforms.map((p) => ({
          platform_id: p._id,
          platform_code: p.code,
          scheduled_at: isoSchedule,
        })),
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["contents"] });

      if (data.status === "scheduled") {
        onSuccess("Post scheduled successfully!");
      } else if (data.status === "published") {
        onSuccess("Post published immediately!");
      } else if (data.status === "draft") {
        onSuccess("Post saved as draft.");
      } else if (data.status === "partial") {
        onSuccess("Post partially published. Check target details.");
      } else {
        onSuccess("Post created.");
      }
      onClose();
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err, "Failed to create post. Please try again."));
    },
  });

  const togglePlatform = (platformId: string) => {
    setSelectedPlatformIds((prev) =>
      prev.includes(platformId) ? prev.filter((id) => id !== platformId) : [...prev, platformId]
    );
  };

  const applyPreset = (hoursFromNow?: number, hourOfDay?: number) => {
    const d = new Date();
    if (hoursFromNow !== undefined) {
      d.setTime(d.getTime() + hoursFromNow * 3600 * 1000);
    } else if (hourOfDay !== undefined) {
      d.setDate(d.getDate() + 1);
      d.setHours(hourOfDay, 0, 0, 0);
    }
    setScheduledAt(toDateTimeLocalString(d));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedContentId) {
      setFormError("Please select content to post.");
      return;
    }
    if (mode !== "draft" && selectedPlatformIds.length === 0) {
      setFormError("Select at least one target platform.");
      return;
    }
    if (mode === "scheduled" && !scheduledAt) {
      setFormError("Please choose a scheduled date and time.");
      return;
    }

    createMutation.mutate();
  };

  const selectedContent = contents.find((c) => c._id === selectedContentId);
  const previewText = selectedContent?.details?.find((d) => d.type === "text")?.text;

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
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 id={titleId} className="text-base font-bold text-foreground flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-primary" />
            <span>Create Post</span>
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create post dialog"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {formError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-xs text-danger"
          >
            {formError}
          </div>
        )}

        {/* Content Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor={contentSelectId} className="block text-xs font-medium text-foreground">
              Content
            </label>
            <Link
              href="/contents/new"
              className="text-[11px] text-primary hover:underline font-medium"
            >
              + New Content
            </Link>
          </div>

          {contents.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-surface-muted border border-border text-xs text-muted-foreground flex items-center justify-between gap-2">
              <span>No content available yet.</span>
              <Link
                href="/contents/new"
                className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition"
              >
                Create Content
              </Link>
            </div>
          ) : (
            <>
              <select
                id={contentSelectId}
                autoFocus
                required
                value={selectedContentId}
                onChange={(e) => setSelectedContentId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {contents.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title} ({c.status})
                  </option>
                ))}
              </select>

              {previewText && (
                <p className="text-[11px] text-muted-foreground bg-surface-muted/60 border border-border rounded-lg px-3 py-2 line-clamp-2 flex items-start gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-subtle-foreground shrink-0 mt-0.5" />
                  <span>{previewText}</span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Target Platforms */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Target Platforms</span>
            <Link
              href="/settings/platforms"
              className="text-[11px] text-primary hover:underline font-medium"
            >
              Manage Platforms
            </Link>
          </div>

          {platforms.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-surface-muted border border-border text-xs text-muted-foreground flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-warning" />
                <span>No connected platforms.</span>
              </span>
              <Link
                href="/settings/platforms"
                className="px-2.5 py-1 rounded-lg bg-surface text-foreground border border-border font-medium hover:bg-surface-muted transition"
              >
                Connect
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {platforms.map((p) => {
                const isSelected = selectedPlatformIds.includes(p._id);
                return (
                  <button
                    key={p._id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => togglePlatform(p._id)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? "bg-primary-soft border-primary-border text-foreground"
                        : "bg-surface-muted border-border text-foreground hover:border-border-strong"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                          {p.code}
                        </span>
                        <span className="text-xs font-medium truncate">
                          {p.account_name || p.platform_account_id || p.code}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border bg-surface"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dispatch Mode */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-foreground">Dispatch Timing</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              aria-pressed={mode === "scheduled"}
              onClick={() => setMode("scheduled")}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center justify-center gap-1.5 ${
                mode === "scheduled"
                  ? "bg-sky-500/15 border-sky-500/60 text-sky-400 font-semibold"
                  : "bg-surface-muted border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Schedule</span>
            </button>
            <button
              type="button"
              aria-pressed={mode === "published"}
              onClick={() => setMode("published")}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center justify-center gap-1.5 ${
                mode === "published"
                  ? "bg-success-soft border-success/60 text-success font-semibold"
                  : "bg-surface-muted border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Publish Now</span>
            </button>
            <button
              type="button"
              aria-pressed={mode === "draft"}
              onClick={() => setMode("draft")}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition flex items-center justify-center gap-1.5 ${
                mode === "draft"
                  ? "bg-surface border-border-strong text-foreground font-semibold"
                  : "bg-surface-muted border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Draft</span>
            </button>
          </div>
        </div>

        {/* Schedule Date & Time */}
        {mode === "scheduled" && (
          <div className="space-y-2.5">
            <label htmlFor={scheduleInputId} className="block text-xs font-medium text-foreground">
              Schedule Date &amp; Time
            </label>
            <input
              id={scheduleInputId}
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => applyPreset(1)}
                className="px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border transition"
              >
                +1 Hour
              </button>
              <button
                type="button"
                onClick={() => applyPreset(3)}
                className="px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border transition"
              >
                +3 Hours
              </button>
              <button
                type="button"
                onClick={() => applyPreset(undefined, 9)}
                className="px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border transition"
              >
                Tomorrow 9 AM
              </button>
              <button
                type="button"
                onClick={() => applyPreset(undefined, 18)}
                className="px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border transition"
              >
                Tomorrow 6 PM
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || contents.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 disabled:opacity-50 transition"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : mode === "scheduled" ? (
              <Clock className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>
              {mode === "scheduled"
                ? "Schedule Post"
                : mode === "published"
                ? "Publish Now"
                : "Save Draft"}
            </span>
          </button>
        </div>
      </form>
    </dialog>
  );
}
