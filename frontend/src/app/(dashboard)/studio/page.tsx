"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, getMediaUrl } from "@/lib/api-client";
import { Campaign, Content, ContentType } from "@/types";
import {
  Wand2,
  Sparkles,
  Loader2,
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  Copy,
  Check,
  Send,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function StudioPage() {
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [formats, setFormats] = useState<ContentType[]>([
    "text",
    "image",
    "audio",
    "video",
  ]);
  const [generatedContent, setGeneratedContent] = useState<Content | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await apiClient.get<Campaign[]>("/campaigns");
      return res.data;
    },
  });

  const toggleFormat = (fmt: ContentType) => {
    if (formats.includes(fmt)) {
      if (formats.length > 1) {
        setFormats(formats.filter((f) => f !== fmt));
      }
    } else {
      setFormats([...formats, fmt]);
    }
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<Content>("/generations", {
        prompt,
        title: title || undefined,
        campaign_id: selectedCampaignId || undefined,
        formats,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setGeneratedContent(data);
    },
  });

  const handleCopyText = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const textDetail = generatedContent?.details.find((d) => d.type === "text");
  const imageDetail = generatedContent?.details.find((d) => d.type === "image");
  const audioDetail = generatedContent?.details.find((d) => d.type === "audio");
  const videoDetail = generatedContent?.details.find((d) => d.type === "video");

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Studio Banner */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-purple-400" />
          <span>Multi-Modal AI Studio</span>
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Generate complete social content packages across Text, Graphics, Audio, and Video.
        </p>
      </div>

      {/* Main Generator Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div>
          <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
            Content Topic or Prompt <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Write a high-converting announcement for our new AI feature with bullet points..."
            className="w-full px-4 py-3 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Next-Gen AI Feature Launch"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Link to Campaign (Optional)
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="">No Campaign (Standalone)</option>
              {campaigns.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title || c.idea}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modality Toggles */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300 mb-2">
            Target Modalities to Generate
          </label>
          <div className="flex flex-wrap gap-2.5">
            {[
              { type: "text" as ContentType, label: "Text Copy", icon: FileText },
              { type: "image" as ContentType, label: "Banner Image", icon: ImageIcon },
              { type: "audio" as ContentType, label: "Voiceover Audio", icon: Mic },
              { type: "video" as ContentType, label: "Reel Video", icon: Video },
            ].map(({ type, label, icon: Icon }) => {
              const active = formats.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleFormat(type)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                      : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white hover:bg-neutral-700/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={() => generateMutation.mutate()}
          disabled={!prompt.trim() || generateMutation.isPending}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Orchestrating AI Generation Agent...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Generate Multi-Modal Assets</span>
            </>
          )}
        </button>
      </div>

      {/* Generated Content Preview Area */}
      {generatedContent && (
        <div className="space-y-6 pt-4 border-t border-neutral-800 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{generatedContent.title}</h2>
              <span className="text-xs text-emerald-400 font-medium">
                ● Generated & Saved to Content Library
              </span>
            </div>

            <Link
              href={`/studio/${generatedContent._id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-white transition"
            >
              <span>Refine in Prompt Chain Studio</span>
              <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Text Copy */}
            {textDetail && (
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                    <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-indigo-400" />
                      <span>Post Copy</span>
                    </span>
                    <button
                      onClick={() => handleCopyText(textDetail.text)}
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copied ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="text-sm text-neutral-200 whitespace-pre-line mt-3 leading-relaxed">
                    {textDetail.text}
                  </p>
                </div>
              </div>
            )}

            {/* 2. Image Asset */}
            {imageDetail && imageDetail.path && (
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                  <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-indigo-400" />
                    <span>Graphic Banner</span>
                  </span>
                  <a
                    href={getMediaUrl(imageDetail.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>Full size</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="rounded-xl overflow-hidden border border-neutral-800 bg-black/40 flex items-center justify-center max-h-72">
                  <img
                    src={getMediaUrl(imageDetail.path)}
                    alt={imageDetail.script || "Generated Banner"}
                    className="max-h-72 object-contain"
                  />
                </div>
              </div>
            )}

            {/* 3. Audio Narration */}
            {audioDetail && audioDetail.path && (
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                  <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Mic className="h-4 w-4 text-purple-400" />
                    <span>Voiceover Narration</span>
                  </span>
                  <span className="text-[10px] text-neutral-500 uppercase font-mono">MP3</span>
                </div>
                <audio controls className="w-full mt-2" src={getMediaUrl(audioDetail.path)} />
                <p className="text-[11px] text-neutral-400 italic mt-1 line-clamp-2">
                  &ldquo;{audioDetail.script}&rdquo;
                </p>
              </div>
            )}

            {/* 4. Video Reel */}
            {videoDetail && videoDetail.path && (
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                  <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Video className="h-4 w-4 text-pink-400" />
                    <span>Reel Video (9:16)</span>
                  </span>
                  <span className="text-[10px] text-neutral-500 uppercase font-mono">MP4</span>
                </div>
                <div className="rounded-xl overflow-hidden bg-black/60 flex items-center justify-center max-h-80">
                  <video
                    controls
                    className="max-h-80 w-auto rounded-lg shadow-md"
                    src={getMediaUrl(videoDetail.path)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
