import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BLANK } from "./utils/constants";
import { getActionSignal, uid } from "./utils/helpers";
import { API_BASE, TURNSTILE_SITE_KEY } from "./config";
import Icon from "./components/shared/Icon";
import ThemeToggle from "./components/shared/ThemeToggle";
import LandingPage from "./pages/LandingPage";
import TrackerPage from "./pages/TrackerPage";

const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Modal = lazy(() => import("./components/shared/Modal"));

const APPS_CACHE_KEY = "appsCache";
const SUBS_CACHE_KEY = "subsCache";
const WORKSPACE_KEY = "activeWorkspaceId";
const DEFAULT_BILLING = {
  plan: "free",
  subscription_status: "free",
  current_period_end: null,
  ai_used_this_month: 0,
  ai_monthly_limit: 0,
  ai_remaining_this_month: 0,
  ai_included: false,
  ai_server_configured: false,
  has_user_gemini_key: false,
  ai_available: false,
  usage_period: null,
  usage: {},
};

const DEFAULT_PROFILE = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "",
  linkedin_url: "",
  portfolio_url: "",
  github_url: "",
  school: "",
  degree: "",
  major: "",
  graduation_date: "",
  gpa: "",
  work_authorization: "",
  sponsorship: "",
  salary_expectation: "",
  why_company: "",
  why_role: "",
  additional_information: "",
  resume_text: "",
};

const normalizeBool = (value) => value === true || value === "true" || value === 1;
const normalizeStatus = (status) => (status === "Phone Screen" ? "Interview" : status);
const normalizeInterviewStage = (stage) => (stage === "Phone Screen" ? "Recruiter Screen" : stage);

const apiErrorMessage = (response, data, fallback) => {
  const detail = typeof data?.detail === "string" ? data.detail.trim() : "";
  if (detail && !(response.status === 404 && detail.toLowerCase() === "not found")) return detail;
  if (response.status === 401) return "Your session expired. Please log in again.";
  if (response.status === 404) return `${fallback} endpoint was not found (404). Check that the backend URL is correct and deployed.`;
  if (response.status === 502 || response.status === 503) return `${fallback} service is temporarily unavailable. Try again shortly.`;
  return response.status ? `${fallback} failed (HTTP ${response.status}).` : fallback;
};

const normalizeApp = (app = {}) => {
  const normalized = { ...BLANK, ...app };

  for (const [key, fallback] of Object.entries(BLANK)) {
    if (normalized[key] == null) normalized[key] = fallback;
  }

  normalized.remote = normalizeBool(normalized.remote);
  normalized.follow_up_sent = normalizeBool(normalized.follow_up_sent);
  normalized.status = normalizeStatus(normalized.status);
  normalized.interview_stage = normalizeInterviewStage(normalized.interview_stage);
  normalized.activity_log =
    typeof normalized.activity_log === "string"
      ? normalized.activity_log || "[]"
      : JSON.stringify(normalized.activity_log || []);

  return normalized;
};

const jobPayload = (app) => {
  const normalized = normalizeApp(app);
  return Object.fromEntries(Object.keys(BLANK).map((key) => [key, normalized[key]]));
};

const PanelFallback = ({ label = "Loading..." }) => (
  <div className="scard" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center", minHeight: 220, color: "var(--txt3)" }}>
    <div className="spin" />
    {label}
  </div>
);

