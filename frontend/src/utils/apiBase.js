const normalizeApiBase = (baseValue) => {
  const trimmed = (baseValue || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `${window.location.protocol}//${trimmed}`;
};

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE);
