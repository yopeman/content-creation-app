"use client";

import React from "react";
import {
  FileEdit,
  CheckCircle2,
  Check,
  Archive,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { ContentStatus } from "@/types";
import { CONTENT_STATUS_CONFIG, ContentStatusBadge } from "./status-badge";

interface ContentStatusManagerProps {
  value: ContentStatus;
  onChange: (newStatus: ContentStatus) => void;
  className?: string;
  showStepper?: boolean;
  showDescriptions?: boolean;
}

const LIFECYCLE_STEPS: ContentStatus[] = ["draft", "ready", "approved"];

export function ContentStatusManager({
  value,
  onChange,
  className = "",
  showStepper = true,
  showDescriptions = true,
}: ContentStatusManagerProps) {
  const currentConfig = CONTENT_STATUS_CONFIG[value];
  const isArchived = value === "archived";

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Visual Lifecycle Stepper */}
      {showStepper && (
        <div className="p-3 sm:p-4 rounded-xl bg-surface-muted/60 border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Publishing Workflow Progress</span>
            </span>
            <div className="flex items-center gap-2">
              <ContentStatusBadge status={value} size="sm" />
              {isArchived ? (
                <button
                  type="button"
                  onClick={() => onChange("draft")}
                  className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Restore to Draft</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange("archived")}
                  className="text-[11px] text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1"
                >
                  <Archive className="h-3 w-3" />
                  <span>Archive</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const meta = CONTENT_STATUS_CONFIG[step];
              const Icon = meta.icon;
              const isActive = value === step;
              const currentStepIndex =
                LIFECYCLE_STEPS.indexOf(value as any);
              const isPassed = !isArchived && currentStepIndex > idx;

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => onChange(step)}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1.5 relative ${
                    isActive
                      ? "bg-surface border-primary shadow-xs ring-1 ring-primary/20"
                      : isPassed
                      ? "bg-surface-muted/50 border-border hover:bg-surface text-foreground"
                      : "bg-surface-muted/30 border-dashed border-border/80 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isPassed
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-surface-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {isPassed ? <Check className="h-3 w-3 stroke-[3]" /> : idx + 1}
                    </span>

                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        isActive
                          ? "bg-primary-soft text-primary font-semibold"
                          : isPassed
                          ? "text-emerald-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isActive ? "Current" : isPassed ? "Completed" : "Next"}
                    </span>
                  </div>

                  <div>
                    <span
                      className={`text-xs font-semibold block truncate ${
                        isActive ? "text-foreground" : isPassed ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {meta.label}
                    </span>
                    {showDescriptions && (
                      <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {step === "draft"
                          ? "Drafting & editing"
                          : step === "ready"
                          ? "Ready for review"
                          : "Approved to post"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Visual Status Option Pills / Grid */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-foreground">
          Select Status
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["draft", "ready", "approved", "archived"] as ContentStatus[]).map((st) => {
            const meta = CONTENT_STATUS_CONFIG[st];
            const Icon = meta.icon;
            const isSelected = value === st;

            return (
              <button
                key={st}
                type="button"
                onClick={() => onChange(st)}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                  isSelected
                    ? "bg-primary-soft border-primary-border shadow-xs"
                    : "bg-surface-muted border-border hover:border-border-strong text-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={`h-4 w-4 ${
                        isSelected ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSelected
                        ? "bg-primary ring-2 ring-primary/20"
                        : "bg-border"
                    }`}
                  />
                </div>
                {showDescriptions && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {meta.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
