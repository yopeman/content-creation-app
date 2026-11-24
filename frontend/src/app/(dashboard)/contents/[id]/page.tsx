"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient, getMediaUrl } from "@/lib/api-client";
import { Content, ContentDetail, ContentStatus, ContentType, Platform } from "@/types";
import {
  ArrowLeft,
  Plus,
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  UploadCloud,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Eye,
  Check,
  Save,
  Wand2,
  Send,
  CheckCircle2,
  Link2,
} from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";

interface EditableBlock extends ContentDetail {
  id: string;
  isUploading?: boolean;
  uploadError?: string | null;
  sourceType?: "upload" | "url";
}

export default function ContentAdjusterPage() {
  const params = useParams();
  const contentId = params.id as string;

  // 1. Fetch content
  const { data: content, isLoading: loadingContent } = useQuery<Content>({
    queryKey: ["content", contentId],
    queryFn: async () => {
      const res = await apiClient.get<Content>(`/contents/${contentId}`);
      return res.data;
    },
    enabled: !!contentId,
  });

  // 2. Fetch platforms for dispatch modal
  const { data: platforms = [] } = useQuery<Platform[]>({
    queryKey: ["platforms"],
    queryFn: async () => {
      const res = await apiClient.get<Platform[]>("/platforms");
      return res.data;
    },
  });

  if (loadingContent || !content) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-neutral-500">
        <Loader2 className="h-6 w-6 animate-spin mb-2" />
        <span className="text-xs">Loading content details...</span>
      </div>
    );
  }

  return <ContentAdjusterForm key={content._id} content={content} platforms={platforms} />;
}

