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
export const COOKIES_URL = import.meta.env.VITE_COOKIES_URL || "/cookies";
export const DISCLAIMER_URL = import.meta.env.VITE_DISCLAIMER_URL || "/disclaimer";
export const ACCEPTABLE_USE_URL = import.meta.env.VITE_ACCEPTABLE_USE_URL || "/acceptable-use";
export const NOTICE_AT_COLLECTION_URL = import.meta.env.VITE_NOTICE_AT_COLLECTION_URL || "/notice-at-collection";
export const LEGAL_ENTITY_NAME = import.meta.env.VITE_LEGAL_ENTITY_NAME || "intern.track";
export const LEGAL_CONTACT_EMAIL = import.meta.env.VITE_LEGAL_CONTACT_EMAIL || "support@example.com";
export const LEGAL_BUSINESS_ADDRESS = import.meta.env.VITE_LEGAL_BUSINESS_ADDRESS || "";
export const LEGAL_EFFECTIVE_DATE = import.meta.env.VITE_POLICY_EFFECTIVE_DATE || "October 7, 2026";
export const MINIMUM_AGE = Number(import.meta.env.VITE_MINIMUM_AGE || 13);
