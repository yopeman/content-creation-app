"use client";

import Link from "next/link";
import { Wand2, Plus, Bell } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export function TopBar() {
  const { user } = useAuthStore();

  return (
    <header className="h-16 border-b border-neutral-800 bg-neutral-900/30 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400 font-medium">Workspace</span>
        <span className="text-neutral-600">/</span>
        <span className="text-xs text-neutral-200 font-semibold">Content Command Center</span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/studio"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
        >
          <Wand2 className="h-3.5 w-3.5 text-purple-400" />
          <span>Open AI Studio</span>
        </Link>

        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Campaign</span>
        </Link>
      </div>
    </header>
  );
}
