"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, getMediaUrl } from "@/lib/api-client";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";
import { Content, ContentType, Prompt } from "@/types";
import {
  ArrowLeft,
  Wand2,
  Sparkles,
  Loader2,
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  Copy,
  Check,
  History,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function StudioDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const contentId = params.id as string;

  const [instruction, setInstruction] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<ContentType[]>([
    "text",
    "image",
    "audio",
    "video",
  ]);
  const [copied, setCopied] = useState(false);

  // Fetch current content
  const { data: content, isLoading: loadingContent } = useQuery<Content>({
    queryKey: ["content", contentId],
    queryFn: async () => {
      const res = await apiClient.get<Content>(`/contents/${contentId}`);
      return res.data;
    },
    enabled: !!contentId,
  });

  // Fetch prompt chain history
  const { data: promptChain = [], isLoading: loadingChain } = useQuery<Prompt[]>({
    queryKey: ["prompt-chain", contentId],
    queryFn: async () => {
      const res = await apiClient.get<Prompt[]>(`/generations/${contentId}/chain`);
      return res.data;
    },
    enabled: !!contentId,
  });

  const toggleFormat = (fmt: ContentType) => {
    if (selectedFormats.includes(fmt)) {
      if (selectedFormats.length > 1) {
        setSelectedFormats(selectedFormats.filter((f) => f !== fmt));
      }
    } else {
      setSelectedFormats([...selectedFormats, fmt]);
    }
  };

  const handleCopy = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadingContent || !content) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
        Loading studio content...
      </div>
    );
  }

  const textDetail = content.details.find((d) => d.type === "text");
  const imageDetail = content.details.find((d) => d.type === "image");
  const audioDetail = content.details.find((d) => d.type === "audio");
  const videoDetail = content.details.find((d) => d.type === "video");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/studio"
            className="p-2 rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">{content.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground">Iterative AI Prompt Chaining Studio</p>
              <ComingSoonBadge />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/contents/${content._id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-soft hover:bg-primary/20 text-primary border border-primary-border text-xs font-semibold transition"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Adjust Manually</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Content Details & Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Copy Preview */}
          {textDetail && (
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Draft Copy</span>
                </span>
                <button
                  onClick={() => handleCopy(textDetail.text)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-muted hover:bg-surface text-xs text-foreground border border-border transition"
                >
                  {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {textDetail.text}
              </p>
            </div>
          )}

          {/* Media Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {imageDetail?.path && (
              <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                  <span>Graphic Banner</span>
                </span>
                <div className="rounded-lg overflow-hidden bg-black/40 border border-border flex items-center justify-center">
                  <img
                    src={getMediaUrl(imageDetail.path)}
                    alt="Graphic"
                    className="max-h-40 object-contain"
                  />
                </div>
              </div>
            )}

            {audioDetail?.path && (
              <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-purple-400" />
                  <span>Voiceover Audio</span>
                </span>
                <audio controls className="w-full mt-2" src={getMediaUrl(audioDetail.path)} />
              </div>
            )}

            {videoDetail?.path && (
              <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5 text-pink-400" />
                  <span>Reel Video</span>
                </span>
                <video controls className="w-full max-h-40 rounded bg-black" src={getMediaUrl(videoDetail.path)} />
              </div>
            )}
          </div>

          {/* Prompt Refinement Composer */}
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Prompt Chain Refinement</span>
            </h3>

            <textarea
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Make the text punchier, add 3 bullet points, and regenerate image and audio..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground placeholder-subtle-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                {(["text", "image", "audio", "video"] as ContentType[]).map((fmt) => {
                  const active = selectedFormats.includes(fmt);
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => toggleFormat(fmt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium uppercase transition ${
                        active
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-surface-muted text-muted-foreground hover:text-foreground border border-border"
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>

              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span>Refine Content</span>
                <ComingSoonBadge />
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Prompt Lineage Chain */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-purple-400" />
            <span>Prompt History Chain</span>
          </h3>

          {loadingChain ? (
            <div className="p-6 rounded-2xl bg-surface border border-border text-xs text-muted-foreground">
              Loading prompt history...
            </div>
          ) : promptChain.length === 0 ? (
            <div className="p-6 rounded-2xl bg-surface border border-border text-xs text-muted-foreground">
              No prompt history recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {promptChain.map((p, index) => (
                <div
                  key={p._id}
                  className="p-4 rounded-xl bg-surface border border-border text-xs space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-semibold text-primary">Turn #{index + 1}</span>
                    <span>{formatDate(p.created_at)}</span>
                  </div>
                  <p className="text-foreground font-medium">{p.prompt}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border pt-2 font-mono">
                    <span>{p.model}</span>
                    <span>
                      {p.tokens_in + p.tokens_out > 0
                        ? `${p.tokens_in} in / ${p.tokens_out} out`
                        : "Done"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
