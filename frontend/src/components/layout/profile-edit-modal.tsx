"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, User as UserIcon, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/components/calendar/calendar-utils";
import { useAuthStore } from "@/store/auth-store";
import { User } from "@/types";

interface ProfileEditModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
}

type ModalTab = "profile" | "password";

interface ProfileFieldErrors {
  name?: string;
  email?: string;
  timezone?: string;
}

interface PasswordFieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

function getTimezones(currentTimezone?: string): string[] {
  let zones: string[] = FALLBACK_TIMEZONES;
  if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
    try {
      const supported = Intl.supportedValuesOf("timeZone");
      if (supported.length > 0) {
        zones = supported;
      }
    } catch {
      zones = FALLBACK_TIMEZONES;
    }
  }
  if (currentTimezone && !zones.includes(currentTimezone)) {
    return [currentTimezone, ...zones];
  }
  return zones;
}

function validateName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Full name is required.";
  if (trimmed.length > 120) return "Full name must be 120 characters or fewer.";
  return undefined;
}

function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address (for example, name@example.com).";
  }
  return undefined;
}

function validateNewPassword(value: string): string | undefined {
  if (!value) return "New password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return undefined;
}

function validateConfirmPassword(confirm: string, nextPassword: string): string | undefined {
  if (!confirm) return "Please confirm your new password.";
  if (confirm !== nextPassword) return "Passwords do not match.";
  return undefined;
}

