"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient, getMediaUrl } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";
import { QuickStartWizardModal } from "@/components/onboarding/quick-start-wizard-modal";
import {
  ClaimTicketResponse,
  Content,
  ContentDetail,
  ContentStatus,
  ContentType,
  OnboardingStatus,
  Platform,
} from "@/types";
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
  return (
    <Suspense
      fallback={
        <div className="h-64 flex flex-col items-center justify-center text-subtle-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2 text-primary" />
          <span className="text-xs">Loading content...</span>
        </div>
      }
    >
      <ContentAdjusterInner />
    </Suspense>
  );
}

function ContentAdjusterInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const contentId = params.id as string;
  const claimToken = searchParams.get("claim_token");
  const { setAuth } = useAuthStore();
  const queryClient = useQueryClient();

  const [claimLoading, setClaimLoading] = useState(Boolean(claimToken));
  const [claimError, setClaimError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);

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
        queryClient.invalidateQueries({ queryKey: ["content", contentId] });
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
  }, [claimToken, contentId, queryClient, setAuth]);

  // 1. Fetch content
  const { data: content, isLoading: loadingContent } = useQuery<Content>({
    queryKey: ["content", contentId],
    queryFn: async () => {
      const res = await apiClient.get<Content>(`/contents/${contentId}`);
      return res.data;
    },
    enabled: !!contentId && !claimLoading,
  });

  // 2. Fetch platforms for dispatch modal
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
        <span className="text-xs font-medium">Claiming access ticket & loading your content...</span>
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

  if (loadingContent || !content) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-subtle-foreground">
        <Loader2 className="h-6 w-6 animate-spin mb-2" />
        <span className="text-xs">Loading content details...</span>
      </div>
    );
  }

  return (
    <ContentAdjusterForm
      key={content._id}
      content={content}
      platforms={platforms}
      initialOnboarding={onboarding}
    />
  );
}

