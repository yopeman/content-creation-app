"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Campaign, Plan, Platform } from "@/types";
import {
  ArrowLeft,
  Wand2,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campaignId = params.id as string;

  const [dispatchPlan, setDispatchPlan] = useState<Plan | null>(null);
  const [isScheduledMode, setIsScheduledMode] = useState<boolean>(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>("");

  const { data: campaign, isLoading } = useQuery<Campaign>({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      const res = await apiClient.get<Campaign>(`/campaigns/${campaignId}`);
      return res.data;
    },
    enabled: !!campaignId,
  });

  const { data: platforms = [] } = useQuery<Platform[]>({
    queryKey: ["platforms"],
    queryFn: async () => {
      const res = await apiClient.get<Platform[]>("/platforms");
      return res.data;
    },
  });

  // 1. Run Loop on whole campaign
  const loopMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/generations/campaign/${campaignId}/loop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["contents"] });
    },
  });

  // 2. Generate content for single plan
  const planContentMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiClient.post(`/generations/plans/${planId}/content`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["contents"] });
    },
  });

  // 3. Dispatch / Post content
  const dispatchMutation = useMutation({
    mutationFn: async ({
      contentId,
      platformId,
      isScheduled,
      scheduledAt,
    }: {
      contentId: string;
      platformId: string;
      isScheduled: boolean;
      scheduledAt?: string;
    }) => {
      await apiClient.post("/posts", {
        content_id: contentId,
        campaign_id: campaignId,
        status: isScheduled ? "scheduled" : "published",
        scheduled_at: isScheduled ? scheduledAt : undefined,
        targets: [
          {
            platform_id: platformId,
            platform_code: "TG",
            scheduled_at: isScheduled ? scheduledAt : undefined,
          },
        ],
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      setDispatchPlan(null);
      if (vars.isScheduled) {
        alert("Post scheduled successfully! Background worker will publish it when due.");
      } else {
        alert("All content items dispatched successfully to Telegram!");
      }
    },
  });

  if (isLoading || !campaign) {
    return (
      <div className="h-64 flex items-center justify-center text-neutral-500 text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading campaign details...
      </div>
    );
  }

  const color =
    campaign.color_hash_code ||
    campaign.color_has_code ||
    campaign.color_hex_code ||
    "#6366F1";
  const plans = campaign.plans || [];
  const readyCount = plans.filter((p) => p.status === "ready" || p.status === "published").length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns"
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {campaign.title || campaign.idea}
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 capitalize font-medium">
                {campaign.status}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">{campaign.idea}</p>
          </div>
        </div>

        {/* Global Campaign Action */}
        <button
          onClick={() => loopMutation.mutate()}
          disabled={loopMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
        >
          {loopMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating All Content...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Run AI Generation Loop</span>
            </>
          )}
        </button>
      </div>

      {/* Campaign Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaign.goal && (
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
            <span className="text-[10px] uppercase font-bold text-neutral-500">Goal</span>
            <p className="text-xs font-medium text-neutral-200 mt-1">{campaign.goal}</p>
          </div>
        )}
        {campaign.context && (
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
            <span className="text-[10px] uppercase font-bold text-neutral-500">Audience / Context</span>
            <p className="text-xs font-medium text-neutral-200 mt-1">{campaign.context}</p>
          </div>
        )}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
          <span className="text-[10px] uppercase font-bold text-neutral-500">Progress</span>
          <p className="text-xs font-medium text-neutral-200 mt-1">
            {readyCount} of {plans.length} items ready for publishing
          </p>
        </div>
      </div>

      {/* Plans List / Editorial Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>Scheduled Plan Items</span>
          </h2>
          <span className="text-xs text-neutral-400">{plans.length} total</span>
        </div>

        <div className="space-y-3">
          {plans.map((plan) => {
            const isReady = plan.status === "ready" || plan.status === "published";
            const isGenerating =
              plan.status === "generating" ||
              (planContentMutation.isPending &&
                planContentMutation.variables === plan._id);

            return (
              <div
                key={plan._id}
                className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-neutral-700/80 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-xl bg-neutral-800 border border-neutral-700 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                    #{plan.order}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-white">{plan.idea}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                      <span className="capitalize px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-medium">
                        {plan.status}
                      </span>
                      {plan.formats?.map((fmt) => (
                        <span key={fmt} className="uppercase px-1.5 py-0.5 rounded bg-neutral-800/80 text-[10px] text-neutral-400 font-mono">
                          {fmt}
                        </span>
                      ))}
                      {plan.scheduled_at && (
                        <span className="flex items-center gap-1 text-neutral-500">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(plan.scheduled_at)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Plan Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {plan.content_id ? (
                    <>
                      <Link
                        href={`/studio/${plan.content_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
                      >
                        <Wand2 className="h-3.5 w-3.5 text-purple-400" />
                        <span>Edit in Studio</span>
                      </Link>

                      <button
                        onClick={() => setDispatchPlan(plan)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Publish</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => planContentMutation.mutate(plan._id)}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3.5 w-3.5" />
                          <span>Generate Content</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dispatch Modal Dialog */}
      {dispatchPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Send className="h-4 w-4 text-indigo-400" />
              <span>Publish Post to Platforms</span>
            </h3>

            <p className="text-xs text-neutral-400">
              Publishing all content items for: <span className="text-white font-medium">{dispatchPlan.idea}</span>
            </p>

            {/* Mode Toggle: Direct vs Scheduled */}
            <div className="grid grid-cols-2 p-1 bg-neutral-800/80 rounded-xl border border-neutral-700/60 text-xs font-medium">
              <button
                type="button"
                onClick={() => setIsScheduledMode(false)}
                className={`py-1.5 rounded-lg transition text-center ${
                  !isScheduledMode
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Publish Directly
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsScheduledMode(true);
                  if (!scheduledDateTime) {
                    const d = new Date(Date.now() + 3600 * 1000);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    setScheduledDateTime(formatted);
                  }
                }}
                className={`py-1.5 rounded-lg transition text-center ${
                  isScheduledMode
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Schedule for Later
              </button>
            </div>

            {/* Date Time Picker for Scheduling */}
            {isScheduledMode && (
              <div className="space-y-1.5 p-3 rounded-xl bg-neutral-800/40 border border-neutral-700/60">
                <label className="block text-xs font-medium text-neutral-300">
                  Select Scheduled Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  The background worker will automatically dispatch this post when the scheduled time arrives.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-300">
                Target Platform
              </label>

              {platforms.length === 0 ? (
                <div className="p-3 rounded-lg bg-neutral-800/60 text-xs text-neutral-400 text-center">
                  No accounts connected yet. Please{" "}
                  <Link href="/settings/platforms" className="text-indigo-400 underline">
                    connect a Telegram channel
                  </Link>
                  .
                </div>
              ) : (
                platforms.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => {
                      if (dispatchPlan.content_id) {
                        dispatchMutation.mutate({
                          contentId: dispatchPlan.content_id,
                          platformId: p._id,
                          isScheduled: isScheduledMode,
                          scheduledAt: isScheduledMode && scheduledDateTime ? new Date(scheduledDateTime).toISOString() : undefined,
                        });
                      }
                    }}
                    disabled={dispatchMutation.isPending || (isScheduledMode && !scheduledDateTime)}
                    className="w-full p-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/80 text-left flex items-center justify-between transition disabled:opacity-50"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{p.account_name}</p>
                      <p className="text-[10px] text-neutral-400">{p.platform_account_id} ({p.code})</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-medium">
                      <span>{isScheduledMode ? "Schedule" : "Publish"}</span>
                      <Send className="h-4 w-4" />
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDispatchPlan(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
