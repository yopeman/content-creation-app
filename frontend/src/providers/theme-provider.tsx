"use client";

import { useEffect } from "react";
import { applyThemeToDocument, Theme, useThemeStore } from "@/store/theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    // Read theme from localStorage on initial mount
    try {
      const stored = localStorage.getItem("yope_theme") as Theme | null;
      if (stored && ["light", "dark", "night", "system"].includes(stored)) {
        setTheme(stored);
      } else {
        applyThemeToDocument("system");
      }
    } catch {
      applyThemeToDocument("system");
    }
  }, [setTheme]);

  useEffect(() => {
    // Listen for system theme changes if theme is "system"
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      applyThemeToDocument("system");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  return <>{children}</>;
}