function ContentAdjusterForm({
  content,
  platforms,
  initialOnboarding,
}: {
  content: Content;
  platforms: Platform[];
  initialOnboarding?: OnboardingStatus | null;
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
  const [onboardingSuccessToast, setOnboardingSuccessToast] = useState<string | null>(null);

  // Dispatch modal state
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [isScheduledMode, setIsScheduledMode] = useState<boolean>(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>("");
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  const togglePlatform = (id: string) => {
    setSelectedPlatformIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

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
      platformIds,
      isScheduled,
      scheduledAt,
    }: {
      platformIds: string[];
      isScheduled: boolean;
      scheduledAt?: string;
    }) => {
      const selectedPlatforms = platforms.filter((p) => platformIds.includes(p._id));
      const res = await apiClient.post("/posts", {
        content_id: contentId,
        status: isScheduled ? "scheduled" : "published",
        scheduled_at: isScheduled ? scheduledAt : undefined,
        targets: selectedPlatforms.map((p) => ({
          platform_id: p._id,
          platform_code: p.code,
          scheduled_at: isScheduled ? scheduledAt : undefined,
        })),
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.status === "scheduled") {
        setDispatchSuccess("Post scheduled! Background worker will automatically dispatch it at the chosen time.");
      } else if (data.status === "partial") {
        setDispatchSuccess("Post partially dispatched. Some channels published while others failed.");
      } else {
        const targetCount = data.targets?.length || 1;
        setDispatchSuccess(
          `All content items dispatched and published to ${targetCount} channel(s) successfully!`
        );
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
            className="p-2 rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight truncate max-w-md">
                Adjust: {title || "Untitled Content"}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Updated {formatDate(content.updated_at)} • {blocks.length} multimodal block(s)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Studio Link */}
          <Link
            href={`/studio/${content._id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
            title="Refine with AI Studio"
          >
            <Wand2 className="h-3.5 w-3.5 text-purple-400" />
            <span>AI Studio</span>
            <ComingSoonBadge />
          </Link>

          {/* Dispatch Button */}
          <button
            type="button"
            onClick={() => {
              const connected = platforms.filter((p) => p.status === "connected");
              setSelectedPlatformIds(
                connected.length > 0
                  ? [connected[0]._id]
                  : platforms[0]
                  ? [platforms[0]._id]
                  : []
              );
              setIsScheduledMode(false);
              setScheduledDateTime("");
              setDispatchError(null);
              setDispatchSuccess(null);
              setShowDispatchModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-soft hover:bg-primary/20 text-primary border border-primary-border text-xs font-medium transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Dispatch</span>
          </button>

          {/* View Tab Toggle */}
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
              Adjust
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

          {/* Save Button */}
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 disabled:opacity-50 transition"
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
        <div className="p-3.5 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-center gap-2">
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

      {onboardingSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{onboardingSuccessToast}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Content Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Product Highlights"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Current Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
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
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Attached Multimodal Blocks</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-surface-muted text-muted-foreground border border-border">
                {blocks.length}
              </span>
            </h2>

            {/* Add Block Options */}
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

          {/* Block Items */}
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
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded transition"
                        title="Move Up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => moveBlock(index, "down")}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded transition"
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

                  {/* Block Content Adjustments */}
                  {block.type === "text" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                          Copywriting / Caption Body
                        </label>
                        <textarea
                          rows={15}
                          value={block.text || ""}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                          placeholder="Adjust caption, headlines, hashtags..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground placeholder-subtle-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
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

          {/* Delete Danger Zone */}
          <div className="pt-6 border-t border-border flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-danger">Delete this Content</p>
              <p className="text-[11px] text-subtle-foreground">
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-danger-soft hover:bg-red-500/20 text-danger border border-danger/20 text-xs font-semibold transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Content</span>
            </button>
          </div>
        </div>
      ) : (
        /* Live Social Feed Preview */
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span>Live Social Post Assembly Preview</span>
          </h2>

          <div className="max-w-md mx-auto bg-surface border border-border rounded-3xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-foreground font-bold text-sm">
                Y
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{title || "Untitled Content"}</p>
                <p className="text-[11px] text-muted-foreground">Social Channel • {formatDate(content.created_at)}</p>
              </div>
            </div>

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

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                <span>Dispatch to Telegram</span>
              </h3>
              <button
                onClick={() => {
                  setShowDispatchModal(false);
                  setDispatchError(null);
                  setDispatchSuccess(null);
                }}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Close
              </button>
            </div>

            {/* Content summary and items list */}
            <div className="p-3.5 rounded-xl bg-surface-muted/50 border border-border space-y-2">
              <p className="text-xs font-semibold text-foreground truncate">{title}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {blocks.map((d, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-foreground border border-border"
                  >
                    {d.type === "text" && <FileText className="h-3 w-3 text-primary" />}
                    {d.type === "image" && <ImageIcon className="h-3 w-3 text-pink-400" />}
                    {d.type === "audio" && <Mic className="h-3 w-3 text-emerald-400" />}
                    {d.type === "video" && <Video className="h-3 w-3 text-cyan-400" />}
                    <span className="capitalize">{d.type}</span>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                All {blocks.length} content item(s) will be published in order to the destination.
              </p>
            </div>

            {/* Mode Toggle: Direct vs Scheduled */}
            <div className="grid grid-cols-2 p-1 bg-surface-muted rounded-xl border border-border text-xs font-medium">
              <button
                type="button"
                onClick={() => setIsScheduledMode(false)}
                className={`py-1.5 rounded-lg transition text-center ${
                  !isScheduledMode
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
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
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Schedule for Later
              </button>
            </div>

            {/* Date Time Picker for Scheduling */}
            {isScheduledMode && (
              <div className="space-y-1.5 p-3 rounded-xl bg-surface-muted border border-border">
                <label className="block text-xs font-medium text-foreground">
                  Select Scheduled Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-muted border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  The background worker will automatically dispatch this post when the scheduled time arrives.
                </p>
              </div>
            )}

            {dispatchError && (
              <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-center gap-2">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-foreground">
                  Select Destination Channel(s)
                </label>
                {platforms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPlatformIds.length === platforms.length) {
                        setSelectedPlatformIds([]);
                      } else {
                        setSelectedPlatformIds(platforms.map((p) => p._id));
                      }
                    }}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    {selectedPlatformIds.length === platforms.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {platforms.length === 0 ? (
                <div className="text-xs text-muted-foreground p-3 bg-surface-muted rounded-xl border border-border">
                  No platforms connected.{" "}
                  <Link href="/settings/platforms" className="text-primary underline">
                    Connect Telegram bot now
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {platforms.map((p) => {
                    const isSelected = selectedPlatformIds.includes(p._id);
                    return (
                      <button
                        key={p._id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => togglePlatform(p._id)}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-primary-soft border-primary-border text-foreground"
                            : "bg-surface-muted border-border text-foreground hover:border-border-strong"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                              {p.code}
                            </span>
                            <span className="text-xs font-medium truncate">
                              {p.account_name || p.platform_account_id || p.code}
                            </span>
                          </div>
                          {p.platform_account_id && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {p.platform_account_id}
                            </p>
                          )}
                        </div>
                        <span
                          className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border bg-surface"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs text-foreground hover:bg-surface-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  platforms.length === 0 ||
                  selectedPlatformIds.length === 0 ||
                  dispatchMutation.isPending ||
                  (isScheduledMode && !scheduledDateTime)
                }
                onClick={() => {
                  if (selectedPlatformIds.length > 0) {
                    dispatchMutation.mutate({
                      platformIds: selectedPlatformIds,
                      isScheduled: isScheduledMode,
                      scheduledAt:
                        isScheduledMode && scheduledDateTime
                          ? new Date(scheduledDateTime).toISOString()
                          : undefined,
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md disabled:opacity-50 transition"
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
                    ? `Schedule Post (${selectedPlatformIds.length})`
                    : selectedPlatformIds.length > 1
                    ? `Publish to ${selectedPlatformIds.length} Channels Now`
                    : "Publish All Items Now"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick-Start Onboarding Wizard Modal */}
      {initialOnboarding && (
        <QuickStartWizardModal
          initialOnboarding={initialOnboarding}
          hasPlatforms={platforms.length > 0}
          destinationLabel="Open Content"
          onSuccess={() => {
            setOnboardingSuccessToast("Telegram channel connected! Your content is ready to dispatch.");
            setTimeout(() => setOnboardingSuccessToast(null), 4000);
          }}
        />
      )}
    </div>
  );
}
