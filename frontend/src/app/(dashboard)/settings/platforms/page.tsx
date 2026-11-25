"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Platform, SupportedPlatform } from "@/types";
import {
  Radio,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function PlatformSettingsPage() {
  const queryClient = useQueryClient();

  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);

  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Supported platforms
  const { data: supported = [] } = useQuery<SupportedPlatform[]>({
    queryKey: ["supported-platforms"],
    queryFn: async () => {
      const res = await apiClient.get<SupportedPlatform[]>("/platforms/supported");
      return res.data;
    },
  });

  // Connected platforms
  const { data: platforms = [], isLoading } = useQuery<Platform[]>({
    queryKey: ["platforms"],
    queryFn: async () => {
      const res = await apiClient.get<Platform[]>("/platforms");
      return res.data;
    },
  });

  // Connect Telegram
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/platforms/tg", {
        bot_token: botToken,
        chat_id: chatId.startsWith("@") ? chatId : `@${chatId}`,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
      setIsConnectOpen(false);
      setBotToken("");
      setChatId("");
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || "Failed to connect Telegram channel.");
    },
  });

  // Edit Telegram
  const editMutation = useMutation({
    mutationFn: async (id: string) => {
      const payload: any = {};
      if (botToken) payload.bot_token = botToken;
      if (chatId) payload.chat_id = chatId.startsWith("@") ? chatId : `@${chatId}`;

      const res = await apiClient.patch(`/platforms/tg/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
      setEditingPlatform(null);
      setBotToken("");
      setChatId("");
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || "Failed to update Telegram credentials.");
    },
  });

  // Re-sync
  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/platforms/${id}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
      alert("Platform re-verified and synchronized!");
    },
  });

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/platforms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
    },
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Radio className="h-6 w-6 text-indigo-400" />
            <span>Connected Platforms</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Connect third-party social media accounts to enable direct and scheduled publishing.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setBotToken("");
            setChatId("");
            setIsConnectOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Connect Platform</span>
        </button>
      </div>

      {/* Connected Channels List */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white">Active Connections</h2>

        {isLoading ? (
          <div className="h-32 rounded-2xl bg-neutral-900 border border-neutral-800 animate-pulse flex items-center justify-center text-xs text-neutral-500">
            Loading platforms...
          </div>
        ) : platforms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 p-8 text-center bg-neutral-900/30">
            <Radio className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white">No platforms connected</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Connect a Telegram channel or group using your bot token to start dispatching content.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {platforms.map((p) => (
              <div
                key={p._id}
                className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {p.code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{p.account_name}</h3>
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Connected</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-0.5">
                      <span>ID: {p.platform_account_id}</span>
                      <span>•</span>
                      <span>Synced {formatDate(p.updated_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => syncMutation.mutate(p._id)}
                    disabled={syncMutation.isPending}
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                    title="Re-verify credentials"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setEditingPlatform(p);
                      setChatId(p.platform_account_id || "");
                      setBotToken("");
                      setError(null);
                    }}
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                    title="Edit Credentials"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("Disconnect this platform?")) {
                        disconnectMutation.mutate(p._id);
                      }
                    }}
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition"
                    title="Disconnect"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {isConnectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">Connect Telegram Channel</h3>
            <p className="text-xs text-neutral-400">
              Provide your bot token from @BotFather and your channel username. Make sure your bot is added as an administrator to the channel.
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRstuvwxYZ"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-800/80 border border-neutral-700/80 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Channel Username or Chat ID
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="@my_channel_username"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-800/80 border border-neutral-700/80 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConnectOpen(false)}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-medium hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={!botToken || !chatId || connectMutation.isPending}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                {connectMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Connect & Verify</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">Edit Telegram Connection</h3>
            <p className="text-xs text-neutral-400">
              Update your bot token or channel ID for {editingPlatform.account_name}.
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  New Bot Token (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Leave empty to keep existing token"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-800/80 border border-neutral-700/80 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Channel Username or Chat ID
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="@my_channel_username"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-800/80 border border-neutral-700/80 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPlatform(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-medium hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => editMutation.mutate(editingPlatform._id)}
                disabled={editMutation.isPending}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                {editMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
