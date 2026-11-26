"use client";

import Link from "next/link";
import { Wand2, Plus, Menu } from "lucide-react";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";

interface TopBarProps {
  onOpenMobileNav?: () => void;
}

export function TopBar({ onOpenMobileNav }: TopBarProps) {
  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface/80 backdrop-blur px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="p-2 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-muted transition md:hidden shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="hidden sm:inline text-xs text-muted-foreground font-medium">Workspace</span>
          <span className="hidden sm:inline text-subtle-foreground">/</span>
          <span className="text-xs text-foreground font-semibold truncate">Content Command Center</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Link
          href="/studio"
          title="Open AI Studio"
          className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
        >
          <Wand2 className="h-3.5 w-3.5 text-purple-400 shrink-0" />
          <span className="hidden sm:inline">Open AI Studio</span>
          <span className="sm:hidden text-xs">Studio</span>
          <ComingSoonBadge className="hidden md:inline-flex" />
        </Link>

        <Link
          href="/contents/new"
          title="Create New Content"
          className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-medium shadow-md shadow-primary/20 transition"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">New Content</span>
          <span className="sm:hidden text-xs">New</span>
        </Link>
      </div>
    </header>
  );
}
