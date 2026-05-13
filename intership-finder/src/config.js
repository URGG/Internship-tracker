const DEFAULT_API_BASE = import.meta.env.PROD
  ? "https://internship-tracker-1-9w2v.onrender.com/api"
  : "http://localhost:8000/api";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, "");
