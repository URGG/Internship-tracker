import React, { useEffect, useState } from "react";
import { API_BASE } from "../../config";

export default function PrivacyCenter({ authHeaders, toast, onAccountDeleted }) {
  const [preferences, setPreferences] = useState({ analytics: false, marketing: false, personalized_search: true });
  const [sessions, setSessions] = useState([]);
  const [privacyRequests, setPrivacyRequests] = useState([]);
  const [security, setSecurity] = useState(null);
  const [requestType, setRequestType] = useState("access");
  const [requestDetails, setRequestDetails] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetup, setMfaSetup] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState("");

  const call = async (path, options = {}) => {
    const endpoint = path.startsWith("/api") ? path.slice(4) : path;
    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers: { ...authHeaders, ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Request failed");
    return data;
  };

  const load = async () => {
    try {
      const [pref, sessionList, status, requests] = await Promise.all([
        call("/api/privacy/preferences"),
        call("/api/security/sessions"),
        call("/api/security/status"),
        call("/api/privacy/requests"),
      ]);
      setPreferences(pref);
      setSessions(Array.isArray(sessionList) ? sessionList : []);
      setSecurity(status);
      setPrivacyRequests(Array.isArray(requests) ? requests : []);
    } catch (error) {
      toast(error.message || "Could not load privacy settings", "#f87171");
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (name, action, success) => {
    setBusy(name);
    try {
      const result = await action();
      if (success) toast(success, "#34d399");
      return result === false ? false : true;
    } catch (error) {
      toast(error.message || "Request failed", "#f87171");
      return false;
    } finally {
      setBusy("");
    }
  };

  const exportData = async () => {
    setBusy("export");
    try {
      const data = await call("/api/privacy/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `intern-track-personal-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast("Personal data export downloaded", "#34d399");
    } catch (error) {
      toast(error.message || "Export failed", "#f87171");
    } finally {
      setBusy("");
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm("Delete your account and associated personal data? This cannot be undone.")) return;
    const deleted = await run("delete", () => call("/api/privacy/account", {
      method: "DELETE",
      body: JSON.stringify({ password: deletePassword, confirmation: deleteConfirmation }),
      headers: { "Content-Type": "application/json" },
    }), "Account deleted");
    if (deleted && onAccountDeleted) onAccountDeleted();
  };

  return (
    <>
      <div className="scard">
        <h3>Privacy Center</h3>
        <p style={{ fontSize: 12, color: "var(--txt2)" }}>Control optional processing, download your data, and submit privacy requests. Product-usage analytics stays off until you opt in; search, tracker, security, and billing data needed to provide the service remain enabled.</p>
        <div style={{ display: "grid", gap: 9, marginTop: 16 }}>
          {[['analytics', 'Product analytics', 'Allow optional usage analytics.'], ['marketing', 'Marketing messages', 'Allow optional product updates and promotions.'], ['personalized_search', 'Personalized search', 'Use your saved preferences to improve search suggestions.']].map(([key, label, detail]) => (
            <label key={key} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12, color: "var(--txt2)" }}>
              <input type="checkbox" checked={Boolean(preferences[key])} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))} style={{ marginTop: 2 }} />
              <span><strong style={{ color: "var(--txt)" }}>{label}</strong><br />{detail}</span>
            </label>
          ))}
        </div>
        <button className="mbtn mbtn-p" style={{ marginTop: 14 }} disabled={busy === "preferences"} onClick={() => run("preferences", () => call("/api/privacy/preferences", { method: "PUT", body: JSON.stringify(preferences), headers: { "Content-Type": "application/json" } }), "Privacy preferences saved")}>Save privacy preferences</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button className="mbtn" disabled={busy === "export"} onClick={exportData}>{busy === "export" ? "Preparing..." : "Download personal data"}</button>
          <select className="finp" value={requestType} onChange={(event) => setRequestType(event.target.value)} aria-label="Privacy request type">
            <option value="access">Request access</option><option value="correct">Request correction</option><option value="delete">Request deletion</option><option value="opt_out">Opt out of sale/sharing</option><option value="limit">Limit sensitive data</option>
          </select>
          <button className="mbtn" onClick={() => run("request", () => call("/api/privacy/requests", { method: "POST", body: JSON.stringify({ request_type: requestType, details: requestDetails }), headers: { "Content-Type": "application/json" } }), "Privacy request submitted").then(load)}>Submit request</button>
        </div>
        <textarea className="finp fta" value={requestDetails} onChange={(event) => setRequestDetails(event.target.value)} placeholder="Optional details for your privacy request" style={{ marginTop: 10, minHeight: 70 }} />
        {privacyRequests.length > 0 && <div style={{ marginTop: 14, display: "grid", gap: 6 }}>{privacyRequests.slice(0, 5).map((request) => <div key={request.id} className="link-row"><span style={{ fontSize: 12 }}>{request.request_type}</span><span className="tag t-ot">{request.status}</span></div>)}</div>}
      </div>

      <div className="scard">
        <h3>Security</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)" }}>Email verification: {security?.email_verified ? "verified" : "not verified"} · MFA: {security?.mfa_enabled ? "enabled" : "not enabled"}</p>
        {security && !security.email_verified && security.email_verification_required && <button className="mbtn" style={{ marginTop: 10 }} onClick={() => run("verify-email", () => call("/api/security/email/resend", { method: "POST" }), "Verification email sent")}>Resend verification email</button>}
        <div className="srow" style={{ marginTop: 14 }}><label>Current password</label><input className="finp" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
        <div className="srow"><label>New password</label><input className="finp" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
        <button className="mbtn" disabled={!currentPassword || !newPassword || busy === "password"} onClick={() => run("password", () => call("/api/security/change-password", { method: "POST", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }), headers: { "Content-Type": "application/json" } }), "Password changed. Sign in again.")}>Change password</button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--b0)" }}>
          <strong style={{ fontSize: 13 }}>Multi-factor authentication</strong>
          <p style={{ fontSize: 12, color: "var(--txt3)", marginTop: 6 }}>MFA is optional and can be added after you sign in. Use an authenticator app, then verify the first code before enabling it.</p>
          {!security?.mfa_enabled && <button className="mbtn" disabled={busy === "mfa-setup"} onClick={() => run("mfa-setup", async () => setMfaSetup(await call("/api/security/mfa/setup")), "MFA setup ready")}>{busy === "mfa-setup" ? "Preparing..." : "Set up MFA"}</button>}
          {mfaSetup && !security?.mfa_enabled && <div className="note" style={{ marginTop: 10, wordBreak: "break-all" }}>Secret: {mfaSetup.secret}<br />URI: {mfaSetup.otpauth_url}</div>}
          {(mfaSetup || security?.mfa_enabled) && <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><input className="finp" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" inputMode="numeric" maxLength={6} /><button className="mbtn" disabled={mfaCode.length !== 6 || busy === "mfa"} onClick={() => run("mfa", async () => { const result = await call(`/api/security/mfa/${security?.mfa_enabled ? "disable" : "enable"}?code=${encodeURIComponent(mfaCode)}`, { method: "POST" }); setMfaCode(""); if (security?.mfa_enabled) setMfaSetup(null); return result; }, security?.mfa_enabled ? "MFA disabled" : "MFA enabled").then(load)}> {busy === "mfa" ? "Saving..." : security?.mfa_enabled ? "Disable MFA" : "Enable MFA"}</button></div>}
        </div>
      </div>

      <div className="scard">
        <h3>Active sessions</h3>
        <div style={{ display: "grid", gap: 7, marginTop: 12 }}>{sessions.map((session) => <div key={session.id} className="link-row"><div style={{ flex: 1 }}><strong style={{ fontSize: 12 }}>{session.current ? "Current session" : "Signed-in device"}</strong><div style={{ fontSize: 11, color: "var(--txt3)" }}>{session.user_agent} · last active {session.last_seen_at}</div></div>{!session.current && <button className="mbtn-d" onClick={() => run(`session-${session.id}`, () => call(`/api/security/sessions/${session.id}`, { method: "DELETE" }), "Session revoked").then(load)}>Revoke</button>}</div>)}{sessions.length === 0 && <div className="note">No active sessions found.</div>}</div>
      </div>

      <div className="scard" style={{ borderColor: "rgba(248,113,113,.35)" }}>
        <h3>Delete account</h3>
        <p style={{ fontSize: 12, color: "var(--txt2)" }}>This permanently deletes your account, profile, applications, privacy records, sessions, and owned workspace data. Transfer shared workspace ownership first.</p>
        <div className="srow"><label>Password</label><input className="finp" type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></div>
        <div className="srow"><label>Type confirmation</label><input className="finp" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="DELETE username" /></div>
        <button className="mbtn-d" disabled={!deletePassword || !deleteConfirmation || busy === "delete"} onClick={deleteAccount}>{busy === "delete" ? "Deleting..." : "Delete account permanently"}</button>
      </div>
    </>
  );
}
