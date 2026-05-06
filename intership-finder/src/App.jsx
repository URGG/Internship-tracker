import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { BLANK } from "./utils/constants";
import { uid } from "./utils/helpers";
import { API_BASE } from "./config";
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

const normalizeBool = (value) => value === true || value === "true" || value === 1;

const normalizeApp = (app = {}) => {
  const normalized = { ...BLANK, ...app };

  for (const [key, fallback] of Object.entries(BLANK)) {
    if (normalized[key] == null) normalized[key] = fallback;
  }

  normalized.remote = normalizeBool(normalized.remote);
  normalized.follow_up_sent = normalizeBool(normalized.follow_up_sent);
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
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) setIsSignUp(authIntent === "signup");
  }, [show, authIntent]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const endpoint = isSignUp ? "/signup" : "/login";

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      if (isSignUp) {
        toast("Account created! You can now log in.", "#34d399");
        setIsSignUp(false);
      } else {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", data.username);
        setToken(data.access_token);
        toast(`Welcome back, ${data.username}!`, "#5b7fff");
        setShow(false);
      }
    } catch (err) {
      toast(err.message, "#f87171");
    }

    setLoading(false);
  };

  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 400, padding: "32px 40px" }}>
        <button className="closex" style={{ position: "absolute", top: 16, right: 16 }} onClick={() => setShow(false)}>
          <Icon name="close" size={18} />
        </button>
        <div className="sb-logo" style={{ justifyContent: "center", marginBottom: 32 }}>
          <div className="sb-logo-mark"><Icon name="logo" size={16} strokeWidth={2} /></div>
          <div className="sb-logo-text">
            intern<span>.track</span>
          </div>
        </div>

        <h2 style={{ textAlign: "center", marginBottom: 24 }}>{isSignUp ? "Create an Account" : "Welcome Back"}</h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="frow">
            <span className="flbl">Username</span>
            <input className="finp" value={user} onChange={(e) => setUser(e.target.value)} required placeholder="johndoe" />
          </div>
          <div className="frow">
            <span className="flbl">Password</span>
            <input className="finp" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required placeholder="********" />
          </div>
          <button className="mbtn mbtn-p" type="submit" disabled={loading} style={{ marginTop: 12, height: 40 }}>
            {loading ? "Processing..." : isSignUp ? "Sign Up" : "Log In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "var(--txt3)" }}>
          {isSignUp ? "Have an account? " : "Need an account? "}
          <span style={{ color: "var(--acc)", cursor: "pointer", fontWeight: 600 }} onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Log in" : "Sign up"}
          </span>
        </div>
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
      return cached ? JSON.parse(cached) : [];
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
  const [matchData, setMatchData] = useState(null);
  const [matchLoad, setMatchLoad] = useState(false);
  const [followUpOut, setFollowUpOut] = useState("");
  const [followUpLoad, setFollowUpLoad] = useState(false);
  const [jobLinkUrl, setJobLinkUrl] = useState("");
  const [jobLinkLoad, setJobLinkLoad] = useState(false);

  const [intelData, setIntelData] = useState(null);
  const [intelLoad, setIntelLoad] = useState(false);

  const [resumeTxt, setResumeTxt] = useState(() => localStorage.getItem("resumeTxt") || "");
  const [rKey, setRKey] = useState("");
  const [gKey, setGKey] = useState("");

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

  const toast = useCallback((msg, color = "#34d399") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const openAuth = useCallback((intent = "login") => {
    setAuthIntent(intent);
    setShowLogin(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;

    toast(checkout === "success" ? "Payment confirmed. Your plan will update shortly." : "Checkout cancelled", checkout === "success" ? "#34d399" : "#fbbf24");
    window.history.replaceState({}, "", window.location.pathname);
  }, [toast]);

  useEffect(() => {
    localStorage.setItem("resumeTxt", resumeTxt);
  }, [resumeTxt]);

  useEffect(() => {
    localStorage.setItem(APPS_CACHE_KEY, JSON.stringify(apps));
  }, [apps]);

  useEffect(() => {
    localStorage.setItem(SUBS_CACHE_KEY, JSON.stringify(subs));
  }, [subs]);

  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

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
    downloadFile(`intern-track-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(apps, null, 2), "application/json");
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
      localStorage.removeItem(APPS_CACHE_KEY);
      localStorage.removeItem(SUBS_CACHE_KEY);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE}/jobs`, { headers }).then((res) => res.json()),
      fetch(`${API_BASE}/subscriptions`, { headers }).then((res) => res.json()),
    ])
      .then(([jobsData, subsData]) => {
        if (Array.isArray(jobsData)) setApps(jobsData.map(normalizeApp));
        if (Array.isArray(subsData)) setSubs(subsData);
      })
      .catch(() => {
        toast("Using cached jobs while the backend wakes up", "#fbbf24");
      });
  }, [token, toast]);

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
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken(null);
    setApps([]);
    setSubs([]);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Hunter failed");

      if (data.added > 0) {
        const jobsRes = await fetch(`${API_BASE}/jobs`, { headers: authHeaders });
        const jobsData = await jobsRes.json();
        setApps(jobsData.map(normalizeApp));
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
    try {
      const res = await fetch(`${API_BASE}/update-keys`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ rapid_key: rKey, gemini_key: gKey }),
      });
      if (!res.ok) throw new Error("Failed to secure keys");
      toast("Keys encrypted in vault", "#34d399");
      setRKey("");
      setGKey("");
    } catch (e) {
      toast(e.message, "#f87171");
    }
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
      if (!res.ok) throw new Error(data.detail || "Unable to start checkout");
      window.location.assign(data.url);
    } catch (e) {
      toast(e.message, "#f87171");
      setCheckoutLoading(null);
    }
  }, [openAuth, toast, token]);

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Search failed");
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
    } catch (e) {
      toast(e.message, "#f87171");
    } finally {
      setMatchLoad(false);
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

  const stats = useMemo(
    () => ({
      total: apps.length,
      applied: apps.filter((a) => a.status !== "To Do").length,
      ivw: apps.filter((a) => ["Phone Screen", "Interview"].includes(a.status)).length,
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

  const onDrop = async (status) => {
    if (!requireAuth() || dragId == null) return;
    const movingJobId = dragId;
    const targetJob = apps.find((x) => x.id === movingJobId);
    if (!targetJob) return;

    const previousJob = normalizeApp(targetJob);
    const nextPayload = {
      ...previousJob,
      status,
      applied_date: status === "Applied" && !previousJob.applied_date ? new Date().toISOString().slice(0, 10) : previousJob.applied_date,
    };
    const payload = jobPayload(nextPayload);

    setApps((a) => a.map((x) => (x.id === movingJobId ? normalizeApp(payload) : x)));
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
      setApps((a) => a.map((x) => (x.id === movingJobId ? normalizeApp(data) : x)));
    } catch (e) {
      setApps((a) => a.map((x) => (x.id === movingJobId ? previousJob : x)));
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
    { id: "ivw", icon: "interview", label: "Interviews", count: apps.filter((a) => ["Phone Screen", "Interview"].includes(a.status)).length },
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
              <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--txt3)" }}>
                Logged in as <span style={{ color: "var(--txt)", fontWeight: 600 }}>{localStorage.getItem("username")}</span>
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
                setDragId={setDragId}
                reminders={reminders}
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
                <AnalyticsPage apps={apps} onExportCsv={exportJobsCsv} onExportJson={exportJobsJson} />
              </Suspense>
            )}
            {page === "pricing" && (
              <Suspense fallback={<PanelFallback label="Loading pricing..." />}>
                <PricingPage startCheckout={startCheckout} checkoutLoading={checkoutLoading} />
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
                  onExportCsv={exportJobsCsv}
                  onExportJson={exportJobsJson}
                  toast={toast}
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
