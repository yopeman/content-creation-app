"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Campaign, ContentType, Platform, Plan } from "@/types";
import {
  ListTodo,
  Plus,
  Wand2,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Sparkles,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  Radio,
  FileText,
  Video,
  Image as ImageIcon,
  Headphones,
  FolderGit2,
  X,
  Filter,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const FORMAT_OPTIONS: { label: string; value: ContentType; icon: any }[] = [
  { label: "Text Copy", value: "text", icon: FileText },
  { label: "Image / Visual", value: "image", icon: ImageIcon },
  { label: "Video Reel", value: "video", icon: Video },
  { label: "Audio Track", value: "audio", icon: Headphones },
];

export default function PlansPage() {
  const queryClient = useQueryClient();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [associationFilter, setAssociationFilter] = useState<"all" | "standalone" | "campaign">("all");
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Form State for Create / Edit
  const [formIdea, setFormIdea] = useState("");
  const [formAssociationType, setFormAssociationType] = useState<"standalone" | "campaign">("standalone");
  const [formCampaignId, setFormCampaignId] = useState<string>("");
  const [formFormats, setFormFormats] = useState<ContentType[]>(["text", "image"]);
  const [formPlatformIds, setFormPlatformIds] = useState<string[]>([]);
  const [formScheduledAt, setFormScheduledAt] = useState<string>("");
  const [generatingPlanId, setGeneratingPlanId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Plans
  const { data: plans = [], isLoading: loadingPlans } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await apiClient.get<Plan[]>("/plans/items");
      return res.data;
    },
  });

  // 2. Fetch Campaigns (for association)
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await apiClient.get<Campaign[]>("/campaigns");
      return res.data;
    },
  });

  // 3. Fetch Platforms
  const { data: platforms = [] } = useQuery<Platform[]>({
    queryKey: ["platforms"],
    queryFn: async () => {
      const res = await apiClient.get<Platform[]>("/platforms");
      return res.data;
    },
  });

  // Reset form
  const resetForm = () => {
    setFormIdea("");
    setFormAssociationType("standalone");
    setFormCampaignId(campaigns.length > 0 ? campaigns[0]._id : "");
    setFormFormats(["text", "image"]);
    setFormPlatformIds(platforms.map((p) => p._id));
    setFormScheduledAt("");
    setActionError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setFormIdea(plan.idea);
    if (plan.campaign_id) {
      setFormAssociationType("campaign");
      setFormCampaignId(plan.campaign_id);
    } else {
      setFormAssociationType("standalone");
      setFormCampaignId(campaigns.length > 0 ? campaigns[0]._id : "");
    }
    setFormFormats(plan.formats && plan.formats.length > 0 ? plan.formats : ["text", "image"]);
    setFormPlatformIds(plan.platform_ids || []);
    setFormScheduledAt(plan.scheduled_at ? new Date(plan.scheduled_at).toISOString().slice(0, 16) : "");
    setActionError(null);
  };

  // Create Plan Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        idea: formIdea,
        formats: formFormats,
        platform_ids: formPlatformIds,
        campaign_id: formAssociationType === "campaign" && formCampaignId ? formCampaignId : null,
      };
      if (formScheduledAt) {
        payload.scheduled_at = new Date(formScheduledAt).toISOString();
      }
      const res = await apiClient.post("/plans/items", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.detail || "Failed to create plan");
    },
  });

  // Edit Plan Mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingPlan) return;
      const payload: any = {
        idea: formIdea,
        formats: formFormats,
        platform_ids: formPlatformIds,
        campaign_id: formAssociationType === "campaign" && formCampaignId ? formCampaignId : null,
      };
      if (formScheduledAt) {
        payload.scheduled_at = new Date(formScheduledAt).toISOString();
      } else {
        payload.scheduled_at = null;
      }
      const res = await apiClient.patch(`/plans/${editingPlan._id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setEditingPlan(null);
      resetForm();
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.detail || "Failed to update plan");
    },
  });

  // Delete Plan Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  // Generate AI Content for Plan
  const handleGenerateContent = async (planId: string) => {
    try {
      setGeneratingPlanId(planId);
      await apiClient.post(`/generations/plans/${planId}/content`);
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["contents"] });
    } catch (err: any) {
      alert(err.response?.data?.detail || "Content generation failed");
    } finally {
      setGeneratingPlanId(null);
    }
  };

  // Toggle format selection
  const toggleFormat = (fmt: ContentType) => {
    if (formFormats.includes(fmt)) {
      if (formFormats.length > 1) {
        setFormFormats(formFormats.filter((f) => f !== fmt));
      }
    } else {
      setFormFormats([...formFormats, fmt]);
    }
  };

  // Toggle platform selection
  const togglePlatform = (pId: string) => {
    if (formPlatformIds.includes(pId)) {
      setFormPlatformIds(formPlatformIds.filter((id) => id !== pId));
    } else {
      setFormPlatformIds([...formPlatformIds, pId]);
    }
  };

  // Filtering
  const filteredPlans = plans.filter((p) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchIdea = p.idea?.toLowerCase().includes(q);
      const matchCamp = p.campaign_title?.toLowerCase().includes(q);
      const matchContent = p.content_title?.toLowerCase().includes(q);
      if (!matchIdea && !matchCamp && !matchContent) return false;
    }

    // Association filter
    if (associationFilter === "standalone" && p.campaign_id) return false;
    if (associationFilter === "campaign" && !p.campaign_id) return false;

    // Specific campaign filter
    if (selectedCampaignFilter !== "all" && p.campaign_id !== selectedCampaignFilter) return false;

    // Status filter
    if (selectedStatusFilter !== "all" && p.status !== selectedStatusFilter) return false;

    return true;
  });

  // Stats
  const totalPlans = plans.length;
  const standalonePlansCount = plans.filter((p) => !p.campaign_id).length;
  const campaignPlansCount = plans.filter((p) => !!p.campaign_id).length;
  const withContentCount = plans.filter((p) => !!p.content_id).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ListTodo className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Content Plans</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Organize content plans, ideate multi-format packages, and associate with campaigns or run standalone.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Plan</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs text-neutral-400 font-medium">Total Plans</p>
          <p className="text-2xl font-bold text-white mt-1">{totalPlans}</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs text-emerald-400 font-medium">Standalone Plans</p>
          <p className="text-2xl font-bold text-white mt-1">{standalonePlansCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs text-purple-400 font-medium">In Campaigns</p>
          <p className="text-2xl font-bold text-white mt-1">{campaignPlansCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs text-cyan-400 font-medium">Content Generated</p>
          <p className="text-2xl font-bold text-white mt-1">{withContentCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
        {/* Search & Association Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Association Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
            <button
              onClick={() => setAssociationFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                associationFilter === "all"
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              All Plans ({totalPlans})
            </button>
            <button
              onClick={() => setAssociationFilter("standalone")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                associationFilter === "standalone"
                  ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Standalone ({standalonePlansCount})
            </button>
            <button
              onClick={() => setAssociationFilter("campaign")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                associationFilter === "campaign"
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/30 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              In Campaign ({campaignPlansCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search plans, topics, campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-200 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Sub-filters (Campaign Dropdown & Status Filter) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">Campaign:</span>
            <select
              value={selectedCampaignFilter}
              onChange={(e) => setSelectedCampaignFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title || c.idea}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-neutral-400">Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="ready">Ready</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
          </div>

          {(selectedCampaignFilter !== "all" || selectedStatusFilter !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCampaignFilter("all");
                setSelectedStatusFilter("all");
                setSearchQuery("");
                setAssociationFilter("all");
              }}
              className="ml-auto text-neutral-400 hover:text-neutral-200 text-xs underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Plans List / Grid */}
      {loadingPlans ? (
        <div className="p-12 text-center text-xs text-neutral-400 bg-neutral-900 rounded-2xl border border-neutral-800">
          Loading content plans...
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="p-12 text-center bg-neutral-900 rounded-2xl border border-neutral-800 space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-neutral-500 mx-auto">
            <ListTodo className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No plans found</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            {searchQuery || associationFilter !== "all" || selectedCampaignFilter !== "all"
              ? "No plans match your current search and filter settings."
              : "Create a plan to organize your next social post, video reel, or campaign item."}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer mt-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Plan</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => {
            const isGeneratingThis = generatingPlanId === plan._id;
            const hasCampaign = !!plan.campaign_id;

            return (
              <div
                key={plan._id}
                className="flex flex-col justify-between p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition shadow-sm space-y-4"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {/* Campaign or Standalone Badge */}
                    {hasCampaign ? (
                      <Link
                        href={`/campaigns/${plan.campaign_id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 transition"
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: plan.campaign_color || "#a855f7" }}
                        />
                        <span className="truncate max-w-[130px]">
                          {plan.campaign_title || "Campaign"}
                        </span>
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                        <span>Standalone</span>
                      </span>
                    )}

                    {/* Status Pill */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                        plan.status === "published"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : plan.status === "scheduled"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : plan.status === "ready"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>

                  {/* Plan Idea */}
                  <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                    {plan.idea}
                  </h3>

                  {/* Formats Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {(plan.formats || []).map((fmt) => {
                      const opt = FORMAT_OPTIONS.find((f) => f.value === fmt);
                      const Icon = opt?.icon || FileText;
                      return (
                        <span
                          key={fmt}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-950 border border-neutral-800 text-[10px] font-medium text-neutral-300 capitalize"
                        >
                          <Icon className="h-3 w-3 text-neutral-400" />
                          <span>{fmt}</span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Scheduled Date (if present) */}
                  {plan.scheduled_at && (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-400">
                      <Clock className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                      <span>{formatDate(plan.scheduled_at)}</span>
                    </div>
                  )}

                  {/* Linked Content Banner */}
                  <div className="mt-4 pt-3 border-t border-neutral-800/80">
                    {plan.content_id ? (
                      <Link
                        href={`/contents/${plan.content_id}`}
                        className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 text-xs transition group"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-white font-medium truncate group-hover:text-indigo-400 transition">
                              {plan.content_title || "Generated Content"}
                            </p>
                            <p className="text-[10px] text-neutral-400 capitalize">
                              {plan.content_status || "Ready"}
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleGenerateContent(plan._id)}
                        disabled={isGeneratingThis}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        <span>{isGeneratingThis ? "Generating Content..." : "Generate AI Content"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80 text-xs">
                  <span className="text-[10px] text-neutral-500">
                    Created {formatDate(plan.created_at)}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(plan)}
                      title="Edit Plan"
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this plan?")) {
                          deleteMutation.mutate(plan._id);
                        }
                      }}
                      title="Delete Plan"
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE PLAN MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <ListTodo className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Create New Plan</h3>
                  <p className="text-xs text-neutral-400">
                    Plan your content format, platforms, and choose whether to link it to a campaign.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {actionError}
              </div>
            )}

            {/* Form */}
            <div className="space-y-4 text-xs">
              {/* Idea / Concept */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Plan Idea / Topic <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formIdea}
                  onChange={(e) => setFormIdea(e.target.value)}
                  placeholder="e.g. 5 AI Agents That Automate Code Quality in 2026..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 text-xs transition"
                />
              </div>

              {/* Campaign Association Selector */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <label className="block text-neutral-200 font-semibold">
                  Campaign Association
                </label>
                <p className="text-neutral-400 text-[11px] -mt-1">
                  Choose whether this plan is part of an overarching editorial campaign or independent.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormAssociationType("standalone")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                      formAssociationType === "standalone"
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                        formAssociationType === "standalone"
                          ? "border-emerald-400 bg-emerald-400"
                          : "border-neutral-600"
                      }`}
                    >
                      {formAssociationType === "standalone" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-neutral-950" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-white">Standalone Plan</p>
                      <p className="text-[10px] text-neutral-400">Independent post</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormAssociationType("campaign")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                      formAssociationType === "campaign"
                        ? "bg-purple-500/10 border-purple-500/40 text-purple-300 shadow-sm"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                        formAssociationType === "campaign"
                          ? "border-purple-400 bg-purple-400"
                          : "border-neutral-600"
                      }`}
                    >
                      {formAssociationType === "campaign" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-neutral-950" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-white">In a Campaign</p>
                      <p className="text-[10px] text-neutral-400">Attach to campaign</p>
                    </div>
                  </button>
                </div>

                {/* Campaign Selection Dropdown */}
                {formAssociationType === "campaign" && (
                  <div className="pt-2 animate-in fade-in duration-150">
                    {campaigns.length === 0 ? (
                      <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs flex items-center justify-between">
                        <span>No campaigns exist yet.</span>
                        <Link
                          href="/campaigns/new"
                          className="text-indigo-400 hover:underline font-semibold"
                        >
                          + Create Campaign
                        </Link>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-neutral-400 text-[11px] mb-1">
                          Select Campaign:
                        </label>
                        <select
                          value={formCampaignId}
                          onChange={(e) => setFormCampaignId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs focus:outline-none focus:border-indigo-500"
                        >
                          {campaigns.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.title || c.idea}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Target Formats */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Target Content Formats
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FORMAT_OPTIONS.map((f) => {
                    const isSelected = formFormats.includes(f.value);
                    const Icon = f.icon;
                    return (
                      <button
                        type="button"
                        key={f.value}
                        onClick={() => toggleFormat(f.value)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                            : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Platforms */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Publishing Platforms
                </label>
                {platforms.length === 0 ? (
                  <p className="text-[11px] text-neutral-500">
                    No platforms connected.{" "}
                    <Link href="/settings/platforms" className="text-indigo-400 underline">
                      Connect Telegram
                    </Link>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {platforms.map((p) => {
                      const isSelected = formPlatformIds.includes(p._id);
                      return (
                        <button
                          type="button"
                          key={p._id}
                          onClick={() => togglePlatform(p._id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                          }`}
                        >
                          <Radio className="h-3.5 w-3.5" />
                          <span>{p.account_name || p.code}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Scheduled Date */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Scheduled Date & Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formScheduledAt}
                  onChange={(e) => setFormScheduledAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 focus:outline-none focus:border-indigo-500 text-xs transition [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={!formIdea.trim() || createMutation.isPending}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {createMutation.isPending ? "Creating..." : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PLAN MODAL */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Edit Plan</h3>
                  <p className="text-xs text-neutral-400">
                    Update plan topic, formats, schedule, or switch campaign association.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="p-1 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {actionError}
              </div>
            )}

            {/* Form */}
            <div className="space-y-4 text-xs">
              {/* Idea / Concept */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Plan Idea / Topic <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formIdea}
                  onChange={(e) => setFormIdea(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 focus:outline-none focus:border-indigo-500 text-xs transition"
                />
              </div>

              {/* Campaign Association Selector */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <label className="block text-neutral-200 font-semibold">
                  Campaign Association
                </label>
                <p className="text-neutral-400 text-[11px] -mt-1">
                  You can associate this plan with a campaign or make it standalone at any time.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormAssociationType("standalone")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                      formAssociationType === "standalone"
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                        formAssociationType === "standalone"
                          ? "border-emerald-400 bg-emerald-400"
                          : "border-neutral-600"
                      }`}
                    >
                      {formAssociationType === "standalone" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-neutral-950" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-white">Standalone Plan</p>
                      <p className="text-[10px] text-neutral-400">No campaign linked</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormAssociationType("campaign")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                      formAssociationType === "campaign"
                        ? "bg-purple-500/10 border-purple-500/40 text-purple-300 shadow-sm"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                        formAssociationType === "campaign"
                          ? "border-purple-400 bg-purple-400"
                          : "border-neutral-600"
                      }`}
                    >
                      {formAssociationType === "campaign" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-neutral-950" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-white">In a Campaign</p>
                      <p className="text-[10px] text-neutral-400">Attach to campaign</p>
                    </div>
                  </button>
                </div>

                {formAssociationType === "campaign" && (
                  <div className="pt-2 animate-in fade-in duration-150">
                    <label className="block text-neutral-400 text-[11px] mb-1">
                      Choose Campaign:
                    </label>
                    <select
                      value={formCampaignId}
                      onChange={(e) => setFormCampaignId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      {campaigns.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.title || c.idea}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Target Formats */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Target Content Formats
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FORMAT_OPTIONS.map((f) => {
                    const isSelected = formFormats.includes(f.value);
                    const Icon = f.icon;
                    return (
                      <button
                        type="button"
                        key={f.value}
                        onClick={() => toggleFormat(f.value)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                            : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scheduled Date */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Scheduled Date & Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formScheduledAt}
                  onChange={(e) => setFormScheduledAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 focus:outline-none focus:border-indigo-500 text-xs transition [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => editMutation.mutate()}
                disabled={!formIdea.trim() || editMutation.isPending}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
