"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";
import { ProfileEditModal } from "@/components/layout/profile-edit-modal";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { navItems } from "@/components/layout/sidebar";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Close mobile nav on escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Drawer Sheet */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation drawer"
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-surface border-r border-border flex flex-col transition-transform duration-300 ease-out md:hidden shadow-2xl",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-foreground text-base tracking-tight">Yope</span>
              <span className="text-[10px] text-primary block -mt-1 font-semibold tracking-wide">
                CREATOR AI
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
                {item.comingSoon && <ComingSoonBadge className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Theme Switcher & User Section */}
        <div className="p-3 border-t border-border shrink-0 space-y-2">
          <ThemeSwitcher />

          <div className="p-2 rounded-xl bg-surface-muted border border-border flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => {
                setIsProfileModalOpen(true);
              }}
              title="Edit profile"
              className="flex-1 min-w-0 p-1.5 rounded-lg flex items-center justify-between gap-2 text-left hover:bg-surface transition group"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {user?.name || "Creator"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {user?.email || "..."}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                onClose();
              }}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger-soft rounded-lg transition shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ProfileEditModal
          open={isProfileModalOpen}
          user={user}
          onClose={() => setIsProfileModalOpen(false)}
        />
      </aside>
    </>
  );
}
