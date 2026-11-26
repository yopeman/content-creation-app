"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  FileText,
  Wand2,
  FolderOpen,
  Send,
  CalendarDays,
  Radio,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";
import { ProfileEditModal } from "@/components/layout/profile-edit-modal";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

export const navItems = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Content Manager", href: "/contents", icon: FileText },
  { name: "AI Studio", href: "/studio", icon: Wand2, comingSoon: true },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Posts", href: "/posts", icon: Send },
  { name: "Media Library", href: "/library", icon: FolderOpen },
  { name: "Connected Platforms", href: "/settings/platforms", icon: Radio },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  return (
    <aside className="hidden md:flex w-64 border-r border-border bg-surface flex-col shrink-0 h-full">
      {/* Brand Header */}
      <div className="h-16 shrink-0 flex items-center px-6 gap-3 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-orange-400 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <span className="font-bold text-foreground text-base tracking-tight">Yope</span>
          <span className="text-[10px] text-primary block -mt-1 font-semibold tracking-wide">CREATOR AI</span>
        </div>
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
            onClick={() => setIsProfileModalOpen(true)}
            title="Edit profile"
            className="flex-1 min-w-0 p-1.5 rounded-lg flex items-center justify-between gap-2 text-left hover:bg-surface transition group"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user?.name || "Creator"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email || "..."}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={logout}
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
  );
}