export function ProfileEditModal({ open, user, onClose }: ProfileEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const timezoneSelectRef = useRef<HTMLSelectElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const titleId = useId();
  const profileTabId = useId();
  const passwordTabId = useId();
  const profilePanelId = useId();
  const passwordPanelId = useId();

  const nameId = useId();
  const nameErrorId = useId();
  const emailId = useId();
  const emailErrorId = useId();
  const timezoneId = useId();
  const timezoneErrorId = useId();

  const currentPasswordId = useId();
  const currentPasswordErrorId = useId();
  const newPasswordId = useId();
  const newPasswordHintId = useId();
  const newPasswordErrorId = useId();
  const confirmPasswordId = useId();
  const confirmPasswordErrorId = useId();

  const setUser = useAuthStore((s) => s.setUser);

  const [activeTab, setActiveTab] = useState<ModalTab>("profile");

  // Profile form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [profileErrors, setProfileErrors] = useState<ProfileFieldErrors>({});
  const [profileTouched, setProfileTouched] = useState<{ name?: boolean; email?: boolean }>({});
  const [profileSubmitError, setProfileSubmitError] = useState<string | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<PasswordFieldErrors>({});
  const [passwordTouched, setPasswordTouched] = useState<{
    currentPassword?: boolean;
    newPassword?: boolean;
    confirmPassword?: boolean;
  }>({});
  const [passwordSubmitError, setPasswordSubmitError] = useState<string | null>(null);

  const timezones = useMemo(() => getTimezones(user?.timezone), [user?.timezone]);

  // Sync modal open state with native <dialog>.showModal() and reset form values on open
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setActiveTab("profile");
      setName(user?.name ?? "");
      setEmail(user?.email ?? "");
      setTimezone(user?.timezone || "UTC");
      setProfileErrors({});
      setProfileTouched({});
      setProfileSubmitError(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordErrors({});
      setPasswordTouched({});
      setPasswordSubmitError(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, user]);

  // Light-dismiss fallback for browsers without <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
    };

    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("pointerup", onPointerUp);
    return () => {
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { name: string; email: string; timezone: string }) => {
      const resp = await apiClient.patch<User>("/users/me", payload);
      return resp.data;
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      onClose();
    },
    onError: (err) => {
      setProfileSubmitError(getApiErrorMessage(err, "Failed to update profile."));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: { current_password: string; new_password: string }) => {
      await apiClient.post("/users/me/password", payload);
    },
    onSuccess: () => {
      onClose();
    },
    onError: (err) => {
      setPasswordSubmitError(getApiErrorMessage(err, "Failed to change password."));
    },
  });

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileSubmitError(null);

    const nextErrors: ProfileFieldErrors = {
      name: validateName(name),
      email: validateEmail(email),
      timezone: timezone.trim() ? undefined : "Timezone is required.",
    };

    setProfileErrors(nextErrors);
    setProfileTouched({ name: true, email: true });

    if (nextErrors.name) {
      nameInputRef.current?.focus();
      return;
    }
    if (nextErrors.email) {
      emailInputRef.current?.focus();
      return;
    }
    if (nextErrors.timezone) {
      timezoneSelectRef.current?.focus();
      return;
    }

    updateProfileMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      timezone: timezone.trim(),
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordSubmitError(null);

    const nextErrors: PasswordFieldErrors = {
      currentPassword: currentPassword ? undefined : "Current password is required.",
      newPassword: validateNewPassword(newPassword),
      confirmPassword: validateConfirmPassword(confirmPassword, newPassword),
    };

    setPasswordErrors(nextErrors);
    setPasswordTouched({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
    });

    if (nextErrors.currentPassword) {
      currentPasswordRef.current?.focus();
      return;
    }
    if (nextErrors.newPassword) {
      newPasswordRef.current?.focus();
      return;
    }
    if (nextErrors.confirmPassword) {
      confirmPasswordRef.current?.focus();
      return;
    }

    changePasswordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, string>)}
      aria-labelledby={titleId}
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = "";
        onClose();
      }}
      className="bg-surface border border-border rounded-2xl shadow-2xl text-foreground w-[calc(100%-2rem)] max-w-md m-auto p-0 backdrop:bg-black/70 backdrop:backdrop-blur-sm max-h-[90dvh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary-soft border border-primary-border flex items-center justify-center text-primary">
            {activeTab === "profile" ? (
              <UserIcon className="h-4 w-4" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
          </div>
          <h1 id={titleId} className="text-base font-semibold text-foreground">
            Account Settings
          </h1>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close account settings dialog"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Account settings sections"
        className="flex gap-1 px-4 sm:px-6 pt-3 border-b border-border"
      >
        <button
          id={profileTabId}
          type="button"
          role="tab"
          aria-selected={activeTab === "profile"}
          aria-controls={profilePanelId}
          onClick={() => setActiveTab("profile")}
          className={`px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition ${
            activeTab === "profile"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Profile
        </button>
        <button
          id={passwordTabId}
          type="button"
          role="tab"
          aria-selected={activeTab === "password"}
          aria-controls={passwordPanelId}
          onClick={() => setActiveTab("password")}
          className={`px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition ${
            activeTab === "password"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Password
        </button>
      </div>

      {/* Profile Panel */}
      {activeTab === "profile" && (
        <form
          id={profilePanelId}
          role="tabpanel"
          aria-labelledby={profileTabId}
          onSubmit={handleProfileSubmit}
          noValidate
          className="p-6 space-y-5"
        >
          {profileSubmitError && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-danger-soft border border-danger/30 text-xs text-danger"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{profileSubmitError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor={nameId} className="block text-xs font-medium text-foreground">
              Full name <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              ref={nameInputRef}
              id={nameId}
              name="name"
              type="text"
              autoComplete="name"
              autoFocus
              required
              maxLength={120}
              value={name}
              aria-invalid={Boolean(profileErrors.name)}
              aria-describedby={profileErrors.name ? nameErrorId : undefined}
              onChange={(e) => {
                const next = e.target.value;
                setName(next);
                if (profileErrors.name && !validateName(next)) {
                  setProfileErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              onBlur={() => {
                setProfileTouched((prev) => ({ ...prev, name: true }));
                setProfileErrors((prev) => ({ ...prev, name: validateName(name) }));
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-danger/70"
              placeholder="Your name"
            />
            {profileTouched.name && profileErrors.name && (
              <p id={nameErrorId} className="text-xs text-danger">
                {profileErrors.name}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={emailId} className="block text-xs font-medium text-foreground">
              Email <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              ref={emailInputRef}
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              aria-invalid={Boolean(profileErrors.email)}
              aria-describedby={profileErrors.email ? emailErrorId : undefined}
              onChange={(e) => {
                const next = e.target.value;
                setEmail(next);
                if (profileErrors.email && !validateEmail(next)) {
                  setProfileErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              onBlur={() => {
                setProfileTouched((prev) => ({ ...prev, email: true }));
                setProfileErrors((prev) => ({ ...prev, email: validateEmail(email) }));
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-danger/70"
              placeholder="you@example.com"
            />
            {profileTouched.email && profileErrors.email && (
              <p id={emailErrorId} className="text-xs text-danger">
                {profileErrors.email}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={timezoneId} className="block text-xs font-medium text-foreground">
              Timezone
            </label>
            <select
              ref={timezoneSelectRef}
              id={timezoneId}
              name="timezone"
              value={timezone}
              aria-invalid={Boolean(profileErrors.timezone)}
              aria-describedby={profileErrors.timezone ? timezoneErrorId : undefined}
              onChange={(e) => {
                setTimezone(e.target.value);
                if (profileErrors.timezone) {
                  setProfileErrors((prev) => ({ ...prev, timezone: undefined }));
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            {profileErrors.timezone && (
              <p id={timezoneErrorId} className="text-xs text-danger">
                {profileErrors.timezone}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground shadow-md shadow-primary/20 transition"
            >
              {updateProfileMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save changes
            </button>
          </div>
        </form>
      )}

      {/* Password Panel */}
      {activeTab === "password" && (
        <form
          id={passwordPanelId}
          role="tabpanel"
          aria-labelledby={passwordTabId}
          onSubmit={handlePasswordSubmit}
          noValidate
          className="p-6 space-y-5"
        >
          {passwordSubmitError && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-danger-soft border border-danger/30 text-xs text-danger"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{passwordSubmitError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor={currentPasswordId} className="block text-xs font-medium text-foreground">
              Current password <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                ref={currentPasswordRef}
                id={currentPasswordId}
                name="current_password"
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                required
                value={currentPassword}
                aria-invalid={Boolean(passwordErrors.currentPassword)}
                aria-describedby={
                  passwordErrors.currentPassword ? currentPasswordErrorId : undefined
                }
                onChange={(e) => {
                  const next = e.target.value;
                  setCurrentPassword(next);
                  if (passwordErrors.currentPassword && next) {
                    setPasswordErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }
                }}
                onBlur={() => {
                  setPasswordTouched((prev) => ({ ...prev, currentPassword: true }));
                  setPasswordErrors((prev) => ({
                    ...prev,
                    currentPassword: currentPassword ? undefined : "Current password is required.",
                  }));
                }}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-background border border-border text-sm text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-danger/70"
                placeholder="Enter current password"
              />
              <button
                type="button"
                aria-pressed={showCurrentPassword}
                aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordTouched.currentPassword && passwordErrors.currentPassword && (
              <p id={currentPasswordErrorId} className="text-xs text-danger">
                {passwordErrors.currentPassword}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={newPasswordId} className="block text-xs font-medium text-foreground">
              New password <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                ref={newPasswordRef}
                id={newPasswordId}
                name="new_password"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                required
                value={newPassword}
                aria-invalid={Boolean(passwordErrors.newPassword)}
                aria-describedby={
                  passwordErrors.newPassword
                    ? `${newPasswordHintId} ${newPasswordErrorId}`
                    : newPasswordHintId
                }
                onChange={(e) => {
                  const next = e.target.value;
                  setNewPassword(next);
                  if (passwordErrors.newPassword && !validateNewPassword(next)) {
                    setPasswordErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }
                  if (passwordErrors.confirmPassword && confirmPassword === next) {
                    setPasswordErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                onBlur={() => {
                  setPasswordTouched((prev) => ({ ...prev, newPassword: true }));
                  setPasswordErrors((prev) => ({
                    ...prev,
                    newPassword: validateNewPassword(newPassword),
                  }));
                }}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-background border border-border text-sm text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-danger/70"
                placeholder="Enter new password"
              />
              <button
                type="button"
                aria-pressed={showNewPassword}
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p id={newPasswordHintId} className="text-[11px] text-muted-foreground">
              At least 6 characters.
            </p>
            {passwordTouched.newPassword && passwordErrors.newPassword && (
              <p id={newPasswordErrorId} className="text-xs text-danger">
                {passwordErrors.newPassword}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={confirmPasswordId} className="block text-xs font-medium text-foreground">
              Confirm new password <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                ref={confirmPasswordRef}
                id={confirmPasswordId}
                name="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                aria-invalid={Boolean(passwordErrors.confirmPassword)}
                aria-describedby={
                  passwordErrors.confirmPassword ? confirmPasswordErrorId : undefined
                }
                onChange={(e) => {
                  const next = e.target.value;
                  setConfirmPassword(next);
                  if (
                    passwordErrors.confirmPassword &&
                    !validateConfirmPassword(next, newPassword)
                  ) {
                    setPasswordErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                onBlur={() => {
                  setPasswordTouched((prev) => ({ ...prev, confirmPassword: true }));
                  setPasswordErrors((prev) => ({
                    ...prev,
                    confirmPassword: validateConfirmPassword(confirmPassword, newPassword),
                  }));
                }}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-background border border-border text-sm text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-danger/70"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                aria-pressed={showConfirmPassword}
                aria-label={
                  showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                }
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordTouched.confirmPassword && passwordErrors.confirmPassword && (
              <p id={confirmPasswordErrorId} className="text-xs text-danger">
                {passwordErrors.confirmPassword}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground shadow-md shadow-primary/20 transition"
            >
              {changePasswordMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Update password
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
