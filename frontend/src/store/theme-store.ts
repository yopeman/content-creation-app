import { create } from "zustand";

export type Theme = "light" | "dark" | "night" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "yope_theme";

export function getEffectiveTheme(theme: Theme): "light" | "dark" | "night" {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }
  return theme;
}

export function applyThemeToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  
  // Also synchronize standard class for any helper or tailwind fallback
  const effective = getEffectiveTheme(theme);
  if (effective === "dark" || effective === "night") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "system",
  setTheme: (theme: Theme) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // local storage may be restricted in some environments
      }
    }
    applyThemeToDocument(theme);
    set({ theme });
  },
}));
