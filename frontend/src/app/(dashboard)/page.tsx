"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { Content, Post, Platform, ClaimTicketResponse, OnboardingStatus } from "@/types";
import {
  FileText,
  Wand2,
  Radio,
  ArrowRight,
  Plus,
  CheckCircle2,
  Clock,
  Megaphone,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";
import { QuickStartWizardModal } from "@/components/onboarding/quick-start-wizard-modal";

export default function DashboardOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 flex flex-col items-center justify-center text-subtle-foreground space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Loading dashboard...</span>
        </div>
      }
    >
      <DashboardOverviewContent />
    </Suspense>
  );
}

function DashboardOverviewContent() {
  const searchParams = useSearchParams();
  const claimToken = searchParams.get("claim_token");
  const { setAuth } = useAuthStore();
  const queryClient = useQueryClient();

  const [claimLoading, setClaimLoading] = useState(Boolean(claimToken));
  const [claimError, setClaimError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [onboardingSuccessToast, setOnboardingSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (!claimToken) return;
    let isMounted = true;
    (async () => {
      try {
        setClaimLoading(true);
        const res = await apiClient.post<ClaimTicketResponse>("/integrations/claim-ticket", {
          claim_token: claimToken,
        });
        if (!isMounted) return;
        setAuth(res.data.user, res.data.access_token);
        setOnboarding(res.data.onboarding);
        setClaimLoading(false);
        queryClient.invalidateQueries({ queryKey: ["contents"] });
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["platforms"] });
        window.history.replaceState({}, "", window.location.pathname);
      } catch (err: any) {
        if (!isMounted) return;
        setClaimLoading(false);
        setClaimError(err.response?.data?.detail || "Invalid or expired access token.");
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [claimToken, queryClient, setAuth]);

  const { data: contents = [], isLoading: loadingContents } = useQuery<Content[]>({
    queryKey: ["contents"],
    queryFn: async () => {
      const res = await apiClient.get<Content[]>("/contents");
      return res.data;
    },
    enabled: !claimLoading,
  });

  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await apiClient.get<Post[]>("/posts");
      return res.data;
    },
    enabled: !claimLoading,
  });

  const { data: platforms = [] } = useQuery<Platform[]>({
    queryKey: ["platforms"],
    queryFn: async () => {
      const res = await apiClient.get<Platform[]>("/platforms");
      return res.data;
    },
    enabled: !claimLoading,
  });

  if (claimLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-subtle-foreground space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs font-medium">Claiming access ticket & loading your dashboard...</span>
      </div>
    );
  }

  if (claimError) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-surface border border-danger/30 text-center space-y-4 shadow-xl">
        <div className="h-12 w-12 rounded-xl bg-danger-soft text-danger flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-foreground">Access Link Expired or Invalid</h2>
        <p className="text-xs text-muted-foreground">{claimError}</p>
        <Link
          href="/login"
          className="inline-flex px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
  const publishedCount = posts.filter((p) => p.status === "published").length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {onboardingSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{onboardingSuccessToast}</span>
        </div>
      )}

      {/* Onboarding Wizard Modal if user needs password or active channel */}
      {onboarding && (
        <QuickStartWizardModal
          initialOnboarding={onboarding}
          hasPlatforms={platforms.length > 0}
          destinationLabel="Open Dashboard"
          onSuccess={() => {
            setOnboardingSuccessToast("Account setup completed! Welcome to your dashboard.");
            setTimeout(() => setOnboardingSuccessToast(null), 4000);
          }}
        />
      )}

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-soft via-surface to-surface-muted border border-primary-border p-5 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft border border-primary-border text-primary text-xs font-semibold mb-3">
            <Megaphone className="h-3.5 w-3.5" />
            <span>AI Multi-Modal Content Engine</span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl lg:text-4xl">
            Welcome to Yope Creator
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Generate viral social posts, produce audio voiceovers and video reels, and publish to Telegram in one automated workflow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/30 transition"
            >
              <Wand2 className="h-4 w-4" />
              <span>Generate Content with AI</span>
              <ComingSoonBadge />
            </Link>
            <Link
              href="/contents/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-sm font-medium border border-border transition"
            >
              <Plus className="h-4 w-4" />
              <span>New Content</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Contents</span>
            <div className="p-2 rounded-lg bg-primary-soft text-primary">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-3">{contents.length}</p>
          <p className="text-xs text-subtle-foreground mt-1">Multi-modal content assets</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Scheduled Posts</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-3">{scheduledCount}</p>
          <p className="text-xs text-subtle-foreground mt-1">Ready for automated broadcast</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Published Posts</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-3">{publishedCount}</p>
          <p className="text-xs text-subtle-foreground mt-1">Dispatched to channels</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Channels</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-3">{platforms.length}</p>
          <p className="text-xs text-subtle-foreground mt-1">Telegram bots & destinations</p>
        </div>
      </div>

      {/* Main Grid: Recent Contents & Dispatch Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Contents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Content</h2>
            <Link
              href="/contents"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loadingContents ? (
            <div className="rounded-2xl bg-surface border border-border p-8 text-center text-xs text-muted-foreground">
              Loading recent content...
            </div>
          ) : contents.length === 0 ? (
            <div className="rounded-2xl bg-surface border border-border p-12 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">No content yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create your first multimodal content or ingest drafts from an external project to start publishing.
              </p>
              <div className="pt-2">
                <Link
                  href="/contents/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create First Content</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface border border-border divide-y divide-border overflow-hidden">
              {contents.slice(0, 5).map((item) => {
                const totalBlocks = item.details?.length || 0;
                return (
                  <Link
                    key={item._id}
                    href={`/contents/${item._id}`}
                    className="p-4 flex items-center justify-between hover:bg-surface-muted transition group"
                  >
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground group-hover:text-primary transition truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-muted border border-border text-muted-foreground uppercase font-mono">
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{totalBlocks} block(s)</span>
                        <span>•</span>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Dispatch / Platform Status */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Platform Status</h2>

          <div className="rounded-2xl bg-surface border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs">
                  TG
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Telegram</h4>
                  <p className="text-[10px] text-muted-foreground">Direct Bot API publishing</p>
                </div>
              </div>

              {platforms.some((p) => p.code === "TG") ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-success font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <Link
                  href="/settings/platforms"
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Connect +
                </Link>
              )}
            </div>

            {platforms.filter((p) => p.code === "TG").map((tg) => (
              <div
                key={tg._id}
                className="p-3 rounded-xl bg-surface-muted border border-border text-xs flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-foreground truncate">{tg.account_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{tg.platform_account_id}</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-success shrink-0" />
              </div>
            ))}

            <div className="border-t border-border pt-3">
              <Link
                href="/settings/platforms"
                className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 transition"
              >
                <Radio className="h-3.5 w-3.5" />
                <span>Manage Platforms</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
