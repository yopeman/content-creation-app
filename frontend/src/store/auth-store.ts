import { create } from "zustand";
import { User } from "@/types";
import { apiClient } from "@/lib/api-client";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("yope_token") : null,
  isLoading: true,

  setAuth: (user, token) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("yope_token", token);
      document.cookie = `yope_token=${token}; path=/; max-age=604800; SameSite=Lax`;
    }
    set({ user, token, isLoading: false });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("yope_token");
      document.cookie = "yope_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.href = '/login';
    }
    set({ user: null, token: null, isLoading: false });
  },

  fetchMe: async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("yope_token") : null;
    if (!token) {
      set({ user: null, token: null, isLoading: false });
      return;
    }
    try {
      set({ isLoading: true });
      const resp = await apiClient.get<User>("/users/me");
      set({ user: resp.data, token, isLoading: false });
    } catch {
      if (typeof window !== "undefined") {
        localStorage.removeItem("yope_token");
        document.cookie = "yope_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
