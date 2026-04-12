import { useState, useMemo, useEffect } from "react";
import { STATUSES, BLANK } from "./utils/constants";
import { uid } from "./utils/helpers";
import KanbanBoard from './KanbanBoard';
import ThemeToggle from "./components/shared/ThemeToggle";
import AnalyticsPage from "./pages/AnalyticsPage";
import TrackerPage from "./pages/TrackerPage";
import SearchPage from "./pages/SearchPage";
import SettingsPage from "./pages/SettingsPage";
import Modal from "./components/shared/Modal";

// Changed to localhost to prevent CORS/Fetch errors
const API_BASE = "https://internship-tracker-1-9w2v.onrender.com/api";

// --- LOGIN MODAL COMPONENT ---
const LoginModal = ({ show, setShow, setToken, toast }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const endpoint = isSignUp ? "/signup" : "/login";
    
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
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
        <button className="closex" style={{ position: "absolute", top: 16, right: 16 }} onClick={() => setShow(false)}>×</button>
        <div className="sb-logo" style={{ justifyContent: "center", marginBottom: 32 }}>
          <div className="sb-logo-mark">i</div>
          <div className="sb-logo-text">intern<span>.track</span></div>
        </div>
        
        <h2 style={{ textAlign: "center", marginBottom: 24 }}>{isSignUp ? "Create an Account" : "Welcome Back"}</h2>
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="frow">
            <span className="flbl">Username</span>
            <input className="finp" value={user} onChange={e => setUser(e.target.value)} required placeholder="johndoe" />
          </div>
          <div className="frow">
            <span className="flbl">Password</span>
            <input className="finp" type="password" value={pass} onChange={e => setPass(e.target.value)} required placeholder="••••••••" />
          </div>
          <button className="mbtn mbtn-p" type="submit" disabled={loading} style={{ marginTop: 12, height: 40 }}>
            {loading ? "Processing..." : isSignUp ? "Sign Up ↗" : "Log In ↗"}
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

// --- MAIN APP COMPONENT ---
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [showLogin, setShowLogin] = useState(false);
  
  const [apps, setApps] = useState([]);
  const [view, setView] = useState("board");
  const [page, setPage] = useState("tracker");
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
  
  // Settings & Context
  const [resumeTxt, setResumeTxt] = useState(() => localStorage.getItem("resumeTxt") || "");
  const [rKey, setRKey] = useState("");
  const [gKey, setGKey] = useState("");

  // Search Defaults
  const [jsQ, setJsQ] = useState("software engineering intern");
  const [jsLoc, setJsLoc] = useState("Los Angeles, CA");
  const [jsType, setJsType] = useState("INTERN");
  const [jsDate, setJsDate] = useState("month");
  const [jsRes, setJsRes] = useState([]);
  const [jsLoad, setJsLoad] = useState(false);
  const [jsErr, setJsErr] = useState("");
  const [jsAdded, setJsAdded] = useState(new Set());

  const [toasts, setToasts] = useState([]);

  const toast = (msg, color = "#34d399") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  useEffect(() => { localStorage.setItem("resumeTxt", resumeTxt); }, [resumeTxt]);

  // Fetch Jobs on Login
  useEffect(() => {
    if (!token) { setApps([]); return; }
    fetch(`${API_BASE}/jobs`, { headers: { "Authorization": `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setApps(data); })
      .catch(() => toast("Failed to load jobs", "#f87171"));
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken(null);
    setApps([]);
    setPage("tracker");
    toast("Logged out securely", "#8b91b8");
  };

  const requireAuth = () => {
    if (!token) { toast("Please log in to use this feature", "#fbbf24"); setShowLogin(true); return false; }
    return true;
  };

  // --- API ROUTING ---
  const authHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

  const saveUserKeys = async () => {
    if (!requireAuth()) return;
    try {
      const res = await fetch(`${API_BASE}/update-keys`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ rapid_key: rKey, gemini_key: gKey })
      });
      if (!res.ok) throw new Error("Failed to secure keys");
      toast("Keys encrypted in vault 🔒", "#34d399");
      setRKey(""); setGKey(""); // Clear from memory
    } catch (e) { toast(e.message, "#f87171"); }
  };

  const save = async () => {
    if (!requireAuth() || !form.company.trim()) return;
    try {
      const method = eid ? "PUT" : "POST";
      const endpoint = eid ? `/jobs/${eid}` : `/jobs`;
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method, headers: authHeaders, body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error("Database error");
      const savedJob = await res.json();
      
      if (eid) {
        setApps(a => a.map(x => x.id === eid ? savedJob : x));
        toast("Updated ✓", "#5b7fff");
      } else {
        setApps(a => [...a, savedJob]);
        toast("Saved ✓", "#34d399");
      }
      setModal(null);
    } catch (e) { toast(e.message, "#f87171"); }
  };

  const del = async () => {
    if (!requireAuth()) return;
    try {
      const res = await fetch(`${API_BASE}/jobs/${eid}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) throw new Error("Failed to delete");
      setApps(a => a.filter(x => x.id !== eid));
      setModal(null);
      toast("Deleted permanently", "#f87171");
    } catch (e) { toast(e.message, "#f87171"); }
  };

  const runSearch = async () => {
    if (!requireAuth()) return;
    setJsLoad(true); setJsErr(""); setJsRes([]);
    try {
      const params = new URLSearchParams({ query: jsQ, location: jsLoc, jobType: jsType, datePosted: jsDate });
      const res = await fetch(`${API_BASE}/search?${params}`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Search failed");
      setJsRes(data);
      if (data.length === 0) setJsErr("No jobs found.");
    } catch (e) { setJsErr(e.message); toast(e.message, "#f87171"); }
    finally { setJsLoad(false); }
  };

  const saveSearchJob = async (r) => {
    if (!requireAuth()) return;
    const newJob = { company: r.company, role: r.role, status: "Wishlist", source: r.source, applied_date: new Date().toISOString().slice(0, 10), location: r.location, remote: r.remote, link: r.link, notes: r.desc.slice(0, 100) + "..." };
    try {
      const res = await fetch(`${API_BASE}/jobs`, { method: "POST", headers: authHeaders, body: JSON.stringify(newJob) });
      if (!res.ok) throw new Error("Failed");
      const savedJob = await res.json();
      setApps(a => [...a, savedJob]);
      setJsAdded(new Set([...jsAdded, r._id]));
      toast(`Added ${r.company}`);
    } catch (e) { toast("Failed to add job", "#f87171"); }
  };

  const genCover = async () => {
    if (!requireAuth() || !coverJob.trim()) return;
    setCoverLoad(true); setCoverOut("");
    try {
      const res = await fetch(`${API_BASE}/generate-cover`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ company: coverApp.company, role: coverApp.role, description: coverJob, context: resumeTxt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "AI generation failed");
      setCoverOut(data.text);
    } catch (e) { setCoverOut(e.message); }
    setCoverLoad(false);
  };

  // --- UI LOGIC ---
  const filtered = useMemo(() => apps.filter((a) => {
    if (srcF !== "all" && a.source !== srcF) return false;
    if (stF !== "all" && a.status !== stF) return false;
    if (q) {
      const lq = q.toLowerCase();
      if (!a.company.toLowerCase().includes(lq) && !a.role.toLowerCase().includes(lq)) return false;
    }
    return true;
  }), [apps, srcF, stF, q]);

  const stats = useMemo(() => ({
    total: apps.length,
    applied: apps.filter(a => a.status !== "Wishlist").length,
    ivw: apps.filter(a => ["Phone Screen", "Interview"].includes(a.status)).length,
    offers: apps.filter(a => a.status === "Offer").length,
  }), [apps]);

  const openAdd = () => { if(requireAuth()){ setForm({ ...BLANK, applied_date: new Date().toISOString().slice(0, 10) }); setEid(null); setModal("edit"); }};
  const openEdit = (a) => { if(requireAuth()){ setForm({ ...a }); setEid(a.id); setModal("edit"); }};
  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const openCover = (a) => { if(requireAuth()){ setCoverApp(a); setCoverOut(""); setCoverJob(""); setModal("cover"); }};
  const onDrop = async (status) => {
    if (!requireAuth() || dragId == null) return;
    const targetJob = apps.find(x => x.id === dragId);
    if (!targetJob) return;
    
    // Optimistic UI update
    setApps(a => a.map(x => x.id === dragId ? { ...x, status } : x));
    setDragId(null); setDragOver(null);
    toast(`→ ${status}`, "#5b7fff");
    
    // Sync with backend
    try {
      await fetch(`${API_BASE}/jobs/${targetJob.id}`, {
        method: "PUT", headers: authHeaders, body: JSON.stringify({...targetJob, status})
      });
    } catch { toast("Failed to sync drag with database", "#f87171"); }
  };

  const handleNav = (id) => {
    // FIX: Added "analytics" to the allowed pages array
    setPage(["settings", "search", "analytics"].includes(id) ? id : "tracker");
    
    if (["wishlist", "ivw", "offers"].includes(id)) {
      setStF(id === "wishlist" ? "Wishlist" : id === "ivw" ? "Interview" : "Offer");
    } else { 
      setStF("all"); 
    }
  };

  const navItems = [
    { id: "tracker", icon: "⊞", label: "Tracker", count: apps.length },
    { id: "search", icon: "◎", label: "Job Search", count: jsRes.length || null },
    { id: "analytics", icon: "📊", label: "Analytics", count: null }, // NEW BUTTON HERE
    { id: "wishlist", icon: "◇", label: "Wishlist", count: apps.filter(a => a.status === "Wishlist").length },
    { id: "ivw", icon: "◉", label: "Interviews", count: apps.filter(a => ["Phone Screen", "Interview"].includes(a.status)).length },
    { id: "offers", icon: "✦", label: "Offers", count: apps.filter(a => a.status === "Offer").length },
    { id: "settings", icon: "⚙", label: "Settings", count: null },
  ];
  return (
    <>
      <div className="shell">
        <nav className="sb">
          <div className="sb-logo"><div className="sb-logo-mark">i</div><div className="sb-logo-text">intern<span>.track</span></div></div>
          <span className="sb-sect">Navigate</span>
          {navItems.slice(0, 3).map(n => (
            <button key={n.id} className={`sb-btn${page === n.id ? " on" : ""}`} onClick={() => handleNav(n.id)}>
              <span className="sb-icon">{n.icon}</span>{n.label} {n.count !== null && <span className="sb-badge">{n.count}</span>}
            </button>
          ))}
          <div className="sb-div" /><span className="sb-sect">Filter by stage</span>
          {navItems.slice(3, 6).map(n => (
            <button key={n.id} className={`sb-btn${stF === n.label ? " on" : ""}`} onClick={() => handleNav(n.id)}>
              <span className="sb-icon">{n.icon}</span>{n.label} <span className="sb-badge">{n.count}</span>
            </button>
          ))}
          <div className="sb-div" />
          <button className={`sb-btn${page === "settings" ? " on" : ""}`} onClick={() => setPage("settings")}><span className="sb-icon">⚙</span>Settings</button>
          
          <div style={{ marginTop: "auto" }}>
            {!token ? (
              <button className="sb-btn" onClick={() => setShowLogin(true)} style={{ color: "var(--acc)", fontWeight: 700 }}>
                <span className="sb-icon">→</span>Sign In
              </button>
            ) : (
              <button className="sb-btn" onClick={handleLogout} style={{ color: "var(--txt3)" }}>
                <span className="sb-icon">↩</span>Log Out
              </button>
            )}
            <button className="sb-add" onClick={openAdd} style={{ marginTop: 12 }}>+ New application</button>
          </div>
        </nav>

        <div className="main">
          
          <div className="topbar">
            <div className="topbar-title">
              {page === "tracker" ? "Tracker" : page === "search" ? "Job Search" : "Settings"}
            </div>
            
            {!token ? (
               <button className="tbtn tbtn-p" onClick={() => setShowLogin(true)} style={{ marginLeft: "auto" }}>
                 Sign In / Sign Up
               </button>
            ) : (
              <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--txt3)" }}>
                Logged in as <span style={{color: "var(--txt)", fontWeight: 600}}>{localStorage.getItem("username")}</span>
              </div>
            )}

            {page === "tracker" && (
              <div className="sbox">
                <span className="sbox-ico">⌕</span>
                <input placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} />
              </div>
            )}
            
            {page === "tracker" && (
              <button className="tbtn tbtn-p" onClick={openAdd}>+ Add</button>
            )}

            <ThemeToggle />
          </div>

          <div className="content">
            {page === "tracker" && <KanbanBoard filtered={filtered} setDragId={setDragId} onDrop={onDrop} openEdit={openEdit} />}
            {page === "search" && <SearchPage jsQ={jsQ} setJsQ={setJsQ} jsLoc={jsLoc} setJsLoc={setJsLoc} jsType={jsType} setJsType={setJsType} jsDate={jsDate} setJsDate={setJsDate} runSearch={runSearch} jsLoad={jsLoad} jsErr={jsErr} jsRes={jsRes} jsAdded={jsAdded} addFromSearch={saveSearchJob} />}
            {page === "analytics" && <AnalyticsPage apps={apps} />}
            {page === "settings" && <SettingsPage rKey={rKey} setRKey={setRKey} gKey={gKey} setGKey={setGKey} resumeTxt={resumeTxt} setResumeTxt={setResumeTxt} saveUserKeys={saveUserKeys} />}
          </div>

        </div>
      </div>

      <LoginModal show={showLogin} setShow={setShowLogin} setToken={setToken} toast={toast} />
      <Modal modal={modal} setModal={setModal} form={form} setForm={setForm} setF={setF} eid={eid} apps={apps} save={save} del={del} coverApp={coverApp} coverJob={coverJob} setCoverJob={setCoverJob} resumeTxt={resumeTxt} setResumeTxt={setResumeTxt} coverLoad={coverLoad} coverOut={coverOut} setCoverOut={setCoverOut} genCover={genCover} openCover={openCover} toast={toast} />
      <div className="toasts">{toasts.map(t => (<div key={t.id} className="toast"><div className="tdot" style={{ background: t.color }} />{t.msg}</div>))}</div>
    </>
  );
}