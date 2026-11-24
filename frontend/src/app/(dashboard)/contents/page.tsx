"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient, getMediaUrl } from "@/lib/api-client";
import { Content, ContentStatus, ContentType, Platform } from "@/types";
import {
  FileText,
  Plus,
  Wand2,
  Search,
  Filter,
  Image as ImageIcon,
  Mic,
  Video,
  Edit3,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  Archive,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Check,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ContentsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dispatchContent, setDispatchContent] = useState<Content | null>(null);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");
  const [isScheduledMode, setIsScheduledMode] = useState<boolean>(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>("");
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  // 1. Fetch user contents
  const { data: contents = [], isLoading } = useQuery<Content[]>({
    queryKey: ["contents"],
    queryFn: async () => {
      const res = await apiClient.get<Content[]>("/contents");
      return res.data;
    },
  });

  // 2. Fetch platforms for dispatch modal
  const { data: platforms = [] } = useQuery<Platform[]>({
    queryKey: ["platforms"],
    queryFn: async () => {
      const res = await apiClient.get<Platform[]>("/platforms");
      return res.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/contents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contents"] });
    },
  });

  // Quick Status Update mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ContentStatus }) => {
      await apiClient.put(`/contents/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contents"] });
    },
  });

  // Dispatch post mutation (supports immediate publishing and background scheduling)
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
      const res = await apiClient.post("/posts", {
        content_id: contentId,
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
      return res.data;
    },
    onSuccess: (data) => {
      if (data.status === "scheduled") {
        setDispatchSuccess("Post scheduled! Background worker will automatically dispatch it at the chosen time.");
      } else {
        setDispatchSuccess("All content items successfully dispatched and published to Telegram!");
      }
      setDispatchError(null);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      setTimeout(() => {
        setDispatchContent(null);
        setDispatchSuccess(null);
      }, 2000);
    },
    onError: (err: any) => {
      setDispatchError(err.response?.data?.detail || "Dispatch failed. Please check platform connection.");
    },
  });

  // Filtering
  const filteredContents = contents.filter((item) => {
    // Search query
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.details.some(
        (d) =>
          d.text?.toLowerCase().includes(search.toLowerCase()) ||
          d.script?.toLowerCase().includes(search.toLowerCase())
      );
    if (!matchesSearch) return false;

    // Status filter
    if (statusFilter !== "all" && item.status !== statusFilter) {
      return false;
    }

    // Type filter
    if (typeFilter !== "all") {
      const hasType = item.details.some((d) => d.type === typeFilter);
      if (!hasType) return false;
    }

    return true;
  });

  // Summary counts
  const readyCount = contents.filter((c) => c.status === "ready").length;
  const draftCount = contents.filter((c) => c.status === "draft").length;
  const approvedCount = contents.filter((c) => c.status === "approved").length;

  const getStatusBadge = (status: ContentStatus) => {
    switch (status) {
      case "ready":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Ready
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Check className="h-3 w-3" /> Approved
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
            <Clock className="h-3 w-3" /> Draft
          </span>
        );
      case "generating":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Loader2 className="h-3 w-3 animate-spin" /> Generating
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Archive className="h-3 w-3" /> Archived
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs bg-neutral-800 text-neutral-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-400" />
            <span>Content Manager</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Create, upload, adjust, and organize your social content, media, and copy manually.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/studio"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 transition"
          >
            <Wand2 className="h-3.5 w-3.5 text-purple-400" />
            <span>AI Studio</span>
          </Link>
          <Link
            href="/contents/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create Manual Content</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
          <p className="text-[11px] font-medium text-neutral-400">Total Contents</p>
          <p className="text-xl font-bold text-white mt-1">{contents.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
          <p className="text-[11px] font-medium text-emerald-400">Ready to Publish</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{readyCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
          <p className="text-[11px] font-medium text-blue-400">Approved</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{approvedCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800">
          <p className="text-[11px] font-medium text-neutral-400">Drafts</p>
          <p className="text-xl font-bold text-neutral-300 mt-1">{draftCount}</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-neutral-900/60 p-3 rounded-2xl border border-neutral-800">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contents by title, script, or copy..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white placeholder-neutral-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {["all", "ready", "draft", "approved", "archived"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition shrink-0 ${
                statusFilter === st
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Type Filter Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="h-3.5 w-3.5 text-neutral-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Modalities</option>
            <option value="text">Text / Copy</option>
            <option value="image">Image / Graphic</option>
            <option value="audio">Audio / Voiceover</option>
            <option value="video">Video / Reel</option>
          </select>
        </div>
      </div>

      {/* Content List */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center text-neutral-500">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <span className="text-xs">Loading contents...</span>
        </div>
      ) : filteredContents.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/30">
          <FileText className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No contents found</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== "all" || typeFilter !== "all"
              ? "Try adjusting your search criteria or filters."
              : "Start by manually creating your first content piece or upload media."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/contents/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Content Manually</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredContents.map((content) => {
            const textDetail = content.details.find((d) => d.type === "text");
            const imageDetail = content.details.find((d) => d.type === "image");
            const audioDetail = content.details.find((d) => d.type === "audio");
            const videoDetail = content.details.find((d) => d.type === "video");

            return (
              <div
                key={content._id}
                className="group relative rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/contents/${content._id}`}
                        className="text-base font-bold text-white hover:text-indigo-400 transition truncate block"
                      >
                        {content.title}
                      </Link>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Updated {formatDate(content.updated_at)}
                      </p>
                    </div>
                    <div>{getStatusBadge(content.status)}</div>
                  </div>

                  {/* Modality Badges */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {textDetail && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                        <FileText className="h-3 w-3 text-indigo-400" /> Text
                      </span>
                    )}
                    {imageDetail && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                        <ImageIcon className="h-3 w-3 text-pink-400" /> Image
                      </span>
                    )}
                    {audioDetail && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                        <Mic className="h-3 w-3 text-emerald-400" /> Audio
                      </span>
                    )}
                    {videoDetail && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                        <Video className="h-3 w-3 text-cyan-400" /> Video
                      </span>
                    )}
                  </div>

                  {/* Visual Preview / Thumbnail Area */}
                  <div className="mt-4">
                    {imageDetail?.path ? (
                      <div className="relative rounded-xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800/80">
                        <img
                          src={getMediaUrl(imageDetail.path)}
                          alt={content.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                    ) : videoDetail?.path ? (
                      <div className="relative rounded-xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800 flex items-center justify-center">
                        <video
                          src={getMediaUrl(videoDetail.path)}
                          className="w-full h-full object-cover"
                          controls={false}
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Video className="h-8 w-8 text-cyan-400" />
                        </div>
                      </div>
                    ) : audioDetail?.path ? (
                      <div className="p-3.5 rounded-xl bg-neutral-800/40 border border-neutral-800 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                          <Mic className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-neutral-300 truncate">Audio Track</p>
                          <audio
                            src={getMediaUrl(audioDetail.path)}
                            controls
                            className="w-full h-7 mt-1"
                          />
                        </div>
                      </div>
                    ) : textDetail?.text ? (
                      <div className="p-3.5 rounded-xl bg-neutral-800/30 border border-neutral-800/80 text-xs text-neutral-300 line-clamp-3 italic">
                        &ldquo;{textDetail.text}&rdquo;
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-neutral-800/20 border border-neutral-800/60 text-center text-neutral-500 text-xs">
                        No details attached yet
                      </div>
                    )}
                  </div>

                  {/* Text snippet if image is present */}
                  {imageDetail && textDetail?.text && (
                    <p className="mt-3 text-xs text-neutral-400 line-clamp-2">
                      {textDetail.text}
                    </p>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 pt-4 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/contents/${content._id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition"
                      title="Adjust & Edit"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Adjust</span>
                    </Link>

                    <button
                      onClick={() => setDispatchContent(content)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition"
                      title="Dispatch / Publish"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Dispatch</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Quick Status Dropdown */}
                    <select
                      value={content.status}
                      onChange={(e) =>
                        statusMutation.mutate({
                          id: content._id,
                          status: e.target.value as ContentStatus,
                        })
                      }
                      className="bg-neutral-800/80 text-[11px] text-neutral-300 border border-neutral-700/80 rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value="draft">Draft</option>
                      <option value="ready">Ready</option>
                      <option value="approved">Approved</option>
                      <option value="archived">Archived</option>
                    </select>

                    {/* Delete button */}
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${content.title}"?`)) {
                          deleteMutation.mutate(content._id);
                        }
                      }}
                      className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Delete Content"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchContent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-400" />
                <span>Dispatch Content</span>
              </h3>
              <button
                onClick={() => {
                  setDispatchContent(null);
                  setDispatchError(null);
                  setDispatchSuccess(null);
                }}
                className="text-neutral-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            {/* Content summary and items list */}
            <div className="p-3.5 rounded-xl bg-neutral-800/50 border border-neutral-700/60 space-y-2">
              <p className="text-xs font-semibold text-white truncate">{dispatchContent.title}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {dispatchContent.details.map((d, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-900 text-neutral-300 border border-neutral-700/80"
                  >
                    {d.type === "text" && <FileText className="h-3 w-3 text-indigo-400" />}
                    {d.type === "image" && <ImageIcon className="h-3 w-3 text-pink-400" />}
                    {d.type === "audio" && <Mic className="h-3 w-3 text-emerald-400" />}
                    {d.type === "video" && <Video className="h-3 w-3 text-cyan-400" />}
                    <span className="capitalize">{d.type}</span>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-neutral-400">
                All {dispatchContent.details.length} content item(s) will be published in order to the destination.
              </p>
            </div>

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
                    // Default to 1 hour from now
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

            {dispatchError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{dispatchError}</span>
              </div>
            )}

            {dispatchSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{dispatchSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Select Connected Destination Platform
              </label>
              {platforms.length === 0 ? (
                <div className="text-xs text-neutral-400 p-3 bg-neutral-800/40 rounded-xl border border-neutral-700">
                  No platforms connected.{" "}
                  <Link href="/settings/platforms" className="text-indigo-400 underline">
                    Connect Telegram bot now
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedPlatformId || (platforms[0]?._id ?? "")}
                  onChange={(e) => setSelectedPlatformId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {platforms.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.account_name || "Telegram Channel"} ({p.code})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDispatchContent(null)}
                className="px-3.5 py-2 rounded-xl text-xs text-neutral-300 hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={platforms.length === 0 || dispatchMutation.isPending || (isScheduledMode && !scheduledDateTime)}
                onClick={() => {
                  const platId = selectedPlatformId || platforms[0]?._id;
                  if (platId) {
                    dispatchMutation.mutate({
                      contentId: dispatchContent._id,
                      platformId: platId,
                      isScheduled: isScheduledMode,
                      scheduledAt: isScheduledMode && scheduledDateTime ? new Date(scheduledDateTime).toISOString() : undefined,
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition"
              >
                {dispatchMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>
                  {dispatchMutation.isPending
                    ? isScheduledMode
                      ? "Scheduling..."
                      : "Publishing..."
                    : isScheduledMode
                    ? "Schedule Post"
                    : "Publish All Items Now"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
