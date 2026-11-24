"use client";

import { Suspense, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { useAuthStore } from "@/store/auth-store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <div className="min-h-screen flex bg-neutral-950 text-neutral-100">
      <Suspense fallback={<div className="w-64 border-r border-neutral-800 bg-neutral-900/50" />}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-8 overflow-y-auto">
          <Suspense fallback={<div className="h-64 flex items-center justify-center text-xs text-neutral-500">Loading page...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
