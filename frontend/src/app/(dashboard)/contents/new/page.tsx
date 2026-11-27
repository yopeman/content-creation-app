"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient, getMediaUrl } from "@/lib/api-client";
import { ContentDetail, ContentStatus, ContentType } from "@/types";
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
  Save,
  Link2,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface EditableBlock extends ContentDetail {
  id: string; // local temporary UI identifier
  isUploading?: boolean;
  uploadError?: string | null;
  sourceType?: "upload" | "url";
}

export default function NewContentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ContentStatus>("ready");
  const [blocks, setBlocks] = useState<EditableBlock[]>([
    {
      id: "block-1",
      type: "text",
      text: "",
      order: 1,
    },
  ]);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);

  // Helper to add a new block
  const addBlock = (type: ContentType) => {
    const newBlock: EditableBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      text: "",
      order: blocks.length + 1,
    };
    setBlocks([...blocks, newBlock]);
  };

  // Helper to remove a block
  const removeBlock = (id: string) => {
    if (blocks.length <= 1) {
      alert("At least one content block is required.");
      return;
    }
    const updated = blocks
      .filter((b) => b.id !== id)
      .map((b, idx) => ({ ...b, order: idx + 1 }));
    setBlocks(updated);
  };

  // Move block up or down
  const moveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;

    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;

    // re-assign order numbers
    setBlocks(newBlocks.map((b, idx) => ({ ...b, order: idx + 1 })));
  };

  // Update block fields
  const updateBlock = (id: string, updates: Partial<EditableBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  // Handle file upload for media blocks
  const handleUpload = async (blockId: string, file: File, expectedType: ContentType) => {
    updateBlock(blockId, { isUploading: true, uploadError: null });

    // Size checks based on type
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

  // Submit Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error("Content title is required.");
      }

      // Format payload details: media script & text are filled by file name
      const details = blocks.map((b, idx) => {
        const fileNameFallback = b.path ? b.path.split("/").pop() : undefined;
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

      const res = await apiClient.post("/contents", {
        title,
        status,
        details,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      router.push(`/contents/${data._id}`);
    },
    onError: (err: unknown) => {
      const errorObj = err as { message?: string; response?: { data?: { detail?: string } } };
      setError(errorObj.message || errorObj.response?.data?.detail || "Failed to create content.");
    },
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/contents"
            className="p-2 rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Create Manual Content
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Draft text copy, upload images, audio, or video, and adjust every parameter manually.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-surface border border-border p-1">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "edit"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "preview"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 disabled:opacity-50 transition"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{createMutation.isPending ? "Saving..." : "Save Content"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form Fields */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Title */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Content Title <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Promo Launch: 30% Off Announcement"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground placeholder-subtle-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
            >
              <option value="draft">Draft (In progress)</option>
              <option value="ready">Ready (Ready to publish)</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {activeTab === "edit" ? (
        /* Block Editor View */
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Multimodal Content Blocks</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-surface-muted text-muted-foreground border border-border">
                {blocks.length}
              </span>
            </h2>

            {/* Quick Add Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => addBlock("text")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Text Block</span>
              </button>
              <button
                type="button"
                onClick={() => addBlock("image")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
              >
                <Plus className="h-3.5 w-3.5 text-pink-400" />
                <ImageIcon className="h-3.5 w-3.5 text-pink-400" />
                <span>Image Asset</span>
              </button>
              <button
                type="button"
                onClick={() => addBlock("audio")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                <Mic className="h-3.5 w-3.5 text-emerald-400" />
                <span>Audio Track</span>
              </button>
              <button
                type="button"
                onClick={() => addBlock("video")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-400" />
                <Video className="h-3.5 w-3.5 text-cyan-400" />
                <span>Video Reel</span>
              </button>
            </div>
          </div>

          {/* Blocks List */}
          <div className="space-y-4">
            {blocks.map((block, index) => {
              const isFirst = index === 0;
              const isLast = index === blocks.length - 1;

              return (
                <div
                  key={block.id}
                  className="rounded-2xl bg-surface border border-border p-5 space-y-4 shadow-sm"
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg bg-surface-muted text-muted-foreground text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      {block.type === "text" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <FileText className="h-4 w-4" /> Text / Copywriting Block
                        </span>
                      )}
                      {block.type === "image" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-400">
                          <ImageIcon className="h-4 w-4" /> Image Media Asset
                        </span>
                      )}
                      {block.type === "audio" && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <Mic className="h-4 w-4" /> Audio Narration Block
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
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground rounded transition"
                        title="Move Up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => moveBlock(index, "down")}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground rounded transition"
                        title="Move Down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        className="p-1 text-subtle-foreground hover:text-danger rounded transition ml-1"
                        title="Remove Block"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Block Content Inputs */}
                  {block.type === "text" && (
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Social Post Text / Caption Body
                      </label>
                      <textarea
                        rows={15}
                        value={block.text || ""}
                        onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                        placeholder="Write your engaging caption, hashtags, and announcement copy here..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground placeholder-subtle-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}

                  {block.type === "image" && (
                    <div className="space-y-4">
                      {/* Source Selection Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="block text-xs font-medium text-foreground">
                          Image Source
                        </label>
                        <div className="inline-flex rounded-lg bg-surface border border-border p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { sourceType: "upload" })}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                              block.sourceType !== "url"
                                ? "bg-surface-muted text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
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
                                ? "bg-surface-muted text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
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
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                              <Link2 className="h-4 w-4" />
                            </div>
                            <input
                              type="url"
                              value={block.path || ""}
                              onChange={(e) => handleUrlInput(block.id, e.target.value)}
                              placeholder="https://example.com/images/sample.jpg"
                              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground placeholder-subtle-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
                            />
                          </div>

                          {block.path && (
                            <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-surface/80 border border-border rounded-xl">
                              <div className="w-full sm:w-48 h-32 relative rounded-lg overflow-hidden border border-border bg-background shrink-0">
                                <img
                                  src={getMediaUrl(block.path)}
                                  alt="Image URL preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="text-[11px] text-muted-foreground space-y-1">
                                <p className="text-pink-400 font-medium flex items-center gap-1.5">
                                  <Link2 className="h-3.5 w-3.5" /> Direct URL Linked
                                </p>
                                <p className="text-foreground font-medium break-all">{block.text || block.path}</p>
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
                              className="flex-1 w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-border hover:border-pink-500 rounded-2xl bg-surface-muted/50 hover:bg-pink-500/5 cursor-pointer transition"
                            >
                              {block.isUploading ? (
                                <div className="flex items-center gap-2 text-xs text-pink-400">
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  <span>Uploading image & verifying magic bytes...</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center text-center">
                                  <UploadCloud className="h-6 w-6 text-pink-400 mb-1.5" />
                                  <span className="text-xs font-medium text-foreground">
                                    Click to upload image or drag & drop
                                  </span>
                                  <span className="text-[10px] text-muted-foreground mt-0.5">
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
                              <div className="w-full sm:w-48 h-32 relative rounded-xl overflow-hidden border border-border bg-background shrink-0">
                                <img
                                  src={getMediaUrl(block.path)}
                                  alt="Uploaded preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>

                          {block.uploadError && (
                            <p className="text-xs text-danger mt-2 flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>{block.uploadError}</span>
                            </p>
                          )}

                          {block.path && (
                            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-2">
                              <span className="text-emerald-400 font-medium">Uploaded:</span>
                              <span className="truncate max-w-xs text-foreground font-medium">{block.text || block.path.split("/").pop()}</span>
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
                        <label className="block text-xs font-medium text-foreground">
                          Audio Source
                        </label>
                        <div className="inline-flex rounded-lg bg-surface border border-border p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { sourceType: "upload" })}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                              block.sourceType !== "url"
                                ? "bg-surface-muted text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
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
                                ? "bg-surface-muted text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
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
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                              <Link2 className="h-4 w-4" />
                            </div>
                            <input
                              type="url"
                              value={block.path || ""}
                              onChange={(e) => handleUrlInput(block.id, e.target.value)}
                              placeholder="https://example.com/audio/podcast.mp3"
                              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground placeholder-subtle-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                            />
                          </div>

                          {block.path && (
                            <div className="p-3 bg-surface-muted border border-border rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-foreground">
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-400 font-medium">Linked Track:</span>
                                  <span className="text-foreground font-medium truncate max-w-xs">{block.text || block.path.split("/").pop()}</span>
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
                            className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-border hover:border-emerald-500 rounded-2xl bg-surface-muted/50 hover:bg-emerald-500/5 cursor-pointer transition"
                          >
                            {block.isUploading ? (
                              <div className="flex items-center gap-2 text-xs text-emerald-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>Uploading audio track...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-center">
                                <UploadCloud className="h-6 w-6 text-emerald-400 mb-1.5" />
                                <span className="text-xs font-medium text-foreground">
                                  Click to upload voiceover or podcast audio
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
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
                            <p className="text-xs text-danger mt-2 flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>{block.uploadError}</span>
                            </p>
                          )}

                          {block.path && (
                            <div className="mt-3 p-3 bg-surface-muted border border-border rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-foreground">
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-400 font-medium">Uploaded Track:</span>
                                  <span className="text-foreground font-medium truncate max-w-xs">{block.text || block.path.split("/").pop()}</span>
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
                        <label className="block text-xs font-medium text-foreground">
                          Video Source
                        </label>
                        <div className="inline-flex rounded-lg bg-surface border border-border p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { sourceType: "upload" })}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition ${
                              block.sourceType !== "url"
                                ? "bg-surface-muted text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
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
                                ? "bg-surface-muted text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
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
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                              <Link2 className="h-4 w-4" />
                            </div>
                            <input
                              type="url"
                              value={block.path || ""}
                              onChange={(e) => handleUrlInput(block.id, e.target.value)}
                              placeholder="https://example.com/videos/promo.mp4"
                              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground placeholder-subtle-foreground text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                            />
                          </div>

                          {block.path && (
                            <div className="mt-3 p-3 bg-surface-muted border border-border rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-foreground">
                                <div className="flex items-center gap-2">
                                  <span className="text-cyan-400 font-medium">Linked Video:</span>
                                  <span className="text-foreground font-medium truncate max-w-xs">{block.text || block.path.split("/").pop()}</span>
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
                            className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-border hover:border-cyan-500 rounded-2xl bg-surface-muted/50 hover:bg-cyan-500/5 cursor-pointer transition"
                          >
                            {block.isUploading ? (
                              <div className="flex items-center gap-2 text-xs text-cyan-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>Uploading video reel...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center text-center">
                                <UploadCloud className="h-6 w-6 text-cyan-400 mb-1.5" />
                                <span className="text-xs font-medium text-foreground">
                                  Click to upload video reel or short
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
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
                            <p className="text-xs text-danger mt-2 flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>{block.uploadError}</span>
                            </p>
                          )}

                          {block.path && (
                            <div className="mt-3 p-3 bg-surface-muted border border-border rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-foreground">
                                <div className="flex items-center gap-2">
                                  <span className="text-cyan-400 font-medium">Uploaded Video:</span>
                                  <span className="text-foreground font-medium truncate max-w-xs">{block.text || block.path.split("/").pop()}</span>
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
        </div>
      ) : (
        /* Live Social Feed Preview View */
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span>Live Social Post Assembly Preview</span>
          </h2>

          <div className="max-w-md mx-auto bg-surface border border-border rounded-3xl overflow-hidden shadow-2xl p-5 space-y-4">
            {/* Header / Brand */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-foreground font-bold text-sm">
                Y
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{title || "Untitled Content"}</p>
                <p className="text-[11px] text-muted-foreground">Social Channel • Just now</p>
              </div>
            </div>

            {/* Assembled Blocks in Order */}
            <div className="space-y-3 pt-2">
              {blocks.map((b) => {
                if (b.type === "text" && b.text) {
                  return (
                    <div key={b.id} className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {b.text}
                    </div>
                  );
                }
                if (b.type === "image" && b.path) {
                  return (
                    <div key={b.id} className="rounded-xl overflow-hidden border border-border">
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
                    <div key={b.id} className="p-3 rounded-xl bg-surface-muted border border-border space-y-1.5">
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
                    <div key={b.id} className="rounded-xl overflow-hidden border border-border bg-black">
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
    </div>
  );
}
