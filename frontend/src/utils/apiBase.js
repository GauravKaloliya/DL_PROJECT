const normalizeApiBase = (baseValue) => {
  const trimmed = (baseValue || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";  // Empty string means use relative URLs (proxy)
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `${window.location.protocol}//${trimmed}`;
};

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE);

// Helper to get full API URL
export const getApiUrl = (endpoint) => {
  if (API_BASE) {
    return `${API_BASE}${endpoint}`;
  }
  // If API_BASE is empty, use relative URL (will be proxied by Vite)
  return endpoint;
};
