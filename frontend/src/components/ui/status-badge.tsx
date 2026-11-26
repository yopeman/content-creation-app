"use client";

import React from "react";
import {
  Clock,
  CheckCircle2,
  Check,
  Loader2,
  Archive,
  AlertCircle,
  XCircle,
  Send,
  CalendarClock,
  Radio,
  FileEdit,
} from "lucide-react";
import { ContentStatus, PostStatus, PlatformStatus } from "@/types";

/* ------------------------------------------------------------------
 * Content Status Config & Badge
 * ------------------------------------------------------------------ */

export interface StatusMeta {
  label: string;
  description: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
  stepIndex?: number;
}

export const CONTENT_STATUS_CONFIG: Record<ContentStatus, StatusMeta> = {
  draft: {
    label: "Draft",
    description: "In progress; editing text, scripts, or media blocks.",
    badgeClass: "bg-surface-muted text-muted-foreground border-border",
    icon: FileEdit,
    stepIndex: 0,
  },
  generating: {
    label: "Generating",
    description: "AI generation in progress.",
    badgeClass: "bg-warning-soft text-warning border-warning/20",
    icon: Loader2,
  },
  ready: {
    label: "Ready",
    description: "Content is complete and ready for publishing or review.",
    badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: CheckCircle2,
    stepIndex: 1,
  },
  approved: {
    label: "Approved",
    description: "Reviewed and approved for dispatch across channels.",
    badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    icon: Check,
    stepIndex: 2,
  },
  archived: {
    label: "Archived",
    description: "Archived; retired from active publishing queues.",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: Archive,
  },
};

export function ContentStatusBadge({
  status,
  size = "md",
  showIcon = true,
  className = "",
}: {
  status: ContentStatus;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}) {
  const meta = CONTENT_STATUS_CONFIG[status] || {
    label: status,
    description: "",
    badgeClass: "bg-surface-muted text-muted-foreground border-border",
    icon: Clock,
  };
  const Icon = meta.icon;
  const isSpinning = status === "generating";

  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const iconSizeClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border shadow-2xs transition ${meta.badgeClass} ${sizeClass} ${className}`}
      title={meta.description}
    >
      {showIcon && (
        <Icon className={`${iconSizeClass} shrink-0 ${isSpinning ? "animate-spin" : ""}`} />
      )}
      <span>{meta.label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------
 * Post Status Config & Badge
 * ------------------------------------------------------------------ */

export const POST_STATUS_CONFIG: Record<
  PostStatus,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: {
    label: "Draft",
    badgeClass: "bg-surface-muted text-muted-foreground border-border",
    icon: Clock,
  },
  scheduled: {
    label: "Scheduled",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: CalendarClock,
  },
  publishing: {
    label: "Publishing",
    badgeClass: "bg-warning-soft text-warning border-warning/20",
    icon: Loader2,
  },
  published: {
    label: "Published",
    badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: CheckCircle2,
  },
  partial: {
    label: "Partial",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: AlertCircle,
  },
  failed: {
    label: "Failed",
    badgeClass: "bg-danger-soft text-danger border-danger/20",
    icon: XCircle,
  },
};

export function PostStatusBadge({
  status,
  size = "md",
  showIcon = true,
  className = "",
}: {
  status: PostStatus;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}) {
  const meta = POST_STATUS_CONFIG[status] || {
    label: status,
    badgeClass: "bg-surface-muted text-muted-foreground border-border",
    icon: Clock,
  };
  const Icon = meta.icon;
  const isSpinning = status === "publishing";

  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const iconSizeClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border shadow-2xs ${meta.badgeClass} ${sizeClass} ${className}`}
    >
      {showIcon && (
        <Icon className={`${iconSizeClass} shrink-0 ${isSpinning ? "animate-spin" : ""}`} />
      )}
      <span className="capitalize">{meta.label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------
 * Platform Status Config & Badge
 * ------------------------------------------------------------------ */

export const PLATFORM_STATUS_CONFIG: Record<
  PlatformStatus,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  connected: {
    label: "Connected",
    badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: CheckCircle2,
  },
  expired: {
    label: "Expired",
    badgeClass: "bg-warning-soft text-warning border-warning/20",
    icon: AlertCircle,
  },
  revoked: {
    label: "Revoked",
    badgeClass: "bg-surface-muted text-muted-foreground border-border",
    icon: XCircle,
  },
  error: {
    label: "Error",
    badgeClass: "bg-danger-soft text-danger border-danger/20",
    icon: AlertCircle,
  },
};

export function PlatformStatusBadge({
  status,
  size = "md",
  showIcon = true,
  className = "",
}: {
  status: PlatformStatus;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}) {
  const meta = PLATFORM_STATUS_CONFIG[status] || {
    label: status,
    badgeClass: "bg-surface-muted text-muted-foreground border-border",
    icon: Radio,
  };
  const Icon = meta.icon;

  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const iconSizeClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border shadow-2xs ${meta.badgeClass} ${sizeClass} ${className}`}
    >
      {showIcon && <Icon className={`${iconSizeClass} shrink-0`} />}
      <span>{meta.label}</span>
    </span>
  );
}
