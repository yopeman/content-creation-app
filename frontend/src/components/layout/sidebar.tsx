"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  FileText,
  Wand2,
  FolderOpen,
  Send,
  Radio,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";

const navItems = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Content Manager", href: "/contents", icon: FileText },
  { name: "AI Studio", href: "/studio", icon: Wand2, comingSoon: true },
  { name: "Schedule", href: "/schedule", icon: Send },
  { name: "Media Library", href: "/library", icon: FolderOpen },
  { name: "Connected Platforms", href: "/settings/platforms", icon: Radio },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-64 border-r border-neutral-800 bg-neutral-900/50 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-neutral-800">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <span className="font-bold text-white text-base tracking-tight">Yope</span>
          <span className="text-[10px] text-indigo-400 block -mt-1 font-medium">CREATOR AI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
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
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
              {item.comingSoon && <ComingSoonBadge className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-neutral-800">
        <div className="p-3 rounded-xl bg-neutral-800/40 border border-neutral-800/80 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-white truncate">{user?.name || "Creator"}</p>
            <p className="text-[11px] text-neutral-400 truncate">{user?.email || "..."}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
