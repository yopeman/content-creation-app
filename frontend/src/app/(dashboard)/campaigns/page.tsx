"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Campaign } from "@/types";
import {
  CalendarDays,
  Plus,
  Wand2,
  Trash2,
  ArrowRight,
  Sparkles,
  Layers,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await apiClient.get<Campaign[]>("/campaigns");
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const filtered = campaigns.filter((c) => {
    if (filterStatus === "all") return true;
    return c.status === filterStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Editorial Campaigns</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Organize multi-content marketing campaigns, brand initiatives, and social schedules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create Campaign</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        {["all", "draft", "ready", "scheduled", "done"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
              filterStatus === status
                ? "bg-neutral-800 text-white border border-neutral-700"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Campaign Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-neutral-900/50 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-12 text-center bg-neutral-900/20">
          <CalendarDays className="h-10 w-10 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No campaigns found</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Get started by creating a new campaign manually or with our multi-modal AI generation wizard.
          </p>
          <Link
            href="/campaigns/new"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Plan First Campaign</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((campaign) => {
            const color =
              campaign.color_hash_code ||
              campaign.color_has_code ||
              campaign.color_hex_code ||
              "#6366F1";
            const planCount = campaign.plans?.length || 0;
            const readyCount =
              campaign.plans?.filter((p) => p.status === "ready" || p.status === "published").length || 0;

            return (
              <div
                key={campaign._id}
                className="group relative rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700/80 p-5 flex flex-col justify-between transition shadow-sm hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
                        {campaign.status}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this campaign?")) {
                          deleteMutation.mutate(campaign._id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition"
                      title="Delete Campaign"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <h3 className="text-base font-semibold text-white group-hover:text-indigo-400 transition line-clamp-1">
                    {campaign.title || campaign.idea}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {campaign.idea}
                  </p>

                  {campaign.goal && (
                    <div className="mt-3 p-2 rounded-lg bg-neutral-800/40 text-[11px] text-neutral-400 line-clamp-1">
                      <span className="font-semibold text-neutral-300">Goal:</span> {campaign.goal}
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-neutral-800/80 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <Layers className="h-3.5 w-3.5 text-neutral-500" />
                    <span>
                      {readyCount}/{planCount} Ready
                    </span>
                  </div>

                  <Link
                    href={`/campaigns/${campaign._id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <span>View Plans</span>
                    <ArrowRight className="h-3.5 w-3.5" />
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
