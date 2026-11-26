"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, getMediaUrl } from "@/lib/api-client";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";
import { Content } from "@/types";
import {
  FolderOpen,
  UploadCloud,
  Mic,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const { data: contents = [], isLoading } = useQuery<Content[]>({
    queryKey: ["contents"],
    queryFn: async () => {
      const res = await apiClient.get<Content[]>("/contents");
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/contents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contents"] });
    },
  });

  // Client-side file size check before uploading
  const processUpload = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);

    // 1. File size pre-check (200MB max)
    const MAX_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError("File exceeds the 200MB upload limit.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiClient.post("/contents/upload-media", formData);

      const mediaPath = res.data.detail.url || res.data.detail.path;

      // Also create a content entry so it shows in the library
      await apiClient.post("/contents", {
        title: file.name,
        details: [
          {
            type: res.data.detail.type,
            path: mediaPath,
            order: 1,
            mime_type: res.data.detail.mime_type,
            file_size_bytes: res.data.detail.file_size_bytes,
          },
        ],
        status: "ready",
      });

      setUploadSuccess(`Successfully uploaded ${file.name}`);
      queryClient.invalidateQueries({ queryKey: ["contents"] });
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || "Upload failed. Please check file format.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUpload(file);
      e.target.value = "";
    }
  };

  const filtered = contents.filter((c) => {
    if (filterType === "all") return true;
    return c.details.some((d) => d.type === filterType);
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            <span>Media & Content Library</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Browse and manage generated AI assets, uploaded images, audio narration, and reels.
          </p>
        </div>

        {/* Upload Button */}
        <div>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file && !isUploading) processUpload(file);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 cursor-pointer transition"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            <span>{isUploading ? "Uploading..." : "Upload Media Asset"}</span>
            <input
              type="file"
              onChange={handleFileInputChange}
              disabled={isUploading}
              accept="image/*,audio/*,video/*"
              className="hidden"
            />
          </label>
        </div>
      </div>

      {uploadError && (
        <div className="p-3.5 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-3.5 rounded-xl bg-success-soft border border-success/20 text-success text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {[
          { id: "all", label: "All Items" },
          { id: "text", label: "Text Copy" },
          { id: "image", label: "Images" },
          { id: "audio", label: "Audio" },
          { id: "video", label: "Videos" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterType === tab.id
                ? "bg-surface-muted text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Library Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-surface/20">
          <FolderOpen className="h-10 w-10 text-subtle-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">No assets found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Generate content in the AI Studio or upload media files using the button above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filtered.map((item) => {
            const image = item.details.find((d) => d.type === "image");
            const video = item.details.find((d) => d.type === "video");
            const audio = item.details.find((d) => d.type === "audio");
            const text = item.details.find((d) => d.type === "text");

            return (
              <div
                key={item._id}
                className="group relative rounded-2xl bg-surface border border-border hover:border-border-strong p-5 flex flex-col justify-between space-y-4 transition shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {item.status}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm("Delete this content asset?")) {
                          deleteMutation.mutate(item._id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-danger rounded-lg hover:bg-surface-muted transition"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Thumbnail / Media Preview */}
                  {image?.path ? (
                    <div className="h-36 rounded-xl overflow-hidden bg-black/40 border border-border mb-3 flex items-center justify-center">
                      <img
                        src={getMediaUrl(image.path)}
                        alt={item.title}
                        className="max-h-full object-contain"
                      />
                    </div>
                  ) : video?.path ? (
                    <div className="h-36 rounded-xl overflow-hidden bg-black/60 border border-border mb-3 flex items-center justify-center">
                      <video
                        src={getMediaUrl(video.path)}
                        className="max-h-full"
                        controls
                      />
                    </div>
                  ) : audio?.path ? (
                    <div className="h-36 rounded-xl bg-surface-muted border border-border mb-3 flex flex-col items-center justify-center p-4">
                      <Mic className="h-6 w-6 text-purple-400 mb-2" />
                      <audio controls className="w-full" src={getMediaUrl(audio.path)} />
                    </div>
                  ) : text?.text ? (
                    <div className="h-36 rounded-xl bg-surface-muted border border-border mb-3 p-3 text-xs text-foreground line-clamp-5 whitespace-pre-line leading-relaxed">
                      {text.text}
                    </div>
                  ) : null}

                  <h3 className="text-sm font-semibold text-foreground line-clamp-1">{item.title}</h3>
                  <div className="mt-2 flex items-center gap-1.5">
                    {item.details.map((d, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-muted text-muted-foreground border border-border"
                      >
                        {d.type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDate(item.created_at)}</span>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/contents/${item._id}`}
                      className="text-primary hover:underline font-semibold"
                    >
                      Adjust Content
                    </Link>
                    <span className="text-subtle-foreground">•</span>
                    <Link
                      href={`/studio/${item._id}`}
                      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <span>Studio</span>
                      <ComingSoonBadge />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
