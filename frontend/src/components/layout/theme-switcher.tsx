"use client";

import { useThemeStore, Theme } from "@/store/theme-store";
import { Sun, Moon, Sparkles, Monitor } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();

  const options: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "night", label: "Night", icon: Sparkles },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-muted border border-border">
      {options.map(({ id, label, icon: Icon }) => {
        const isActive = theme === id;
        return (
          <button
            key={id}
            type="button"
            title={`${label} theme`}
            aria-label={`${label} theme`}
            aria-pressed={isActive}
            onClick={() => setTheme(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? "bg-surface text-primary shadow-sm font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {/* <span className="hidden sm:inline text-[11px]">{label}</span> */}
          </button>
        );
      })}
    </div>
  );
}
