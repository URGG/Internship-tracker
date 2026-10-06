const DEFAULT_API_BASE = import.meta.env.PROD
  ? "https://internship-tracker-1-9w2v.onrender.com/api"
  : "http://localhost:8000/api";

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
export const API_BASE = /\/api$/i.test(configuredApiBase) ? configuredApiBase : `${configuredApiBase}/api`;
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
export const TERMS_VERSION = import.meta.env.VITE_TERMS_VERSION || "v1";
export const PRIVACY_VERSION = import.meta.env.VITE_PRIVACY_VERSION || "v1";
export const TERMS_URL = import.meta.env.VITE_TERMS_URL || "/terms";
export const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL || "/privacy";
