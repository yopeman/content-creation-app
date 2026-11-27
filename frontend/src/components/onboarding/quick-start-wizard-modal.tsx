"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { OnboardingStatus } from "@/types";
import { AlertCircle, Loader2 } from "lucide-react";

interface QuickStartWizardModalProps {
  initialOnboarding: OnboardingStatus;
  hasPlatforms: boolean;
  onSuccess?: () => void;
  destinationLabel?: string;
}

export function QuickStartWizardModal({
  initialOnboarding,
  hasPlatforms,
  onSuccess,
  destinationLabel = "Open Dashboard",
}: QuickStartWizardModalProps) {
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    return Boolean(
      initialOnboarding.needs_password ||
        !initialOnboarding.has_connected_channel ||
        !hasPlatforms
    );
  });

  const [onboardingStep, setOnboardingStep] = useState<"password" | "channel">(() => {
    if (initialOnboarding.needs_password) return "password";
    return "channel";
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [tgChatId, setTgChatId] = useState("");
  const [tgBotToken, setTgBotToken] = useState("");
  const [showTgCustomToken, setShowTgCustomToken] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  // Password mutation
  const setPasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const res = await apiClient.post("/users/me/set-initial-password", {
        new_password: newPassword,
      });
      return res.data;
    },
    onSuccess: () => {
      setPasswordError(null);
      if (!initialOnboarding.has_connected_channel || !hasPlatforms) {
        setOnboardingStep("channel");
      } else {
        setIsOpen(false);
        onSuccess?.();
      }
    },
    onError: (err: any) => {
      setPasswordError(
        err.message || err.response?.data?.detail || "Failed to set password."
      );
    },
  });

  // Connect Channel mutation
  const connectChannelMutation = useMutation({
    mutationFn: async () => {
      const trimmedChatId = tgChatId.trim();
      if (!trimmedChatId) {
        throw new Error("Please enter a channel username or chat ID.");
      }
      const formattedChatId =
        trimmedChatId.startsWith("@") || /^-?\d+$/.test(trimmedChatId)
          ? trimmedChatId
          : `@${trimmedChatId}`;

      const payload: { chat_id: string; bot_token?: string } = {
        chat_id: formattedChatId,
      };
      if (showTgCustomToken && tgBotToken.trim()) {
        payload.bot_token = tgBotToken.trim();
      }

      const res = await apiClient.post("/platforms/tg", payload);
      return res.data;
    },
    onSuccess: () => {
      setChannelError(null);
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
      setIsOpen(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      setChannelError(
        err.message || err.response?.data?.detail || "Failed to connect channel."
      );
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-5">
        {/* Steps indicator */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              🚀
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Quick Setup Wizard</h3>
              <p className="text-[11px] text-muted-foreground">
                {onboardingStep === "password"
                  ? "Step 1 of 2: Secure Your Account"
                  : initialOnboarding.needs_password
                  ? "Step 2 of 2: Connect Publishing Channel"
                  : "Step 1 of 1: Connect Publishing Channel"}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {onboardingStep === "password" ? "Step 1" : "Step 2"}
          </span>
        </div>

        {/* Step 1: Password */}
        {onboardingStep === "password" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPasswordMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Choose Account Password</h4>
              <p className="text-xs text-muted-foreground">
                Your account was created via external access. Please set a password to secure your account.
              </p>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  New Password <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Confirm Password <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!newPassword || newPassword.length < 6 || setPasswordMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md disabled:opacity-50 transition"
              >
                {setPasswordMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {!initialOnboarding.has_connected_channel || !hasPlatforms
                    ? "Next: Connect Channel →"
                    : destinationLabel}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Connect Channel */}
        {onboardingStep === "channel" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              connectChannelMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Connect Telegram Channel</h4>
              <p className="text-xs text-muted-foreground">
                Connect at least one active channel to dispatch and publish your content.
              </p>
            </div>

            {channelError && (
              <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{channelError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Channel Username or Chat ID <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  placeholder="@my_channel_username or -100123456789"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Using default bot from environment. Ensure the bot is added as an administrator with posting rights.
                </p>
              </div>

              {/* Optional Custom Token Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowTgCustomToken(!showTgCustomToken)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition underline-offset-2 hover:underline"
                >
                  <span>{showTgCustomToken ? "− Hide custom bot token" : "+ Use custom bot token instead"}</span>
                </button>

                {showTgCustomToken && (
                  <div className="mt-2.5 space-y-1 animate-in fade-in duration-200">
                    <label className="block text-xs font-semibold text-foreground">
                      Custom Telegram Bot Token
                    </label>
                    <input
                      type="password"
                      value={tgBotToken}
                      onChange={(e) => setTgBotToken(e.target.value)}
                      placeholder="123456789:ABCdefGhIJKlmNoPQRstuvwxYZ"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {initialOnboarding.needs_password ? (
                <button
                  type="button"
                  onClick={() => setOnboardingStep("password")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back to Password
                </button>
              ) : (
                <div />
              )}
              <button
                type="submit"
                disabled={!tgChatId.trim() || connectChannelMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md disabled:opacity-50 transition"
              >
                {connectChannelMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Connect Channel & {destinationLabel}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