function ContentAdjusterForm({
  content,
  platforms,
}: {
  content: Content;
  platforms: Platform[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const contentId = content._id;

  const [title, setTitle] = useState(content.title || "");
  const [status, setStatus] = useState<ContentStatus>(content.status || "draft");
  const [blocks, setBlocks] = useState<EditableBlock[]>(() =>
    (content.details || []).map((d, index) => {
      const isUrl = Boolean(
        d.path &&
          (d.path.startsWith("http://") || d.path.startsWith("https://")) &&
          !d.path.includes("/uploads/")
      );
      return {
        ...d,
        id: `block-${index}-${Date.now()}`,
        sourceType: isUrl ? ("url" as const) : ("upload" as const),
      };
    })
  );
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Dispatch modal state
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");
  const [isScheduledMode, setIsScheduledMode] = useState<boolean>(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>("");
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  // Block management functions
  const addBlock = (type: ContentType) => {
    const newBlock: EditableBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      text: "",
      order: blocks.length + 1,
      sourceType: "upload",
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    const updated = blocks
      .filter((b) => b.id !== id)
      .map((b, idx) => ({ ...b, order: idx + 1 }));
    setBlocks(updated);
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;

    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;

    setBlocks(newBlocks.map((b, idx) => ({ ...b, order: idx + 1 })));
  };

  const updateBlock = (id: string, updates: Partial<EditableBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  // Upload handler for updating or replacing media
  const handleUpload = async (blockId: string, file: File, expectedType: ContentType) => {
    updateBlock(blockId, { isUploading: true, uploadError: null });

    const MAX_SIZES: Record<ContentType, number> = {
      text: 10 * 1024 * 1024,
      image: 20 * 1024 * 1024,
      audio: 50 * 1024 * 1024,
      video: 200 * 1024 * 1024,
    };

    if (file.size > MAX_SIZES[expectedType]) {
      const limitMb = MAX_SIZES[expectedType] / (1024 * 1024);
      updateBlock(blockId, {
        isUploading: false,
        uploadError: `File exceeds maximum limit of ${limitMb}MB.`,
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("media_type", expectedType);

    try {
      const res = await apiClient.post("/contents/upload-media", formData);

      const detail = res.data.detail;
      const fileName = detail.original_filename || file.name;
      updateBlock(blockId, {
        isUploading: false,
        path: detail.url || detail.path,
        text: fileName,
        script: fileName,
        mime_type: detail.mime_type,
        file_size_bytes: detail.file_size_bytes,
        uploadError: null,
      });

      // Automatically prefill title if not set
      setTitle((prev) => (prev.trim() ? prev : fileName.replace(/\.[^/.]+$/, "")));
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      updateBlock(blockId, {
        isUploading: false,
        uploadError:
          errorObj.response?.data?.detail || "Media upload failed. Check format and size.",
      });
    }
  };

  // Handle direct URL input for media blocks
  const handleUrlInput = (blockId: string, url: string) => {
    const trimmed = url.trim();
    let cleanFileName = "";
    if (trimmed) {
      try {
        const u = new URL(trimmed);
        const segments = u.pathname.split("/").filter(Boolean);
        if (segments.length > 0) {
          cleanFileName = decodeURIComponent(segments[segments.length - 1]);
        }
      } catch {
        const segments = trimmed.split("/").filter(Boolean);
        if (segments.length > 0) {
          cleanFileName = decodeURIComponent(segments[segments.length - 1]);
        }
      }
      if (cleanFileName.includes("?")) {
        cleanFileName = cleanFileName.split("?")[0];
      }
    }

    updateBlock(blockId, {
      path: trimmed,
      text: cleanFileName,
      script: cleanFileName,
      uploadError: null,
    });

    if (cleanFileName) {
      const derivedTitle = cleanFileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
      if (derivedTitle) {
        setTitle((prev) => (prev.trim() ? prev : derivedTitle.charAt(0).toUpperCase() + derivedTitle.slice(1)));
      }
    }
  };

  // Save changes mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      setSaveSuccess(false);

      const details = blocks.map((b, idx) => {
        const fileNameFallback = b.path ? b.path.split("/").pop()?.split("?")[0] : undefined;
        return {
          type: b.type,
          path: b.path || undefined,
          text: b.type === "text" ? (b.text || undefined) : (b.text || fileNameFallback),
          script: b.type === "text" ? undefined : (b.script || b.text || fileNameFallback),
          order: idx + 1,
          mime_type: b.mime_type || undefined,
          file_size_bytes: b.file_size_bytes || undefined,
        };
      });

      const res = await apiClient.put(`/contents/${contentId}`, {
        title,
        status,
        details,
      });
      return res.data;
    },
    onSuccess: (updated) => {
      setSaveSuccess(true);
      queryClient.setQueryData(["content", contentId], updated);
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      setTimeout(() => setSaveSuccess(false), 2500);
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setSaveError(errorObj.response?.data?.detail || "Failed to save adjustments.");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/contents/${contentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      router.push("/contents");
    },
  });

  // Dispatch post mutation
  const dispatchMutation = useMutation({
    mutationFn: async ({
      platformId,
      isScheduled,
      scheduledAt,
    }: {
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
        setDispatchSuccess("All content items dispatched and published to Telegram successfully!");
      }
      setDispatchError(null);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      setTimeout(() => {
        setShowDispatchModal(false);
        setDispatchSuccess(null);
      }, 2000);
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setDispatchError(errorObj.response?.data?.detail || "Dispatch failed. Check platform credentials.");
    },
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/contents"
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight truncate max-w-md">
                Adjust: {title || "Untitled Content"}
              </h1>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Updated {formatDate(content.updated_at)} • {blocks.length} multimodal block(s)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Studio Link */}
          <Link
            href={`/studio/${content._id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 transition"
            title="Refine with AI Studio"
          >
            <Wand2 className="h-3.5 w-3.5 text-purple-400" />
            <span>AI Studio</span>
          </Link>

          {/* Dispatch Button */}
          <button
            type="button"
            onClick={() => setShowDispatchModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Dispatch</span>
          </button>

          {/* View Tab Toggle */}
          <div className="inline-flex rounded-xl bg-neutral-900 border border-neutral-800 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "edit"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Adjust
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "preview"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {/* Save Button */}
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-50 transition"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4 text-emerald-300" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>
              {saveMutation.isPending
                ? "Saving..."
                : saveSuccess
                ? "Saved!"
                : "Save Adjustments"}
            </span>
          </button>
        </div>
      </div>

      {saveError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Adjustments saved successfully.</span>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Content Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Product Highlights"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Current Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready (Ready to Publish)</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {activeTab === "edit" ? (
        /* Blocks Adjustment Section */
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Attached Multimodal Blocks</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-neutral-800 text-neutral-400 border border-neutral-700">
                {blocks.length}
              </span>
            </h2>

            {/* Add Block Options */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => addBlock("text")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
              >
                <Plus className="h-3.5 w-3.5 text-indigo-400" />
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                <span>Text Block</span>
              </button>
              <button
                type="button"
                onClick={() => addBlock("image")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
              >
                <Plus className="h-3.5 w-3.5 text-pink-400" />
                <ImageIcon className="h-3.5 w-3.5 text-pink-400" />
                <span>Image Asset</span>
              </button>
              <button
                type="button"
                onClick={() => addBlock("audio")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                <Mic className="h-3.5 w-3.5 text-emerald-400" />
                <span>Audio Track</span>
              </button>
              <button
                type="button"
                onClick={() => addBlock("video")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-400" />
                <Video className="h-3.5 w-3.5 text-cyan-400" />
                <span>Video Reel</span>
              </button>
            </div>
          </div>

          {/* Block Items */}
          <div className="space-y-4">
            {blocks.map((block, index) => {
              const isFirst = index === 0;
              const isLast = index === blocks.length - 1;

              return (
                <div
                  key={block.id}
                  className="rounded-2xl bg-neutral-900 border border-neutral-800 p-5 space-y-4 shadow-sm"
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg bg-neutral-800 text-neutral-400 text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      {block.type === "text" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                          <FileText className="h-4 w-4" /> Text / Copywriting Block
                        </span>
                      )}
                      {block.type === "image" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-400">
                          <ImageIcon className="h-4 w-4" /> Image Graphic Block
                        </span>
                      )}
                      {block.type === "audio" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <Mic className="h-4 w-4" /> Audio Voiceover Block
                        </span>
                      )}
                      {block.type === "video" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                          <Video className="h-4 w-4" /> Video Reel Block
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => moveBlock(index, "up")}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 rounded transition"
                        title="Move Up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => moveBlock(index, "down")}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 rounded transition"
                        title="Move Down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        className="p-1 text-neutral-500 hover:text-red-400 rounded transition ml-1"
                        title="Remove Block"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Block Content Adjustments */}
                  {block.type === "text" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1">
                          Copywriting / Caption Body
                        </label>
                        <textarea
                          rows={4}
                          value={block.text || ""}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                          placeholder="Adjust caption, headlines, hashtags..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/70 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {block.type === "image" && (
                    <div className="space-y-4">
                      {/* Source Selection Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="block text-xs font-medium text-neutral-300">
                          Image Source
                        </label>
                        <div className="inline-flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { sourceType: "upload" })}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                              block.sourceType !== "url"
                                ? "bg-neutral-800 text-white shadow-sm"
                                : "text-neutral-400 hover:text-neutral-200"
                            }`}
                          >
                            <UploadCloud className="h-3.5 w-3.5" />
                            <span>Upload File</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { sourceType: "url" })}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                              block.sourceType === "url"
                                ? "bg-neutral-800 text-white shadow-sm"
                                : "text-neutral-400 hover:text-neutral-200"
                            }`}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            <span>Web URL</span>
                          </button>
                        </div>
                      </div>

                      {block.sourceType === "url" ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                              <Link2 className="h-4 w-4" />
                            </div>
                            <input
                              type="url"
                              value={block.path || ""}
                              onChange={(e) => handleUrlInput(block.id, e.target.value)}
                              placeholder="https://example.com/images/sample.jpg"
                              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-850 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
                            />
                          </div>

                          {block.path && (
                            <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
                              <div className="w-full sm:w-48 h-32 relative rounded-lg overflow-hidden border border-neutral-700 bg-neutral-950 shrink-0">
                                <img
                                  src={getMediaUrl(block.path)}
                                  alt="Image URL preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="text-[11px] text-neutral-400 space-y-1">
                                <p className="text-pink-400 font-medium flex items-center gap-1.5">
                                  <Link2 className="h-3.5 w-3.5" /> Direct URL Linked
                                </p>
                                <p className="text-white font-medium break-all">{block.text || block.path}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            <label
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const f = e.dataTransfer.files?.[0];
                                if (f && !block.isUploading) handleUpload(block.id, f, "image");
                              }}
                              className="flex-1 w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-700 hover:border-pink-500/50 rounded-2xl bg-neutral-850/50 hover:bg-pink-500/5 cursor-pointer transition"
                            >
                              {block.isUploading ? (
                                <div className="flex items-center gap-2 text-xs text-pink-400">
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  <span>Uploading image & verifying magic bytes...</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center text-center">
                                  <UploadCloud className="h-6 w-6 text-pink-400 mb-1.5" />
                                  <span className="text-xs font-medium text-neutral-200">
                                    Click to upload image or drag & drop
                                  </span>
                                  <span className="text-[10px] text-neutral-400 mt-0.5">
                                    PNG, JPG, WEBP, GIF (Max 20MB) • Auto-checks binary signature
                                  </span>
                                </div>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={block.isUploading}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUpload(block.id, f, "image");
                                  e.target.value = "";
                                }}
                                className="hidden"
                              />
                            </label>

                            {/* Image Preview if uploaded */}
                            {block.path && (
                              <div className="w-full sm:w-48 h-32 relative rounded-xl overflow-hidden border border-neutral-700 bg-neutral-950 shrink-0">
                                <img
                                  src={getMediaUrl(block.path)}
                                  alt="Uploaded preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>

                          {block.uploadError && (
                            <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>{block.uploadError}</span>
                            </p>
                          )}

                          {block.path && (
                            <div className="mt-2 text-[11px] text-neutral-400 flex items-center gap-2">
                              <span className="text-emerald-400 font-medium">Uploaded:</span>
                              <span className="truncate max-w-xs text-white font-medium">{block.text || block.path.split("/").pop()}</span>
                              {block.file_size_bytes && (
                                <span>({formatBytes(block.file_size_bytes)})</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {block.type === "audio" && (
                    <div className="space-y-4">
                      {/* Source Selection Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="block text-xs font-medium text-neutral-300">
                          Audio Source
                        </label>
                        <div className="inline-flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { sourceType: "upload" })}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                              block.sourceType !== "url"
                                ? "bg-neutral-800 text-white shadow-sm"
                                : "text-neutral-400 hover:text-neutral-200"
                            }`}
                          >
                            <UploadCloud className="h-3.5 w-3.5" />
                            <span>Upload File</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { sourceType: "url" })}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                              block.sourceType === "url"
                                ? "bg-neutral-800 text-white shadow-sm"
                                : "text-neutral-400 hover:text-neutral-200"
                            }`}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            <span>Web URL</span>
                          </button>
                        </div>
                      </div>

                      {block.sourceType === "url" ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                              <Link2 className="h-4 w-4" />
                            </div>
                            <input
                              type="url"
                              value={block.path || ""}
                              onChange={(e) => handleUrlInput(block.id, e.target.value)}
                              placeholder="https://example.com/audio/podcast.mp3"
                              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-850 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                            />
                          </div>

                          {block.path && (
                            <div className="p-3 bg-neutral-800/60 border border-neutral-700/60 rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-neutral-300">
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-400 font-medium">Linked Track:</span>
                                  <span className="text-white font-medium truncate max-w-xs">{block.text || block.path.split("/").pop()}</span>
                                </div>
                              </div>
                              <audio
                                src={getMediaUrl(block.path)}
                                controls
                                className="w-full h-8"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const f = e.dataTransfer.files?.[0];
                              if (f && !block.isUploading) handleUpload(block.id, f, "audio");
                            }}
                            className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-700 hover:border-emerald-500/50 rounded-2xl bg-neutral-850/50 hover:bg-emerald-500/5 cursor-pointer transition"
                          >
                            {block.isUploading ? (
                              <div className="flex items-center gap-2 text-xs text-emerald-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>Uploading audio track...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-center">
                                <UploadCloud className="h-6 w-6 text-emerald-400 mb-1.5" />
                                <span className="text-xs font-medium text-neutral-200">
                                  Click to upload voiceover or podcast audio
                                </span>
                                <span className="text-[10px] text-neutral-400 mt-0.5">
                                  MP3, WAV, OGG, M4A (Max 50MB) • Supports direct audio playback
                                </span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="audio/*"
                              disabled={block.isUploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUpload(block.id, f, "audio");
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </label>

                          {block.uploadError && (
                            <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>{block.uploadError}</span>
                            </p>
                          )}

                          {block.path && (
                            <div className="mt-3 p-3 bg-neutral-800/60 border border-neutral-700/60 rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-neutral-300">
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-400 font-medium">Uploaded Track:</span>
                                  <span className="text-white font-medium truncate max-w-xs">{block.text || block.path.split("/").pop()}</span>
                                </div>
                                {block.file_size_bytes && <span>{formatBytes(block.file_size_bytes)}</span>}
                              </div>
                              <audio
                                src={getMediaUrl(block.path)}
                                controls
                                className="w-full h-8"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {block.type === "video" && (
                    <div className="space-y-4">
                      {/* Source Selection Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="block text-xs font-medium text-neutral-300">
                          Video Source
                        </label>
                        <div className="inline-flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { sourceType: "upload" })}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                              block.sourceType !== "url"
                                ? "bg-neutral-800 text-white shadow-sm"
                                : "text-neutral-400 hover:text-neutral-200"
                            }`}
                          >
                            <UploadCloud className="h-3.5 w-3.5" />
                            <span>Upload File</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { sourceType: "url" })}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                              block.sourceType === "url"
                                ? "bg-neutral-800 text-white shadow-sm"
                                : "text-neutral-400 hover:text-neutral-200"
                            }`}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            <span>Web URL</span>
                          </button>
                        </div>
                      </div>

                      {block.sourceType === "url" ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                              <Link2 className="h-4 w-4" />
                            </div>
                            <input
                              type="url"
                              value={block.path || ""}
                              onChange={(e) => handleUrlInput(block.id, e.target.value)}
                              placeholder="https://example.com/videos/promo.mp4"
                              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-850 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                            />
                          </div>

                          {block.path && (
                            <div className="mt-3 p-3 bg-neutral-800/60 border border-neutral-700/60 rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-neutral-300">
                                <div className="flex items-center gap-2">
                                  <span className="text-cyan-400 font-medium">Linked Video:</span>
                                  <span className="text-white font-medium truncate max-w-xs">{block.text || block.path.split("/").pop()}</span>
                                </div>
                              </div>
                              <video
                                src={getMediaUrl(block.path)}
                                controls
                                className="w-full rounded-lg aspect-video max-h-60 bg-black"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const f = e.dataTransfer.files?.[0];
                              if (f && !block.isUploading) handleUpload(block.id, f, "video");
                            }}
                            className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-700 hover:border-cyan-500/50 rounded-2xl bg-neutral-850/50 hover:bg-cyan-500/5 cursor-pointer transition"
                          >
                            {block.isUploading ? (
                              <div className="flex items-center gap-2 text-xs text-cyan-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>Uploading video reel...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-center">
                                <UploadCloud className="h-6 w-6 text-cyan-400 mb-1.5" />
                                <span className="text-xs font-medium text-neutral-200">
                                  Click to upload video reel or short
                                </span>
                                <span className="text-[10px] text-neutral-400 mt-0.5">
                                  MP4, MOV, WebM (Max 200MB) • Streamable container
                                </span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="video/*"
                              disabled={block.isUploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUpload(block.id, f, "video");
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </label>

                          {block.uploadError && (
                            <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>{block.uploadError}</span>
                            </p>
                          )}

                          {block.path && (
                            <div className="mt-3 p-3 bg-neutral-800/60 border border-neutral-700/60 rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-neutral-300">
                                <div className="flex items-center gap-2">
                                  <span className="text-cyan-400 font-medium">Uploaded Video:</span>
                                  <span className="text-white font-medium truncate max-w-xs">{block.text || block.path.split("/").pop()}</span>
                                </div>
                                {block.file_size_bytes && <span>{formatBytes(block.file_size_bytes)}</span>}
                              </div>
                              <video
                                src={getMediaUrl(block.path)}
                                controls
                                className="w-full rounded-lg aspect-video max-h-60 bg-black"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Delete Danger Zone */}
          <div className="pt-6 border-t border-neutral-800 flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-red-400">Delete this Content</p>
              <p className="text-[11px] text-neutral-500">
                Permanently archive this content and remove it from lists.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Are you sure you want to delete "${title}"?`)) {
                  deleteMutation.mutate();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Content</span>
            </button>
          </div>
        </div>
      ) : (
        /* Live Social Feed Preview */
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Eye className="h-4 w-4 text-indigo-400" />
            <span>Live Social Post Assembly Preview</span>
          </h2>

          <div className="max-w-md mx-auto bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                Y
              </div>
              <div>
                <p className="text-sm font-bold text-white">{title || "Untitled Content"}</p>
                <p className="text-[11px] text-neutral-400">Social Channel • {formatDate(content.created_at)}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {blocks.map((b) => {
                if (b.type === "text" && b.text) {
                  return (
                    <div key={b.id} className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
                      {b.text}
                    </div>
                  );
                }
                if (b.type === "image" && b.path) {
                  return (
                    <div key={b.id} className="rounded-xl overflow-hidden border border-neutral-800">
                      <img
                        src={getMediaUrl(b.path)}
                        alt={b.text || "Preview"}
                        className="w-full object-cover"
                      />
                    </div>
                  );
                }
                if (b.type === "audio" && b.path) {
                  return (
                    <div key={b.id} className="p-3 rounded-xl bg-neutral-800/80 border border-neutral-700/80 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                        <Mic className="h-3.5 w-3.5" />
                        <span>Voice Narration</span>
                      </div>
                      <audio src={getMediaUrl(b.path)} controls className="w-full h-8" />
                    </div>
                  );
                }
                if (b.type === "video" && b.path) {
                  return (
                    <div key={b.id} className="rounded-xl overflow-hidden border border-neutral-800 bg-black">
                      <video src={getMediaUrl(b.path)} controls className="w-full aspect-video" />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-400" />
                <span>Dispatch to Telegram</span>
              </h3>
              <button
                onClick={() => {
                  setShowDispatchModal(false);
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
              <p className="text-xs font-semibold text-white truncate">{title}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {blocks.map((d, i) => (
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
                All {blocks.length} content item(s) will be published in order to the destination.
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
                onClick={() => setShowDispatchModal(false)}
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
