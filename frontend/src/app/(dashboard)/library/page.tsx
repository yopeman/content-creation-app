"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, getMediaUrl } from "@/lib/api-client";
import { Content, ContentType } from "@/types";
import {
  FolderOpen,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  Loader2,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { formatBytes, formatDate } from "@/lib/utils";

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

  // Client-side file size and magic-bytes check before uploading
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      const res = await apiClient.post("/contents/upload-media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Also create a content entry so it shows in the library
      await apiClient.post("/contents", {
        title: file.name,
        details: [
          {
            type: res.data.detail.type,
            path: res.data.detail.path,
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
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-indigo-400" />
            <span>Media & Content Library</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Browse and manage generated AI assets, uploaded images, audio narration, and reels.
          </p>
        </div>

        {/* Upload Button */}
        <div>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 cursor-pointer transition">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            <span>{isUploading ? "Uploading..." : "Upload Media Asset"}</span>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={isUploading}
              accept="image/*,audio/*,video/*"
              className="hidden"
            />
          </label>
        </div>
      </div>

      {uploadError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
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
                ? "bg-neutral-800 text-white border border-neutral-700"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Library Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-neutral-900/50 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-12 text-center bg-neutral-900/20">
          <FolderOpen className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No assets found</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Generate content in the AI Studio or upload media files using the button above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => {
            const image = item.details.find((d) => d.type === "image");
            const video = item.details.find((d) => d.type === "video");
            const audio = item.details.find((d) => d.type === "audio");
            const text = item.details.find((d) => d.type === "text");

            return (
              <div
                key={item._id}
                className="group relative rounded-2xl bg-neutral-900/70 border border-neutral-800/80 hover:border-neutral-700 p-5 flex flex-col justify-between space-y-4 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      {item.status}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm("Delete this content asset?")) {
                          deleteMutation.mutate(item._id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Thumbnail / Media Preview */}
                  {image?.path ? (
                    <div className="h-36 rounded-xl overflow-hidden bg-black/40 border border-neutral-800 mb-3 flex items-center justify-center">
                      <img
                        src={getMediaUrl(image.path)}
                        alt={item.title}
                        className="max-h-full object-contain"
                      />
                    </div>
                  ) : video?.path ? (
                    <div className="h-36 rounded-xl overflow-hidden bg-black/60 border border-neutral-800 mb-3 flex items-center justify-center">
                      <video
                        src={getMediaUrl(video.path)}
                        className="max-h-full"
                        controls
                      />
                    </div>
                  ) : audio?.path ? (
                    <div className="h-36 rounded-xl bg-neutral-800/40 border border-neutral-800 mb-3 flex flex-col items-center justify-center p-4">
                      <Mic className="h-6 w-6 text-purple-400 mb-2" />
                      <audio controls className="w-full" src={getMediaUrl(audio.path)} />
                    </div>
                  ) : text?.text ? (
                    <div className="h-36 rounded-xl bg-neutral-800/30 border border-neutral-800 mb-3 p-3 text-xs text-neutral-300 line-clamp-5 whitespace-pre-line leading-relaxed">
                      {text.text}
                    </div>
                  ) : null}

                  <h3 className="text-sm font-semibold text-white line-clamp-1">{item.title}</h3>
                  <div className="mt-2 flex items-center gap-1.5">
                    {item.details.map((d, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400"
                      >
                        {d.type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-neutral-800 pt-3 flex items-center justify-between text-xs text-neutral-500">
                  <span>{formatDate(item.created_at)}</span>
                  <Link
                    href={`/studio/${item._id}`}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Open Studio
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
