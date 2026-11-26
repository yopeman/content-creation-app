"use client";

import Link from "next/link";
import { Wand2, Plus } from "lucide-react";
import { ComingSoonBadge } from "@/components/ui/coming-soon-badge";

export function TopBar() {
  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface/80 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Workspace</span>
        <span className="text-subtle-foreground">/</span>
        <span className="text-xs text-foreground font-semibold">Content Command Center</span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/studio"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface text-foreground text-xs font-medium border border-border transition"
        >
          <Wand2 className="h-3.5 w-3.5 text-purple-400" />
          <span>Open AI Studio</span>
          <ComingSoonBadge />
        </Link>

        <Link
          href="/contents/new"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-medium shadow-md shadow-primary/20 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Content</span>
        </Link>
      </div>
    </header>
  );
}
