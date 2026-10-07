import React, { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Autocomplete from "../components/shared/Autocomplete";
import Icon from "../components/shared/Icon";
import PrivacyCenter from "../components/shared/PrivacyCenter";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function SettingsPage({
  rKey,
  setRKey,
  gKey,
  setGKey,
  resumeTxt,
  setResumeTxt,
  profile,
  setProfile,
  profileLoading,
  profileSaving,
  saveProfile,
  keysSaving,
  saveUserKeys,
  subs,
  addHunt,
  delHunt,
  runHunter,
  hQ,
  setHQ,
  hL,
  setHL,
  hLoading,
  billing,
  onExportCsv,
  onExportJson,
  onImportJson,
  toast,
  workspaces,
  activeWorkspaceId,
  activeWorkspace,
  selectWorkspace,
  createWorkspace,
  workspaceMembers,
  addWorkspaceMember,
  createWorkspaceInvite,
  updateWorkspaceMember,
  removeWorkspaceMember,
  authHeaders,
  onAccountDeleted,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const fileInputRef = useRef(null);
  const backupInputRef = useRef(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [workspaceAction, setWorkspaceAction] = useState("");
  const planLabel = billing?.plan ? billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1) : "Free";
  const aiLimit = billing?.ai_monthly_limit || 0;
  const aiUsed = billing?.ai_used_this_month || 0;
  const aiRemaining = billing?.ai_remaining_this_month || 0;
  const productUsage = billing?.usage?.product || {};
  const usageRows = [
    ["Applications added", productUsage.application_created || 0],
    ["Applications updated", productUsage.application_updated || 0],
    ["Job searches", productUsage.job_search || 0],
    ["Hunter runs", productUsage.hunter_run || 0],
    ["Hunter jobs added", productUsage.hunter_jobs_added || 0],
    ["Restored records", productUsage.json_restore || 0],
  ];
  const canManageWorkspace = ["owner", "admin"].includes(activeWorkspace?.role);
  const setProfileField = (field) => (event) => setProfile((current) => ({ ...current, [field]: event.target.value }));

  const runWorkspaceAction = async (key, action, successMessage) => {
    setWorkspaceAction(key);
    try {
      await action();
      if (successMessage) toast?.(successMessage, "#34d399");
    } catch (error) {
      toast?.(error.message || "Workspace action failed", "#f87171");
    } finally {
      setWorkspaceAction("");
    }
  };

  const processResumeFile = async (file) => {
    if (!file || (file.type !== "application/pdf" && !file.name?.toLowerCase().endsWith(".pdf"))) {
      toast?.("Please choose a valid PDF file", "#fbbf24");
      return;
    }

    setIsReading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let extractedText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        extractedText += `${textContent.items.map((item) => item.str).join(" ")}\n\n`;
      }

      const cleanedText = extractedText.trim();
      const wasTrimmed = cleanedText.length > 30000;
      setResumeTxt(cleanedText.slice(0, 30000));
      if (wasTrimmed) {
        toast?.("Resume text was trimmed to 30,000 characters", "#fbbf24");
        return;
      }
      toast?.("Resume text extracted", "#34d399");
    } catch {
      toast?.("Failed to read the PDF. Make sure it is a text-based PDF.", "#f87171");
    } finally {
      setIsReading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    await processResumeFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = async (e) => {
    await processResumeFile(e.target.files?.[0]);
    e.target.value = "";
  };

  return (
      <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: "40px" }}>
      <PrivacyCenter authHeaders={authHeaders} toast={toast} onAccountDeleted={onAccountDeleted} />
      <div className="scard">
        <h3>Free Mode</h3>
        <p style={{ fontSize: 12, color: "var(--txt2)", marginBottom: 12 }}>
          The tracker works without any API keys. Applications, reminders, analytics, timeline, and exports are all available for free.
        </p>
        <div className="note" style={{ marginTop: 0 }}>
          Add your own keys only if you want advanced extras like live job search, AI cover letters, resume match, follow-up drafts, company intel, or auto-hunter.
        </div>
      </div>

      <div className="scard">
        <h3>Workspace</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 14 }}>
          Keep applications, saved hunts, usage, and analytics together for a team. You can switch workspaces from the top bar.
        </p>
        <div className="srow" style={{ alignItems: "center" }}>
          <label>Active workspace</label>
          <select className="finp" value={activeWorkspaceId} onChange={(event) => selectWorkspace(event.target.value)}>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input className="finp" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="New workspace name" style={{ flex: "1 1 220px" }} />
          <button
            className="mbtn"
            disabled={!workspaceName.trim() || workspaceAction === "create"}
            onClick={() => runWorkspaceAction("create", async () => {
              await createWorkspace(workspaceName.trim());
              setWorkspaceName("");
            })}
          >
            {workspaceAction === "create" ? "Creating..." : "Create workspace"}
          </button>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--b0)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--txt3)", textTransform: "uppercase", letterSpacing: ".08em" }}>Members</div>
            <span style={{ fontSize: 11, color: "var(--txt3)" }}>{activeWorkspace?.member_count || workspaceMembers.length} active</span>
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {workspaceMembers.map((member) => (
              <div key={member.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", border: "1px solid var(--b0)", borderRadius: "var(--r)", background: "var(--s2)" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {member.username}{member.is_current_user ? " · you" : ""}
                  </div>
                  {member.email && <div style={{ fontSize: 11, color: "var(--txt3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.email}</div>}
                </div>
                <select
                  className="finp"
                  value={member.role}
                  disabled={!canManageWorkspace || member.role === "owner" || workspaceAction === `role-${member.user_id}`}
                  onChange={(event) => runWorkspaceAction(`role-${member.user_id}`, () => updateWorkspaceMember(member.user_id, event.target.value))}
                  style={{ width: 110, height: 32, padding: "0 8px" }}
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                {canManageWorkspace && member.role !== "owner" && (
                  <button className="closex" title="Remove member" disabled={workspaceAction === `remove-${member.user_id}`} onClick={() => runWorkspaceAction(`remove-${member.user_id}`, () => removeWorkspaceMember(member.user_id))}>
                    <Icon name="close" size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {canManageWorkspace && (
          <>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <input className="finp" value={memberIdentifier} onChange={(event) => setMemberIdentifier(event.target.value)} placeholder="Existing username or email" style={{ flex: "1 1 220px" }} />
              <select className="finp" value={memberRole} onChange={(event) => setMemberRole(event.target.value)} style={{ width: 110 }}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                className="mbtn"
                disabled={!memberIdentifier.trim() || workspaceAction === "add"}
                onClick={() => runWorkspaceAction("add", async () => {
                  await addWorkspaceMember(memberIdentifier.trim(), memberRole);
                  setMemberIdentifier("");
                })}
              >
                {workspaceAction === "add" ? "Adding..." : "Add member"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <input className="finp" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Invite by email" style={{ flex: "1 1 220px" }} />
              <select className="finp" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} style={{ width: 110 }}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                className="mbtn mbtn-p"
                disabled={!inviteEmail.trim() || workspaceAction === "invite"}
                onClick={() => runWorkspaceAction("invite", async () => {
                  const invitation = await createWorkspaceInvite(inviteEmail.trim(), inviteRole);
                  setLastInviteUrl(invitation.invite_url);
                  setInviteEmail("");
                })}
              >
                {workspaceAction === "invite" ? "Creating..." : "Create invite"}
              </button>
            </div>
            {lastInviteUrl && (
              <div className="note" style={{ marginTop: 10, wordBreak: "break-all" }}>
                Invite link: <span style={{ color: "var(--txt)" }}>{lastInviteUrl}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="scard">
        <h3>Plan and AI Usage</h3>
        <p style={{ fontSize: 12, color: "var(--txt2)", marginBottom: 12 }}>
          Current plan: <strong style={{ color: "var(--txt)" }}>{planLabel}</strong>
          {billing?.subscription_status ? ` | ${billing.subscription_status}` : ""}
        </p>
        {aiLimit > 0 ? (
          <div className="note" style={{ marginTop: 0 }}>
            Built-in AI usage this month: {aiUsed} / {aiLimit}. Remaining: {aiRemaining}.
          </div>
        ) : (
          <div className="note" style={{ marginTop: 0 }}>
            Built-in AI is included on Pro and Lifetime. Free users can still add a Gemini key below.
          </div>
        )}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--b0)" }}>
          <div style={{ fontSize: 11, color: "var(--txt3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 9 }}>
            Activity this month {billing?.usage_period ? `· ${billing.usage_period}` : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
            {usageRows.map(([label, value]) => (
              <div key={label} style={{ background: "var(--s2)", border: "1px solid var(--b0)", borderRadius: "var(--r)", padding: "10px 12px" }}>
                <div style={{ color: "var(--txt3)", fontSize: 10, marginBottom: 5 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="scard">
        <h3>Optional API Keys</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16 }}>
          Keys are optional. They are encrypted in the database and never stored in plain text.
        </p>
        <div className="srow">
          <label>RapidAPI Key</label>
          <input type="password" value={rKey} onChange={(e) => setRKey(e.target.value)} placeholder="Paste JSearch key here..." autoComplete="off" spellCheck="false" />
        </div>
        <div className="note" style={{ marginBottom: 14 }}>
          Used for: JSearch live search and auto-hunter. Paste the raw RapidAPI key (without “Bearer ”). Saving runs a small JSearch validation request. USAJOBS results can be enabled by the service administrator.
        </div>
        <div className="srow">
          <label>Gemini API Key</label>
          <input type="password" value={gKey} onChange={(e) => setGKey(e.target.value)} placeholder="Paste Gemini key here..." autoComplete="off" spellCheck="false" />
        </div>
        <div className="note" style={{ marginBottom: 14 }}>
          Used for: AI cover letters, resume match, follow-up drafts, and company intel. Saving runs a small Gemini validation request.
        </div>
        <button className="mbtn mbtn-p" onClick={saveUserKeys} disabled={keysSaving} style={{ marginTop: 12 }}>
          {keysSaving ? "Validating keys..." : "Validate and Save Keys"}
        </button>
      </div>

      <div className="scard">
        <h3>Backup and Export</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16 }}>Export a spreadsheet, or restore an intern.track JSON backup without re-entering everything.</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="mbtn" onClick={onExportCsv}>Export CSV</button>
          <button className="mbtn mbtn-p" onClick={onExportJson}>Backup JSON</button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              onImportJson(event.target.files?.[0]);
              event.target.value = "";
            }}
            style={{ display: "none" }}
          />
          <button className="mbtn" onClick={() => backupInputRef.current?.click()}>Restore JSON</button>
        </div>
      </div>

      <div className="scard">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <h3>Application Profile</h3>
            <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16, maxWidth: 650 }}>
              Fill this out once. The browser helper uses these details to pre-fill supported application forms. Review every answer before submitting.
            </p>
          </div>
          {profileLoading && <span className="tag t-ot">Syncing...</span>}
        </div>

        <div className="fg2">
          <div className="frow">
            <span className="flbl">First name</span>
            <input className="finp" value={profile?.first_name || ""} onChange={setProfileField("first_name")} placeholder="Alex" />
          </div>
          <div className="frow">
            <span className="flbl">Last name</span>
            <input className="finp" value={profile?.last_name || ""} onChange={setProfileField("last_name")} placeholder="Johnson" />
          </div>
          <div className="frow">
            <span className="flbl">Email</span>
            <input className="finp" type="email" value={profile?.email || ""} onChange={setProfileField("email")} placeholder="alex@example.com" />
          </div>
          <div className="frow">
            <span className="flbl">Phone</span>
            <input className="finp" type="tel" value={profile?.phone || ""} onChange={setProfileField("phone")} placeholder="(555) 555-0100" />
          </div>
          <div className="frow">
            <span className="flbl">Street address</span>
            <input className="finp" value={profile?.address || ""} onChange={setProfileField("address")} placeholder="123 Main Street" />
          </div>
          <div className="frow">
            <span className="flbl">City</span>
            <input className="finp" value={profile?.city || ""} onChange={setProfileField("city")} placeholder="Los Angeles" />
          </div>
          <div className="frow">
            <span className="flbl">State / region</span>
            <input className="finp" value={profile?.state || ""} onChange={setProfileField("state")} placeholder="CA" />
          </div>
          <div className="frow">
            <span className="flbl">ZIP / postal code</span>
            <input className="finp" value={profile?.zip_code || ""} onChange={setProfileField("zip_code")} placeholder="90001" />
          </div>
          <div className="frow">
            <span className="flbl">Country</span>
            <input className="finp" value={profile?.country || ""} onChange={setProfileField("country")} placeholder="United States" />
          </div>
        </div>

        <div className="fg2">
          <div className="frow">
            <span className="flbl">LinkedIn</span>
            <input className="finp" type="url" value={profile?.linkedin_url || ""} onChange={setProfileField("linkedin_url")} placeholder="https://linkedin.com/in/you" />
          </div>
          <div className="frow">
            <span className="flbl">Portfolio / website</span>
            <input className="finp" type="url" value={profile?.portfolio_url || ""} onChange={setProfileField("portfolio_url")} placeholder="https://your-site.com" />
          </div>
          <div className="frow">
            <span className="flbl">GitHub</span>
            <input className="finp" type="url" value={profile?.github_url || ""} onChange={setProfileField("github_url")} placeholder="https://github.com/you" />
          </div>
          <div className="frow">
            <span className="flbl">School</span>
            <input className="finp" value={profile?.school || ""} onChange={setProfileField("school")} placeholder="State University" />
          </div>
          <div className="frow">
            <span className="flbl">Degree / major</span>
            <input className="finp" value={profile?.degree || ""} onChange={setProfileField("degree")} placeholder="B.S. Computer Science" />
          </div>
          <div className="frow">
            <span className="flbl">Major / field of study</span>
            <input className="finp" value={profile?.major || ""} onChange={setProfileField("major")} placeholder="Computer Science" />
          </div>
          <div className="frow">
            <span className="flbl">Graduation date</span>
            <input className="finp" value={profile?.graduation_date || ""} onChange={setProfileField("graduation_date")} placeholder="May 2027" />
          </div>
          <div className="frow">
            <span className="flbl">GPA (optional)</span>
            <input className="finp" value={profile?.gpa || ""} onChange={setProfileField("gpa")} placeholder="3.7 / 4.0" />
          </div>
        </div>

        <div className="fg2">
          <div className="frow">
            <span className="flbl">Work authorization</span>
            <input className="finp" value={profile?.work_authorization || ""} onChange={setProfileField("work_authorization")} placeholder="Authorized to work in the U.S." />
          </div>
          <div className="frow">
            <span className="flbl">Sponsorship answer</span>
            <input className="finp" value={profile?.sponsorship || ""} onChange={setProfileField("sponsorship")} placeholder="No sponsorship required" />
          </div>
          <div className="frow">
            <span className="flbl">Salary expectation</span>
            <input className="finp" value={profile?.salary_expectation || ""} onChange={setProfileField("salary_expectation")} placeholder="Open to market rate" />
          </div>
        </div>

        <div className="fg2">
          <div className="frow">
            <span className="flbl">Why this company?</span>
            <textarea className="finp fta" value={profile?.why_company || ""} onChange={setProfileField("why_company")} placeholder="A reusable starting point for application questions..." style={{ minHeight: 90 }} />
          </div>
          <div className="frow">
            <span className="flbl">Why this role?</span>
            <textarea className="finp fta" value={profile?.why_role || ""} onChange={setProfileField("why_role")} placeholder="What interests you about this kind of work?" style={{ minHeight: 90 }} />
          </div>
        </div>

        <div className="frow">
          <span className="flbl">Other reusable information</span>
          <textarea className="finp fta" value={profile?.additional_information || ""} onChange={setProfileField("additional_information")} placeholder="Projects, availability, certifications, or other answers you often reuse..." style={{ minHeight: 100 }} />
        </div>
        <div className="note" style={{ marginTop: 12 }}>
          Sensitive demographic and identity questions are intentionally not auto-filled. You should answer those yourself for each employer.
        </div>
        <button className="mbtn mbtn-p" onClick={saveProfile} disabled={profileSaving || profileLoading} style={{ marginTop: 14 }}>
          {profileSaving ? "Saving profile..." : "Save application profile"}
        </button>
      </div>

      <div className="scard">
        <h3>Your Background</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16 }}>
          Drop your PDF resume here so the optional AI tools can use it as context. You can still use the tracker without this.
        </p>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? "var(--acc)" : "var(--b0)"}`,
            backgroundColor: isDragging ? "rgba(255,255,255,0.02)" : "var(--s2)",
            borderRadius: "var(--r)",
            padding: "40px 20px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            marginBottom: "16px",
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} style={{ display: "none" }} />
          {isReading ? (
            <div style={{ color: "var(--txt2)", fontSize: "14px", fontWeight: "600" }}>
              <div className="spin" style={{ margin: "0 auto 10px auto" }}></div>
              Extracting text...
            </div>
          ) : (
            <div style={{ color: isDragging ? "var(--acc)" : "var(--txt3)", fontSize: "14px", fontWeight: "600" }}>
              <span style={{ display: "inline-flex", marginBottom: "10px" }}><Icon name="tracker" size={26} strokeWidth={1.6} /></span>
              <span style={{ display: "block" }}>{isDragging ? "Drop it!" : "Drag and drop your resume PDF here"}</span>
              <span style={{ display: "block", marginTop: "6px", fontSize: "12px", color: "var(--txt3)" }}>or click to upload</span>
            </div>
          )}
        </div>

        <textarea className="finp fta" placeholder="Or paste your text manually here..." value={resumeTxt} onChange={(e) => setResumeTxt(e.target.value.slice(0, 30000))} style={{ width: "100%", minHeight: "150px" }} />
        <div className="note" style={{ marginTop: 10 }}>Save your application profile above after changing this resume so the browser helper can use it on another device.</div>
      </div>

      <div className="scard">
        <h3>Auto-Hunter Management</h3>
        <p style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "16px" }}>
          Auto-hunter is optional and requires your RapidAPI key. It will search these keywords and add new jobs to your To Do list.
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <Autocomplete type="job" value={hQ} onChange={(e) => setHQ(e.target.value)} placeholder="Keyword (e.g. React Developer)" />
          </div>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <Autocomplete type="city" value={hL} onChange={(e) => setHL(e.target.value)} placeholder="Location (e.g. New York)" />
          </div>
          <button className="mbtn mbtn-p" onClick={addHunt}>Add Hunt</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {subs.map((s) => (
            <div key={s.id} className="link-row" style={{ padding: "10px 16px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "600" }}>{s.query}</div>
                <div style={{ fontSize: "11px", color: "var(--txt3)" }}>{s.location} | {s.job_type}</div>
              </div>
              <button className="mbtn-d" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => delHunt(s.id)}>
                Remove
              </button>
            </div>
          ))}
          {subs.length === 0 && <div className="note">No active hunts. You can skip this entirely if you want to stay in free tracker mode.</div>}
        </div>

        <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--b0)" }}>
          <button className="mbtn mbtn-p" style={{ width: "100%", height: "44px" }} onClick={runHunter} disabled={hLoading}>
            {hLoading ? "Hunter is searching..." : "Run Hunter Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
