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
    <div className="h-screen flex overflow-hidden bg-background text-foreground">
      <Suspense fallback={<div className="w-64 shrink-0 border-r border-border bg-surface/50" />}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar />
        <main className="flex-1 min-h-0 p-8 overflow-y-auto">
          <Suspense fallback={<div className="h-64 flex items-center justify-center text-xs text-muted-foreground">Loading page...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
