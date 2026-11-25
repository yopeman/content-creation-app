"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { Content, Post, Platform } from "@/types";
import {
  FileText,
  Wand2,
  Send,
  Radio,
  ArrowRight,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";

export default function DashboardOverviewPage() {
  const { data: contents = [], isLoading: loadingContents } = useQuery<Content[]>({
    queryKey: ["contents"],
    queryFn: async () => {
      const res = await apiClient.get<Content[]>("/contents");
      return res.data;
    },
  });

  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await apiClient.get<Post[]>("/posts");
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

  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
  const publishedCount = posts.filter((p) => p.status === "published").length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-neutral-900 border border-indigo-500/20 p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Multi-Modal Content Engine</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Welcome to Yope Creator
          </h1>
          <p className="mt-2 text-sm text-neutral-300 leading-relaxed">
            Generate viral social posts, produce audio voiceovers and video reels, and publish to Telegram in one automated workflow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition"
            >
              <Wand2 className="h-4 w-4" />
              <span>Generate Content with AI</span>
              <ComingSoonBadge />
            </Link>
            <Link
              href="/contents/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium border border-neutral-700 transition"
            >
              <Plus className="h-4 w-4" />
              <span>New Content</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Total Contents</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">{contents.length}</p>
          <p className="text-xs text-neutral-500 mt-1">Multi-modal content assets</p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Scheduled Posts</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">{scheduledCount}</p>
          <p className="text-xs text-neutral-500 mt-1">Ready for automated dispatch</p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Published Posts</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">{publishedCount}</p>
          <p className="text-xs text-neutral-500 mt-1">Delivered to connected channels</p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Connected Accounts</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-3">{platforms.length}</p>
          <p className="text-xs text-neutral-500 mt-1">
            {platforms.length > 0 ? "Telegram active" : "No accounts connected"}
          </p>
        </div>
      </div>

      {/* Grid: Contents & Quick Platform Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Contents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Content</h2>
            <Link
              href="/contents"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loadingContents ? (
            <div className="h-48 rounded-2xl bg-neutral-900/50 border border-neutral-800 animate-pulse flex items-center justify-center text-neutral-500 text-sm">
              Loading content...
            </div>
          ) : contents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 p-8 text-center bg-neutral-900/30">
              <FileText className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-300">No content created yet</p>
              <p className="text-xs text-neutral-500 mt-1">
                Draft content manually or generate multi-modal assets with AI.
              </p>
              <Link
                href="/studio"
                className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium"
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span>Open Studio</span>
                <ComingSoonBadge />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {contents.slice(0, 5).map((c) => {
                const textDetail = c.details.find((d) => d.type === "text");
                const formatCount = c.details?.length || 0;

                return (
                  <Link
                    key={c._id}
                    href={`/contents/${c._id}`}
                    className="block p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-800/40 transition group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition">
                          {c.title}
                        </h3>
                        {textDetail?.text && (
                          <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">
                            {textDetail.text}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-medium capitalize">
                        {c.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500 border-t border-neutral-800/60 pt-2.5">
                      <span>{formatCount} format(s) attached</span>
                      <span>Created {formatDate(c.created_at)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Dispatch / Platform Status */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Platform Status</h2>

          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs">
                  TG
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Telegram</h4>
                  <p className="text-[10px] text-neutral-400">Direct Bot API publishing</p>
                </div>
              </div>

              {platforms.some((p) => p.code === "TG") ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <Link
                  href="/settings/platforms"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Connect +
                </Link>
              )}
            </div>

            {platforms.filter((p) => p.code === "TG").map((tg) => (
              <div
                key={tg._id}
                className="p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50 text-xs flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-white truncate">{tg.account_name}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{tg.platform_account_id}</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
              </div>
            ))}

            <div className="border-t border-neutral-800 pt-3">
              <Link
                href="/settings/platforms"
                className="w-full py-2 px-3 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
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
