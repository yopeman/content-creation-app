import axios from "axios";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("yope_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // When uploading FormData (multipart/form-data), delete explicit Content-Type
  // so the browser automatically sets the correct boundary parameter.
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers["Content-Type"];
      if (typeof config.headers.delete === "function") {
        config.headers.delete("Content-Type");
      }
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Clear token and avoid infinite loop if already on login page
      localStorage.removeItem("yope_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function getMediaUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  // Normalize absolute or relative upload paths (e.g. /home/.../uploads/image.png or uploads/image.png)
  let cleanPath = pathOrUrl;
  const uploadsIdx = cleanPath.indexOf("uploads/");
  if (uploadsIdx !== -1) {
    cleanPath = cleanPath.substring(uploadsIdx + "uploads/".length);
    cleanPath = `/uploads/${cleanPath}`;
  } else {
    cleanPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  }

  return `${BACKEND_URL}${cleanPath}`;
}