const LoginModal = ({ show, setShow, setToken, toast, authIntent }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [user, setUser] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (show) {
      setIsSignUp(authIntent === "signup");
      setUser("");
      setEmail("");
      setPass("");
      setTurnstileToken("");
      setShowPassword(false);
      setError("");
    }
  }, [show, authIntent]);

  useEffect(() => {
    if (!show) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) setShow(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, setShow, show]);

  useEffect(() => {
    if (!show || !TURNSTILE_SITE_KEY || !turnstileRef.current) return undefined;
    const renderWidget = () => {
      if (!window.turnstile || !turnstileRef.current) return;
      turnstileRef.current.innerHTML = "";
      setTurnstileToken("");
      window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action: isSignUp ? "signup" : "login",
        callback: (token) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };
    if (window.turnstile) {
      renderWidget();
      return undefined;
    }
    const scriptId = "cloudflare-turnstile-script";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderWidget);
    return () => script.removeEventListener("load", renderWidget);
  }, [isSignUp, show]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const endpoint = isSignUp ? "/signup" : "/login";

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user || null, email: isSignUp ? email : null, password: pass, turnstile_token: turnstileToken || null }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      if (isSignUp) {
        toast("Account created! You can now log in.", "#34d399");
        setUser(user || email);
        setEmail("");
        setPass("");
        setIsSignUp(false);
      } else {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", data.username);
        setToken(data.access_token);
        toast(`Welcome back, ${data.username}!`, "#5b7fff");
        setShow(false);
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
      toast(err.message, "#f87171");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && !loading && setShow(false)}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="closex auth-close" type="button" aria-label="Close authentication dialog" onClick={() => !loading && setShow(false)}>
          <Icon name="close" size={18} />
        </button>
        <div className="sb-logo auth-brand">
          <div className="sb-logo-mark"><Icon name="logo" size={16} strokeWidth={2} /></div>
          <div className="sb-logo-text">
            intern<span>.track</span>
          </div>
        </div>

        <div className="auth-heading">
          <div className="auth-kicker">{isSignUp ? "Set up your workspace" : "Your application workspace"}</div>
          <h2 id="auth-title">{isSignUp ? "Create your account" : "Welcome back"}</h2>
          <p>{isSignUp ? "Track applications, follow-ups, and opportunities in one focused space." : "Sign in to pick up where you left off."}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <label className="frow" htmlFor="auth-email">
              <span className="flbl">Email address</span>
              <input id="auth-email" className="finp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email" autoFocus />
            </label>
          )}
          <label className="frow" htmlFor="auth-identifier">
            <span className="flbl">{isSignUp ? <>Username <span className="auth-optional">optional</span></> : "Email or username"}</span>
            <input id="auth-identifier" className="finp" value={user} onChange={(e) => setUser(e.target.value)} required={!isSignUp} placeholder={isSignUp ? "Choose a handle" : "you@example.com"} autoComplete="username" autoFocus={!isSignUp} />
          </label>
          <div className="frow">
            <label className="flbl" htmlFor="auth-password">Password</label>
            <span className="auth-password-field">
              <input id="auth-password" className="finp" type={showPassword ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} required minLength={8} placeholder="At least 8 characters" autoComplete={isSignUp ? "new-password" : "current-password"} />
              <button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </div>
          {error && <div className="auth-error" id="auth-error" role="alert">{error}</div>}
          {TURNSTILE_SITE_KEY && <div className="auth-turnstile" ref={turnstileRef} />}
          <button className="mbtn mbtn-p auth-submit" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? "Signing you in..." : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-switch-row">
          {isSignUp ? "Have an account? " : "Need an account? "}
          <button className="auth-switch" type="button" onClick={() => { setError(""); setIsSignUp(!isSignUp); }}>
            {isSignUp ? "Log in" : "Sign up"}
          </button>
        </div>
        <div className="auth-footnote">Core tracking is free. No credit card required.</div>
      </div>
    </div>
  );
};

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [showLogin, setShowLogin] = useState(false);
  const [authIntent, setAuthIntent] = useState("login");
  const [apps, setApps] = useState(() => {
    try {
      const cached = localStorage.getItem(APPS_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeApp) : [];
    } catch {
      return [];
    }
  });
  const [view, setView] = useState("board");
  const [page, setPage] = useState(() => (localStorage.getItem("token") ? "tracker" : "landing"));
  const [srcF, setSrcF] = useState("all");
  const [stF, setStF] = useState("all");
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [eid, setEid] = useState(null);

  const [coverApp, setCoverApp] = useState(null);
  const [coverJob, setCoverJob] = useState("");
  const [coverOut, setCoverOut] = useState("");
  const [coverLoad, setCoverLoad] = useState(false);
  const [packetJob, setPacketJob] = useState("");
  const [packetData, setPacketData] = useState(null);
  const [packetLoad, setPacketLoad] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [matchLoad, setMatchLoad] = useState(false);
  const [followUpOut, setFollowUpOut] = useState("");
  const [followUpLoad, setFollowUpLoad] = useState(false);
  const [jobLinkUrl, setJobLinkUrl] = useState("");
  const [jobLinkLoad, setJobLinkLoad] = useState(false);

  const [intelData, setIntelData] = useState(null);
  const [intelLoad, setIntelLoad] = useState(false);

  const [resumeTxt, setResumeTxt] = useState(() => localStorage.getItem("resumeTxt") || "");
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [rKey, setRKey] = useState("");
  const [gKey, setGKey] = useState("");
  const [keysSaving, setKeysSaving] = useState(false);

  const [jsQ, setJsQ] = useState("software engineering intern");
  const [jsLoc, setJsLoc] = useState("Los Angeles, CA");
  const [jsType, setJsType] = useState("INTERN");
  const [jsDate, setJsDate] = useState("month");
  const [jsRes, setJsRes] = useState([]);
  const [jsLoad, setJsLoad] = useState(false);
  const [jsErr, setJsErr] = useState("");
  const [jsAdded, setJsAdded] = useState(new Set());

  const [toasts, setToasts] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [pendingCheckoutPlan, setPendingCheckoutPlan] = useState(null);
  const [subs, setSubs] = useState(() => {
    try {
      const cached = localStorage.getItem(SUBS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [hQ, setHQ] = useState("");
  const [hL, setHL] = useState("");
  const [hLoading, setHLoading] = useState(false);
  const [billing, setBilling] = useState(DEFAULT_BILLING);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => localStorage.getItem(WORKSPACE_KEY) || "");
  const [workspaceMembers, setWorkspaceMembers] = useState([]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => String(workspace.id) === String(activeWorkspaceId)) || null,
    [activeWorkspaceId, workspaces]
  );
  const baseAuthHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const authHeaders = useMemo(
    () => ({
      ...baseAuthHeaders,
      "Content-Type": "application/json",
      ...(activeWorkspaceId ? { "X-Workspace-ID": String(activeWorkspaceId) } : {}),
    }),
    [activeWorkspaceId, baseAuthHeaders]
  );

  const toast = useCallback((msg, color = "#34d399") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const openAuth = useCallback((intent = "login") => {
    setAuthIntent(intent);
    setShowLogin(true);
  }, []);

  const clearAuthSession = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem(APPS_CACHE_KEY);
    localStorage.removeItem(SUBS_CACHE_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
    setToken(null);
    setApps([]);
    setSubs([]);
    setBilling(DEFAULT_BILLING);
    setProfile(DEFAULT_PROFILE);
    setAnalyticsData(null);
    setWorkspaces([]);
    setWorkspaceMembers([]);
    setActiveWorkspaceId("");
  }, []);

  const refreshBilling = useCallback(async () => {
    if (!token) {
      setBilling(DEFAULT_BILLING);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/billing/me`, { headers: authHeaders });
      if (res.ok) setBilling({ ...DEFAULT_BILLING, ...(await res.json()) });
    } catch {
      // Billing status is non-critical for the tracker workflow.
    }
  }, [authHeaders, token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;

    toast(checkout === "success" ? "Payment confirmed. Your plan will update shortly." : "Checkout cancelled", checkout === "success" ? "#34d399" : "#fbbf24");
    if (checkout === "success") refreshBilling();
    window.history.replaceState({}, "", window.location.pathname);
  }, [refreshBilling, toast]);

  useEffect(() => {
    localStorage.setItem("resumeTxt", resumeTxt);
  }, [resumeTxt]);

  useEffect(() => {
    if (!token) {
      setProfile(DEFAULT_PROFILE);
      return undefined;
    }
    let cancelled = false;
    setProfileLoading(true);
    fetch(`${API_BASE}/profile`, { headers: baseAuthHeaders })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          clearAuthSession();
          openAuth("login");
          throw new Error("Session expired");
        }
        if (!res.ok) throw new Error(data.detail || "Profile sync failed");
        if (cancelled) return;
        const nextProfile = { ...DEFAULT_PROFILE, ...(data.profile || {}) };
        setProfile(nextProfile);
        if (nextProfile.resume_text || !localStorage.getItem("resumeTxt")) setResumeTxt(nextProfile.resume_text || "");
      })
      .catch((error) => {
        if (!cancelled && error.message !== "Session expired") toast(error.message || "Profile sync failed", "#fbbf24");
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseAuthHeaders, clearAuthSession, openAuth, token, toast]);

  useEffect(() => {
    localStorage.setItem(APPS_CACHE_KEY, JSON.stringify(apps));
  }, [apps]);

  useEffect(() => {
    localStorage.setItem(SUBS_CACHE_KEY, JSON.stringify(subs));
  }, [subs]);

  const downloadFile = (filename, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportJobsJson = () => {
    const backup = {
      version: 2,
      exported_at: new Date().toISOString(),
      profile: { ...profile, resume_text: resumeTxt },
      applications: apps,
    };
    downloadFile(`intern-track-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
  };

  const importJobsJson = async (file) => {
    if (!requireAuth() || !file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("Backup file is too large", "#f87171");
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      const jobs = Array.isArray(parsed) ? parsed : parsed?.jobs || parsed?.applications;
      if (!Array.isArray(jobs) || jobs.length === 0) throw new Error("Choose an intern.track JSON backup file");

      const res = await fetch(`${API_BASE}/jobs/import`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ jobs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Restore failed");
      if (Array.isArray(data.jobs)) setApps(data.jobs.map(normalizeApp));
      if (parsed?.profile && typeof parsed.profile === "object") {
        const profileRes = await fetch(`${API_BASE}/profile`, {
          method: "PUT",
          headers: { ...baseAuthHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ ...DEFAULT_PROFILE, ...parsed.profile }),
        });
        const profileData = await profileRes.json().catch(() => ({}));
        if (!profileRes.ok) throw new Error(profileData.detail || "Applications restored, but profile restore failed");
        const restoredProfile = { ...DEFAULT_PROFILE, ...(profileData.profile || {}) };
        setProfile(restoredProfile);
        setResumeTxt(restoredProfile.resume_text || "");
      }
      toast(`Restored ${data.added} application${data.added === 1 ? "" : "s"}${data.skipped ? `; skipped ${data.skipped} duplicate${data.skipped === 1 ? "" : "s"}` : ""}`, "#34d399");
    } catch (error) {
      toast(error.message || "Restore failed", "#f87171");
    }
  };

  const exportJobsCsv = () => {
    const headers = [
      "company", "role", "status", "source", "applied_date", "deadline", "location", "remote",
      "link", "notes", "recruiter_name", "recruiter_email", "referral_name", "interview_stage",
      "next_action_date", "follow_up_sent", "last_contact_date", "resume_version", "cover_letter_version"
    ];
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = apps.map((app) => headers.map((header) => escape(app[header])).join(","));
    downloadFile(`intern-track-backup-${new Date().toISOString().slice(0, 10)}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv");
  };

  const requireAuth = () => {
    if (!token) {
      toast("Please log in to use this feature", "#fbbf24");
      openAuth("login");
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!token) {
      setApps([]);
      setSubs([]);
      setBilling(DEFAULT_BILLING);
      setWorkspaces([]);
      setWorkspaceMembers([]);
      setActiveWorkspaceId("");
      setProfile(DEFAULT_PROFILE);
      localStorage.removeItem(APPS_CACHE_KEY);
      localStorage.removeItem(SUBS_CACHE_KEY);
      return;
    }

    let cancelled = false;
    fetch(`${API_BASE}/workspaces`, { headers: baseAuthHeaders })
      .then(async (workspacesRes) => {
        const data = await workspacesRes.json().catch(() => ({}));
        if (workspacesRes.status === 401) {
          clearAuthSession();
          toast("Session expired. Please log in again.", "#fbbf24");
          openAuth("login");
          return;
        }
        if (!workspacesRes.ok) throw new Error(data.detail || "Workspace sync failed");
        if (!Array.isArray(data)) throw new Error("Workspace sync returned an invalid response");
        if (cancelled) return;
        setWorkspaces(data);
        const savedId = localStorage.getItem(WORKSPACE_KEY);
        const selected = data.find((workspace) => String(workspace.id) === String(savedId)) || data[0];
        if (selected) {
          const selectedId = String(selected.id);
          setActiveWorkspaceId(selectedId);
          localStorage.setItem(WORKSPACE_KEY, selectedId);
        }
      })
      .catch((error) => {
        if (!cancelled) toast(`${error.message || "Workspace sync failed"}. Showing cached data.`, "#fbbf24");
      });
    return () => {
      cancelled = true;
    };
  }, [baseAuthHeaders, clearAuthSession, openAuth, token, toast]);

  useEffect(() => {
    if (!token || !activeWorkspaceId) return undefined;
    let cancelled = false;
    const readJson = async (response, label) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `${label} sync failed`);
      return data;
    };
    Promise.all([
      fetch(`${API_BASE}/jobs`, { headers: authHeaders }),
      fetch(`${API_BASE}/subscriptions`, { headers: authHeaders }),
      fetch(`${API_BASE}/billing/me`, { headers: authHeaders }),
    ])
      .then(async ([jobsRes, subsRes, billingRes]) => {
        if (jobsRes.status === 401 || subsRes.status === 401 || billingRes.status === 401) {
          clearAuthSession();
          toast("Session expired. Please log in again.", "#fbbf24");
          openAuth("login");
          return;
        }
        const [jobsData, subsData, billingData] = await Promise.all([
          readJson(jobsRes, "Application"),
          readJson(subsRes, "Saved hunt"),
          readJson(billingRes, "Billing"),
        ]);
        if (cancelled) return;
        if (Array.isArray(jobsData)) setApps(jobsData.map(normalizeApp));
        if (Array.isArray(subsData)) setSubs(subsData);
        if (billingData && typeof billingData === "object") setBilling({ ...DEFAULT_BILLING, ...billingData });
      })
      .catch((error) => {
        if (!cancelled) toast(`${error.message || "Backend sync failed"}. Showing cached data.`, "#fbbf24");
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, authHeaders, clearAuthSession, openAuth, token, toast]);

  useEffect(() => {
    if (!token || !activeWorkspaceId || page !== "settings") {
      setWorkspaceMembers([]);
      return undefined;
    }
    let cancelled = false;
    fetch(`${API_BASE}/workspaces/${activeWorkspaceId}/members`, { headers: authHeaders })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Member list sync failed");
        if (!cancelled && Array.isArray(data)) setWorkspaceMembers(data);
      })
      .catch((error) => {
        if (!cancelled) toast(error.message || "Member list sync failed", "#fbbf24");
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, authHeaders, page, token, toast]);

  useEffect(() => {
    if (!token) return undefined;
    const inviteToken = new URLSearchParams(window.location.search).get("invite");
    if (!inviteToken) return undefined;
    let cancelled = false;
    fetch(`${API_BASE}/workspace-invitations/accept`, {
      method: "POST",
      headers: { ...baseAuthHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ token: inviteToken }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Could not accept invitation");
        if (cancelled) return;
        setWorkspaces((current) => [...current.filter((workspace) => workspace.id !== data.id), data]);
        setActiveWorkspaceId(String(data.id));
        localStorage.setItem(WORKSPACE_KEY, String(data.id));
        toast(`You joined ${data.name}`, "#34d399");
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((error) => {
        if (!cancelled) {
          toast(error.message || "Could not accept invitation", "#f87171");
          window.history.replaceState({}, "", window.location.pathname);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [baseAuthHeaders, token, toast]);

  const selectWorkspace = (workspaceId) => {
    const nextId = String(workspaceId || "");
    setActiveWorkspaceId(nextId);
    setAnalyticsData(null);
    setApps([]);
    setSubs([]);
    setWorkspaceMembers([]);
    if (nextId) localStorage.setItem(WORKSPACE_KEY, nextId);
    else localStorage.removeItem(WORKSPACE_KEY);
  };

  const createWorkspace = async (name) => {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: "POST",
      headers: { ...baseAuthHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not create workspace");
    setWorkspaces((current) => [...current, data]);
    selectWorkspace(data.id);
    toast(`${data.name} is ready`, "#34d399");
    return data;
  };

  const loadWorkspaceMembers = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const res = await fetch(`${API_BASE}/workspaces/${activeWorkspaceId}/members`, { headers: authHeaders });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Member list sync failed");
    if (Array.isArray(data)) setWorkspaceMembers(data);
  }, [activeWorkspaceId, authHeaders]);

  const addWorkspaceMember = async (identifier, role) => {
    const res = await fetch(`${API_BASE}/workspaces/${activeWorkspaceId}/members`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ username: identifier, role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not add member");
    await loadWorkspaceMembers();
    toast(`${data.username} added to the workspace`, "#34d399");
    return data;
  };

  const createWorkspaceInvite = async (email, role) => {
    const res = await fetch(`${API_BASE}/workspaces/${activeWorkspaceId}/invitations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not create invitation");
    try {
      await navigator.clipboard.writeText(data.invite_url);
      toast("Invite link copied", "#34d399");
    } catch {
      toast("Invite created. Copy the link from the workspace panel.", "#fbbf24");
    }
    return data;
  };

  const updateWorkspaceMember = async (userId, role) => {
    const res = await fetch(`${API_BASE}/workspaces/${activeWorkspaceId}/members/${userId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not update member");
    await loadWorkspaceMembers();
    toast("Workspace role updated", "#34d399");
    return data;
  };

  const removeWorkspaceMember = async (userId) => {
    const res = await fetch(`${API_BASE}/workspaces/${activeWorkspaceId}/members/${userId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not remove member");
    await loadWorkspaceMembers();
    toast("Member removed", "#8b91b8");
    return data;
  };

  useEffect(() => {
    if (!token || page !== "analytics") return undefined;
    let cancelled = false;
    fetch(`${API_BASE}/analytics`, { headers: authHeaders })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          clearAuthSession();
          openAuth("login");
          throw new Error("Session expired");
        }
        if (!res.ok) throw new Error(data.detail || "Analytics sync failed");
        if (!cancelled) setAnalyticsData(data);
      })
      .catch((error) => {
        if (!cancelled && error.message !== "Session expired") toast(error.message || "Analytics sync failed", "#fbbf24");
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, apps, authHeaders, clearAuthSession, openAuth, page, token, toast]);

  useEffect(() => {
    if (token && page === "landing") setPage("tracker");
  }, [token, page]);

  const isDuplicate = (job, ignoreId = null) =>
    apps.some((app) => {
      if (ignoreId && app.id === ignoreId) return false;
      if (job.link && app.link && job.link === app.link) return true;
      return app.company.trim().toLowerCase() === job.company.trim().toLowerCase() && app.role.trim().toLowerCase() === job.role.trim().toLowerCase();
    });

  const handleLogout = () => {
    clearAuthSession();
    setPage("landing");
    toast("Logged out securely", "#8b91b8");
  };

  const addHunt = async () => {
    if (!requireAuth() || !hQ.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ query: hQ, location: hL || "Remote", job_type: "INTERN" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add hunt");
      setSubs((s) => [...s, data]);
      setHQ("");
      setHL("");
      toast("Hunt active!");
    } catch (e) {
      toast(e.message, "#f87171");
    }
  };

  const delHunt = async (id) => {
    if (!requireAuth()) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions/${id}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) throw new Error("Failed to remove");
      setSubs((s) => s.filter((x) => x.id !== id));
      toast("Unsubscribed");
    } catch (e) {
      toast(e.message, "#f87171");
    }
  };

  const runHunter = async () => {
    if (!requireAuth()) return;
    setHLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hunter/run`, { method: "POST", headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Auto-hunter"));

      if (data.added > 0) {
        const jobsRes = await fetch(`${API_BASE}/jobs`, { headers: authHeaders });
        const jobsData = await jobsRes.json().catch(() => ({}));
        if (!jobsRes.ok) throw new Error(apiErrorMessage(jobsRes, jobsData, "Application sync"));
        if (!Array.isArray(jobsData)) throw new Error("Application sync returned an invalid response.");
        setApps(jobsData.map(normalizeApp));
      }

      if (data.failures?.length) {
        toast(`${data.added || 0} jobs added; ${data.failures.length} search(es) failed.`, "#fbbf24");
      } else if (data.added > 0) {
        toast(`Found ${data.added} new jobs!`, "#34d399");
      } else {
        toast("No new jobs found today.", "#9b9a97");
      }
    } catch (e) {
      toast(e.message, "#f87171");
    } finally {
      setHLoading(false);
    }
  };

  const saveUserKeys = async () => {
    if (!requireAuth()) return;
    setKeysSaving(true);
    try {
      const res = await fetch(`${API_BASE}/update-keys`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ rapid_key: rKey, gemini_key: gKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Key validation"));
      toast("Keys validated and encrypted", "#34d399");
      setRKey("");
      setGKey("");
      refreshBilling();
    } catch (e) {
      toast(e.message || "Key validation failed", "#f87171");
    } finally {
      setKeysSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!requireAuth()) return;
    setProfileSaving(true);
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: { ...baseAuthHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, resume_text: resumeTxt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not save application profile");
      const savedProfile = { ...DEFAULT_PROFILE, ...(data.profile || {}) };
      setProfile(savedProfile);
      setResumeTxt(savedProfile.resume_text || "");
      toast("Application profile saved", "#34d399");
    } catch (error) {
      toast(error.message || "Could not save application profile", "#f87171");
    } finally {
      setProfileSaving(false);
    }
  };

  const openApplyAssist = (application) => {
    if (!requireAuth()) return;
    if (!application?.link) {
      toast("Add the application link first", "#fbbf24");
      return;
    }
    window.open(application.link, "_blank", "noopener,noreferrer");
    toast("Application opened. Click the intern.track extension to fill supported fields.", "#5b7fff");
  };

  const startCheckout = useCallback(async (planId) => {
    if (planId === "free") {
      toast("You are on the free tracker plan", "#8b91b8");
      return;
    }
    if (!token) {
      setPendingCheckoutPlan(planId);
      toast("Create an account or sign in to continue to Checkout", "#fbbf24");
      openAuth("signup");
      return;
    }

    setCheckoutLoading(planId);
    try {
      const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (res.status === 401) {
        clearAuthSession();
        setPendingCheckoutPlan(planId);
        toast("Session expired. Please log in again to continue to Checkout.", "#fbbf24");
        openAuth("login");
        return;
      }
      if (!res.ok) throw new Error(data.detail || "Unable to start checkout");
      window.location.assign(data.url);
    } catch (e) {
      toast(e.message, "#f87171");
    } finally {
      setCheckoutLoading(null);
    }
  }, [clearAuthSession, openAuth, toast, token]);

  useEffect(() => {
    if (!token || !pendingCheckoutPlan) return;
    const planId = pendingCheckoutPlan;
    setPendingCheckoutPlan(null);
    startCheckout(planId);
  }, [token, pendingCheckoutPlan, startCheckout]);

  const save = async () => {
    if (!requireAuth() || !form.company.trim() || !form.role.trim()) return;
    if (isDuplicate(form, eid)) {
      toast("This application is already being tracked", "#fbbf24");
      return;
    }
    try {
      const method = eid ? "PUT" : "POST";
      const endpoint = eid ? `/jobs/${eid}` : "/jobs";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: authHeaders,
        body: JSON.stringify(jobPayload(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Database error");
      const savedJob = normalizeApp(data);

      if (eid) {
        setApps((a) => a.map((x) => (x.id === eid ? savedJob : x)));
        toast("Updated", "#5b7fff");
      } else {
        setApps((a) => [...a, savedJob]);
        toast("Saved", "#34d399");
      }
      setModal(null);
    } catch (e) {
      toast(e.message, "#f87171");
    }
  };

  const del = async () => {
    if (!requireAuth()) return;
    try {
      const res = await fetch(`${API_BASE}/jobs/${eid}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) throw new Error("Failed to delete");
      setApps((a) => a.filter((x) => x.id !== eid));
      setModal(null);
      toast("Deleted permanently", "#f87171");
    } catch (e) {
      toast(e.message, "#f87171");
    }
  };

  const runSearch = async () => {
    if (!requireAuth()) return;
    setJsLoad(true);
    setJsErr("");
    setJsRes([]);
    try {
      const params = new URLSearchParams({ query: jsQ, location: jsLoc, jobType: jsType, datePosted: jsDate });
      const res = await fetch(`${API_BASE}/search?${params}`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Job search"));
      if (!Array.isArray(data)) throw new Error("Job search returned an invalid response. Try again shortly.");
      setJsRes(data);
      if (data.length === 0) setJsErr("No jobs found.");
    } catch (e) {
      setJsErr(e.message);
      toast(e.message, "#f87171");
    } finally {
      setJsLoad(false);
    }
  };

  const saveSearchJob = async (r) => {
    if (!requireAuth()) return;
    const newJob = {
      ...BLANK,
      company: r.company,
      role: r.role,
      status: "To Do",
      source: r.source || "Search",
      applied_date: "",
      location: r.location,
      remote: r.remote,
      link: r.link,
      notes: `${(r.desc || "").slice(0, 100)}...`,
      next_action_date: new Date().toISOString().slice(0, 10),
    };
    if (isDuplicate(newJob)) {
      toast("This application is already being tracked", "#fbbf24");
      setJsAdded((prev) => new Set([...prev, r._id]));
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/jobs`, { method: "POST", headers: authHeaders, body: JSON.stringify(newJob) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setApps((a) => [...a, normalizeApp(data)]);
      setJsAdded((prev) => new Set([...prev, r._id]));
      toast(`Saved ${r.company} as a lead`);
    } catch (e) {
      toast(e.message || "Failed to add job", "#f87171");
    }
  };

  const genCover = async () => {
    if (!requireAuth()) return;
    setCoverLoad(true);
    setCoverOut("");
    try {
      const res = await fetch(`${API_BASE}/generate-cover`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ company: coverApp.company, role: coverApp.role, description: coverJob || "", context: resumeTxt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "AI generation failed");
      setCoverOut(data.text);
      refreshBilling();
    } catch (e) {
      setCoverOut(e.message);
    }
    setCoverLoad(false);
  };

  const runResumeMatch = async () => {
    if (!requireAuth()) return;
    if (!resumeTxt.trim()) {
      toast("Add your resume text in Settings first", "#fbbf24");
      return;
    }
    setMatchLoad(true);
    setMatchData(null);
    try {
      const res = await fetch(`${API_BASE}/resume-match`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          company: form.company,
          role: form.role,
          description: form.notes || "",
          context: resumeTxt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Resume match failed");
      setMatchData(data);
      refreshBilling();
    } catch (e) {
      toast(e.message, "#f87171");
    } finally {
      setMatchLoad(false);
    }
  };

  const runApplicationPacket = async () => {
    if (!requireAuth()) return;
    if (!resumeTxt.trim()) {
      toast("Add your resume text in Settings first", "#fbbf24");
      return;
    }
    setPacketLoad(true);
    setPacketData(null);
    try {
      const res = await fetch(`${API_BASE}/application-packet`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          application_id: form.id,
          company: form.company,
          role: form.role,
          description: packetJob,
          context: resumeTxt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Application packet failed");
      const serializedPacket = JSON.stringify(data);
      setPacketData(data);
      setForm((current) => ({ ...current, application_packet: serializedPacket }));
      setApps((current) => current.map((app) => (app.id === form.id ? { ...app, application_packet: serializedPacket } : app)));
      refreshBilling();
    } catch (e) {
      toast(e.message || "Application packet failed", "#f87171");
    } finally {
      setPacketLoad(false);
    }
  };

  const runFollowUpDraft = async () => {
    if (!requireAuth()) return;
    if (!resumeTxt.trim()) {
      toast("Add your resume text in Settings first", "#fbbf24");
      return;
    }
    setFollowUpLoad(true);
    setFollowUpOut("");
    try {
      const res = await fetch(`${API_BASE}/generate-followup`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          company: form.company,
          role: form.role,
          status: form.status,
          recruiter_name: form.recruiter_name || "",
          last_contact_date: form.last_contact_date || "",
          next_action_date: form.next_action_date || "",
          notes: form.notes || "",
          context: resumeTxt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Follow-up draft failed");
      setFollowUpOut(data.text);
      refreshBilling();
    } catch (e) {
      toast(e.message, "#f87171");
    } finally {
      setFollowUpLoad(false);
    }
  };

  const autofillJobLink = async () => {
    if (!requireAuth()) return;
    if (!jobLinkUrl.trim()) {
      toast("Paste a job URL first", "#fbbf24");
      return;
    }
    setJobLinkLoad(true);
    try {
      const res = await fetch(`${API_BASE}/autofill-job-link`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url: jobLinkUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      setForm({
        ...BLANK,
        company: data.company || "",
        role: data.role || "",
        source: data.source || "Other",
        location: data.location || "",
        remote: Boolean(data.remote),
        link: data.link || jobLinkUrl,
        notes: data.description || "",
        next_action_date: new Date().toISOString().slice(0, 10),
      });
      setEid(null);
      setModal("edit");
      toast("Job details imported", "#34d399");
    } catch (e) {
      toast(e.message, "#f87171");
    } finally {
      setJobLinkLoad(false);
    }
  };

  const fetchIntel = async (a) => {
    if (!requireAuth()) return;
    setIntelLoad(true);
    setIntelData(null);
    setModal("intel");
    try {
      const res = await fetch(`${API_BASE}/company-intel`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ company: a.company, role: a.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to fetch intel");
      setIntelData(data);
      refreshBilling();
    } catch (e) {
      toast(e.message, "#f87171");
      setModal("edit");
    } finally {
      setIntelLoad(false);
    }
  };

  const filtered = useMemo(
    () =>
      apps.filter((a) => {
        if (srcF !== "all" && a.source !== srcF) return false;
        if (stF !== "all" && a.status !== stF) return false;
        if (q) {
          const lq = q.toLowerCase();
          const haystack = [a.company, a.role, a.recruiter_name, a.recruiter_email, a.interview_stage].join(" ").toLowerCase();
          if (!haystack.includes(lq)) return false;
        }
        return true;
      }),
    [apps, srcF, stF, q]
  );

  const reminders = useMemo(
    () =>
      apps
        .filter((a) => {
          const followUpDue = a.next_action_date && !a.follow_up_sent && new Date(a.next_action_date) <= new Date();
          const deadlineSoon = a.deadline && new Date(a.deadline) <= new Date(Date.now() + 3 * 86400000);
          return followUpDue || deadlineSoon;
        })
        .sort((a, b) => (a.next_action_date || a.deadline || "").localeCompare(b.next_action_date || b.deadline || "")),
    [apps]
  );

  const smartQueue = useMemo(
    () =>
      apps
        .map((app) => ({ app, signal: getActionSignal(app) }))
        .filter((item) => item.signal.score > 0)
        .sort((a, b) => b.signal.score - a.signal.score)
        .slice(0, 8),
    [apps]
  );

  const stats = useMemo(
    () => ({
      total: apps.length,
      applied: apps.filter((a) => a.status !== "To Do").length,
      ivw: apps.filter((a) => a.status === "Interview").length,
      offers: apps.filter((a) => a.status === "Offer").length,
      reminders: reminders.length,
    }),
    [apps, reminders]
  );

  const openAdd = () => {
    if (requireAuth()) {
      setForm({ ...BLANK, next_action_date: new Date().toISOString().slice(0, 10) });
      setEid(null);
      setModal("edit");
    }
  };

  const openEdit = (a) => {
    if (requireAuth()) {
      setForm({ ...BLANK, ...normalizeApp(a) });
      setEid(a.id);
      setModal("edit");
    }
  };

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCover = (a) => {
    if (requireAuth()) {
      setCoverApp(a);
      setCoverOut("");
      setCoverJob("");
      setModal("cover");
    }
  };

  const openApplicationPacket = (a) => {
    if (!requireAuth()) return;
    let savedPacket = null;
    try {
      savedPacket = a.application_packet ? JSON.parse(a.application_packet) : null;
    } catch {
      savedPacket = null;
    }
    setForm({ ...BLANK, ...normalizeApp(a) });
    setPacketJob(a.notes || "");
    setPacketData(savedPacket);
    setPacketLoad(false);
    setModal("packet");
  };

  const openResumeMatch = (a) => {
    if (requireAuth()) {
      setForm({ ...BLANK, ...normalizeApp(a) });
      setMatchData(null);
      setModal("match");
    }
  };

  const openFollowUp = (a) => {
    if (requireAuth()) {
      setForm({ ...BLANK, ...normalizeApp(a) });
      setFollowUpOut("");
      setModal("followup");
    }
  };

  const onDrop = async (status, droppedId = "") => {
    const movingJobId = droppedId || dragId;
    if (!requireAuth() || movingJobId == null || movingJobId === "") return;
    const targetJob = apps.find((x) => String(x.id) === String(movingJobId));
    if (!targetJob) return;
    if (targetJob.status === status) {
      setDragId(null);
      setDragOver(null);
      return;
    }

    const previousJob = normalizeApp(targetJob);
    const nextJob = {
      ...previousJob,
      status,
      applied_date: status === "Applied" && !previousJob.applied_date ? new Date().toISOString().slice(0, 10) : previousJob.applied_date,
    };
    const payload = jobPayload(nextJob);

    setApps((a) => a.map((x) => (String(x.id) === String(movingJobId) ? normalizeApp(nextJob) : x)));
    setDragId(null);
    setDragOver(null);
    toast(`Moved to ${status}`, "#5b7fff");

    try {
      const res = await fetch(`${API_BASE}/jobs/${movingJobId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to sync drag with database");
      setApps((a) => a.map((x) => (String(x.id) === String(movingJobId) ? normalizeApp(data) : x)));
      const jobsRes = await fetch(`${API_BASE}/jobs`, { headers: authHeaders });
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        if (Array.isArray(jobsData)) setApps(jobsData.map(normalizeApp));
      }
    } catch (e) {
      setApps((a) => a.map((x) => (String(x.id) === String(movingJobId) ? previousJob : x)));
      toast(e.message || "Failed to sync drag with database", "#f87171");
    }
  };

  const handleNav = (id) => {
    setPage(["settings", "search", "analytics", "pricing"].includes(id) ? id : "tracker");
    if (["wishlist", "ivw", "offers"].includes(id)) {
      setStF(id === "wishlist" ? "To Do" : id === "ivw" ? "Interview" : "Offer");
    } else {
      setStF("all");
    }
  };

  const navItems = [
    { id: "tracker", icon: "tracker", label: "Tracker", count: apps.length },
    { id: "search", icon: "search", label: "Job Search", count: jsRes.length || null },
    { id: "analytics", icon: "analytics", label: "Analytics", count: null },
    { id: "pricing", icon: "pricing", label: "Pricing", count: null },
    { id: "wishlist", icon: "todo", label: "To Do", count: apps.filter((a) => a.status === "To Do").length },
    { id: "ivw", icon: "interview", label: "Interviews", count: apps.filter((a) => a.status === "Interview").length },
    { id: "offers", icon: "offer", label: "Offers", count: apps.filter((a) => a.status === "Offer").length },
    { id: "settings", icon: "settings", label: "Settings", count: null },
  ];

  if (page === "landing" && !token) {
    return (
      <>
        <LandingPage onStart={() => openAuth("signup")} onLogin={() => openAuth("login")} onOpenApp={() => setPage("tracker")} onCheckout={startCheckout} checkoutLoading={checkoutLoading} />
        <LoginModal show={showLogin} setShow={setShowLogin} setToken={setToken} toast={toast} authIntent={authIntent} />
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              <div className="tdot" style={{ background: t.color }} />
              {t.msg}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="shell">
        <nav className="sb">
          <div className="sb-logo">
            <div className="sb-logo-mark"><Icon name="logo" size={16} strokeWidth={2} /></div>
            <div className="sb-logo-text">
              intern<span>.track</span>
            </div>
          </div>
          <span className="sb-sect">Navigate</span>
          {navItems.slice(0, 4).map((n) => (
            <button key={n.id} className={`sb-btn${page === n.id ? " on" : ""}`} onClick={() => handleNav(n.id)}>
              <span className="sb-icon"><Icon name={n.icon} size={16} /></span>
              {n.label} {n.count !== null && <span className="sb-badge">{n.count}</span>}
            </button>
          ))}
          <div className="sb-div" />
          <span className="sb-sect">Filter by stage</span>
          {navItems.slice(4, 7).map((n) => (
            <button
              key={n.id}
              className={`sb-btn${
                (n.id === "wishlist" && stF === "To Do") || (n.id === "ivw" && stF === "Interview") || (n.id === "offers" && stF === "Offer")
                  ? " on"
                  : ""
              }`}
              onClick={() => handleNav(n.id)}
            >
              <span className="sb-icon"><Icon name={n.icon} size={16} /></span>
              {n.label} <span className="sb-badge">{n.count}</span>
            </button>
          ))}
          <div className="sb-div" />
          <button className={`sb-btn${page === "settings" ? " on" : ""}`} onClick={() => setPage("settings")}>
            <span className="sb-icon"><Icon name="settings" size={16} /></span>Settings
          </button>

          <div style={{ marginTop: "auto" }}>
            {!token ? (
              <button className="sb-btn" onClick={() => openAuth("login")} style={{ color: "var(--acc)", fontWeight: 700 }}>
                <span className="sb-icon"><Icon name="login" size={16} /></span>Sign In
              </button>
            ) : (
              <button className="sb-btn" onClick={handleLogout} style={{ color: "var(--txt3)" }}>
                <span className="sb-icon"><Icon name="logout" size={16} /></span>Log Out
              </button>
            )}
            <button className="sb-add" onClick={openAdd} style={{ marginTop: 12 }}>
              <Icon name="plus" size={16} /> New application
            </button>
          </div>
        </nav>

        <div className="main">
          <div className="topbar">
            <div className="topbar-title">
              {page === "tracker" ? "Tracker" : page === "search" ? "Job Search" : page === "analytics" ? "Analytics" : page === "pricing" ? "Pricing" : "Settings"}
            </div>

            {!token ? (
              <button className="tbtn tbtn-p" onClick={() => openAuth("login")} style={{ marginLeft: "auto" }}>
                Sign In / Sign Up
              </button>
            ) : (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                {workspaces.length > 0 && (
                  <select
                    className="finp"
                    value={activeWorkspaceId}
                    onChange={(event) => selectWorkspace(event.target.value)}
                    aria-label="Active workspace"
                    style={{ minWidth: 150, height: 34, padding: "0 10px" }}
                  >
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                    ))}
                  </select>
                )}
                <div style={{ fontSize: 13, color: "var(--txt3)" }}>
                  {localStorage.getItem("username")} <span style={{ color: "var(--txt3)", fontSize: 11 }}>· {activeWorkspace?.role || "member"}</span>
                </div>
              </div>
            )}

            {page === "tracker" && (
              <div className="sbox">
                <span className="sbox-ico"><Icon name="search" size={14} strokeWidth={2} /></span>
                <input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            )}

            {page === "tracker" && (
              <button className="tbtn tbtn-p" onClick={openAdd}>
                <Icon name="plus" size={15} /> Add
              </button>
            )}

            <ThemeToggle />
          </div>

          <div className="content">
            {page === "tracker" && (
              <TrackerPage
                stats={stats}
                srcF={srcF}
                setSrcF={setSrcF}
                view={view}
                setView={setView}
                filtered={filtered}
                dragOver={dragOver}
                setDragOver={setDragOver}
                onDrop={onDrop}
                openEdit={openEdit}
                openCover={openCover}
                openApplyAssist={openApplyAssist}
                setDragId={setDragId}
                reminders={reminders}
                smartQueue={smartQueue}
              />
            )}
            {page === "search" && (
              <Suspense fallback={<PanelFallback label="Loading search tools..." />}>
                <SearchPage
                  jsQ={jsQ}
                  setJsQ={setJsQ}
                  jsLoc={jsLoc}
                  setJsLoc={setJsLoc}
                  jsType={jsType}
                  setJsType={setJsType}
                  jsDate={jsDate}
                  setJsDate={setJsDate}
                  runSearch={runSearch}
                  jsLoad={jsLoad}
                  jsErr={jsErr}
                  jsRes={jsRes}
                  jsAdded={jsAdded}
                  isTracked={(result) => isDuplicate({ company: result.company, role: result.role, link: result.link })}
                  addFromSearch={saveSearchJob}
                  jobLinkUrl={jobLinkUrl}
                  setJobLinkUrl={setJobLinkUrl}
                  jobLinkLoad={jobLinkLoad}
                  autofillJobLink={autofillJobLink}
                />
              </Suspense>
            )}
            {page === "analytics" && (
              <Suspense fallback={<PanelFallback label="Loading analytics..." />}>
                <AnalyticsPage apps={apps} serverAnalytics={analyticsData} onExportCsv={exportJobsCsv} onExportJson={exportJobsJson} />
              </Suspense>
            )}
            {page === "pricing" && (
              <Suspense fallback={<PanelFallback label="Loading pricing..." />}>
                <PricingPage startCheckout={startCheckout} checkoutLoading={checkoutLoading} billing={billing} />
              </Suspense>
            )}
            {page === "settings" && (
              <Suspense fallback={<PanelFallback label="Loading settings..." />}>
                <SettingsPage
                  rKey={rKey}
                  setRKey={setRKey}
                  gKey={gKey}
                  setGKey={setGKey}
                  resumeTxt={resumeTxt}
                  setResumeTxt={setResumeTxt}
                  profile={profile}
                  setProfile={setProfile}
                  profileLoading={profileLoading}
                  profileSaving={profileSaving}
                  saveProfile={saveProfile}
                  keysSaving={keysSaving}
                  saveUserKeys={saveUserKeys}
                  subs={subs}
                  addHunt={addHunt}
                  delHunt={delHunt}
                  runHunter={runHunter}
                  hQ={hQ}
                  setHQ={setHQ}
                  hL={hL}
                  setHL={setHL}
                  hLoading={hLoading}
                  billing={billing}
                  onExportCsv={exportJobsCsv}
                  onExportJson={exportJobsJson}
                  onImportJson={importJobsJson}
                  toast={toast}
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  activeWorkspace={activeWorkspace}
                  selectWorkspace={selectWorkspace}
                  createWorkspace={createWorkspace}
                  workspaceMembers={workspaceMembers}
                  addWorkspaceMember={addWorkspaceMember}
                  createWorkspaceInvite={createWorkspaceInvite}
                  updateWorkspaceMember={updateWorkspaceMember}
                  removeWorkspaceMember={removeWorkspaceMember}
                />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      <LoginModal show={showLogin} setShow={setShowLogin} setToken={setToken} toast={toast} authIntent={authIntent} />
      {modal && (
        <Suspense fallback={null}>
          <Modal
            modal={modal}
            setModal={setModal}
            form={form}
            setForm={setForm}
            setF={setF}
            eid={eid}
            apps={apps}
            save={save}
            del={del}
            coverApp={coverApp}
            coverJob={coverJob}
            setCoverJob={setCoverJob}
            resumeTxt={resumeTxt}
            setResumeTxt={setResumeTxt}
            coverLoad={coverLoad}
            coverOut={coverOut}
            genCover={genCover}
            openApplyAssist={openApplyAssist}
            openApplicationPacket={openApplicationPacket}
            packetJob={packetJob}
            setPacketJob={setPacketJob}
            packetData={packetData}
            packetLoad={packetLoad}
            runApplicationPacket={runApplicationPacket}
            openCover={openCover}
            openResumeMatch={openResumeMatch}
            openFollowUp={openFollowUp}
            matchData={matchData}
            matchLoad={matchLoad}
            runResumeMatch={runResumeMatch}
            followUpOut={followUpOut}
            followUpLoad={followUpLoad}
            runFollowUpDraft={runFollowUpDraft}
            intelData={intelData}
            intelLoad={intelLoad}
            fetchIntel={fetchIntel}
            toast={toast}
          />
        </Suspense>
      )}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <div className="tdot" style={{ background: t.color }} />
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
