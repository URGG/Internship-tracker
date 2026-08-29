const DEFAULT_API_BASE = import.meta.env.PROD
  ? "https://internship-tracker-1-9w2v.onrender.com/api"
  : "http://localhost:8000/api";

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
export const API_BASE = /\/api$/i.test(configuredApiBase) ? configuredApiBase : `${configuredApiBase}/api`;
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
