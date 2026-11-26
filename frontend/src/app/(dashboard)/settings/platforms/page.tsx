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
  Loader2,
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            <span>Connected Platforms</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
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
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Connect Platform</span>
        </button>
      </div>

      {/* Connected Channels List */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Active Connections</h2>

        {isLoading ? (
          <div className="h-32 rounded-2xl bg-surface border border-border animate-pulse flex items-center justify-center text-xs text-muted-foreground">
            Loading platforms...
          </div>
        ) : platforms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-surface/30">
            <Radio className="h-8 w-8 text-subtle-foreground mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-foreground">No platforms connected</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Connect a Telegram channel or group using your bot token to start dispatching content.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {platforms.map((p) => (
              <div
                key={p._id}
                className="p-5 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {p.code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{p.account_name}</h3>
                      <span className="inline-flex items-center gap-1 text-[11px] text-success font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Connected</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
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
                    className="p-2 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border transition"
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
                    className="p-2 rounded-lg bg-surface-muted hover:bg-surface text-foreground border border-border transition"
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
                    className="p-2 rounded-lg bg-surface-muted hover:bg-danger-soft text-muted-foreground hover:text-danger border border-border transition"
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
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <h3 className="text-base font-semibold text-foreground">Connect Telegram Channel</h3>
            <p className="text-xs text-muted-foreground">
              Provide your bot token from @BotFather and your channel username. Make sure your bot is added as an administrator to the channel.
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-danger-soft border border-danger/20 text-danger text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRstuvwxYZ"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Channel Username or Chat ID
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="@my_channel_username"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConnectOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-muted text-muted-foreground text-xs font-medium hover:text-foreground border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={!botToken || !chatId || connectMutation.isPending}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
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
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <h3 className="text-base font-semibold text-foreground">Edit Telegram Connection</h3>
            <p className="text-xs text-muted-foreground">
              Update your bot token or channel ID for {editingPlatform.account_name}.
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-danger-soft border border-danger/20 text-danger text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  New Bot Token (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Leave empty to keep existing token"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Channel Username or Chat ID
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="@my_channel_username"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPlatform(null)}
                className="px-4 py-2 rounded-lg bg-surface-muted text-muted-foreground text-xs font-medium hover:text-foreground border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => editMutation.mutate(editingPlatform._id)}
                disabled={editMutation.isPending}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
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
