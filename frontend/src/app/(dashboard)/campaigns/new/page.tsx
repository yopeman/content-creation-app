"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Wand2, Sparkles, Plus, Loader2, ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

const PRESET_COLORS = [
  "#6366F1", // Indigo
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
];

export default function NewCampaignPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [idea, setIdea] = useState("");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [numberOfContent, setNumberOfContent] = useState(3);
  const [colorHashCode, setColorHashCode] = useState("#6366F1");
  const [generateContents, setGenerateContents] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "ai") {
        const resp = await apiClient.post("/generations/campaign", {
          idea,
          title: title || undefined,
          goal: goal || undefined,
          context: context || undefined,
          number_of_content: numberOfContent,
          color_hash_code: colorHashCode,
          generate_contents: generateContents,
        });
        router.push(`/campaigns/${resp.data._id}`);
      } else {
        const resp = await apiClient.post("/campaigns", {
          idea,
          title: title || undefined,
          goal: goal || undefined,
          context: context || undefined,
          number_of_content: numberOfContent,
          color_hash_code: colorHashCode,
          plans: Array.from({ length: numberOfContent }).map((_, i) => ({
            order: i + 1,
            idea: `${idea} - Part ${i + 1}`,
            formats: ["text", "image"],
          })),
        });
        router.push(`/campaigns/${resp.data._id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create campaign. Please check inputs.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/campaigns"
          className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Campaign</h1>
          <p className="text-xs text-neutral-400">Launch a multi-content social campaign</p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-neutral-900 border border-neutral-800 rounded-2xl">
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition ${
            mode === "ai"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <Wand2 className="h-4 w-4" />
          <span>AI Generated Campaign</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition ${
            mode === "manual"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <Plus className="h-4 w-4" />
          <span>Manual Editorial Plan</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
            Core Campaign Idea / Theme <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. 5 AI workflows every frontend engineer needs in 2026..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Campaign Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AI Engineering Sprint"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Target Number of Posts
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={numberOfContent}
              onChange={(e) => setNumberOfContent(parseInt(e.target.value) || 3)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
            Campaign Goal (Optional)
          </label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Drive 200 signups to developer newsletter"
            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
            Context / Target Audience (Optional)
          </label>
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. Senior engineers, cloud architects, React builders"
            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        {/* Color Palette Selector */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300 mb-2">
            Campaign Brand Color
          </label>
          <div className="flex items-center gap-3">
            {PRESET_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setColorHashCode(col)}
                className="h-7 w-7 rounded-full flex items-center justify-center transition shadow-sm"
                style={{ backgroundColor: col }}
              >
                {colorHashCode === col && <Check className="h-4 w-4 text-white stroke-[3]" />}
              </button>
            ))}
            <input
              type="color"
              value={colorHashCode}
              onChange={(e) => setColorHashCode(e.target.value)}
              className="h-7 w-7 rounded-full bg-transparent border-none cursor-pointer"
            />
          </div>
        </div>

        {mode === "ai" && (
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Autonomous Generation Loop</span>
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Automatically generate text, images, and audio/video for all plans in one execution.
              </p>
            </div>
            <input
              type="checkbox"
              checked={generateContents}
              onChange={(e) => setGenerateContents(e.target.checked)}
              className="h-4 w-4 rounded bg-neutral-800 border-neutral-700 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{mode === "ai" ? "Generating Campaign with AI..." : "Creating Campaign..."}</span>
            </>
          ) : (
            <>
              {mode === "ai" ? <Wand2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{mode === "ai" ? "Generate Campaign with AI" : "Create Campaign"}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
