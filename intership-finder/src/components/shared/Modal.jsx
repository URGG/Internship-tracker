import React from "react";
import { INTERVIEW_STAGES, STATUSES } from "../../utils/constants";
import { parseActivityLog } from "../../utils/helpers";
import Icon from "./Icon";

export default function Modal({
  modal,
  setModal,
  form,
  setForm,
  setF,
  eid,
  save,
  del,
  coverApp,
  coverJob,
  setCoverJob,
  resumeTxt,
  coverLoad,
  coverOut,
  genCover,
  openCover,
  openResumeMatch,
  openFollowUp,
  matchData,
  matchLoad,
  runResumeMatch,
  followUpOut,
  followUpLoad,
  runFollowUpDraft,
  intelData,
  intelLoad,
  fetchIntel,
  toast,
}) {
  if (!modal) return null;

  const history = parseActivityLog(form.activity_log);

  const handleCopy = () => {
    navigator.clipboard.writeText(coverOut);
    toast("Copied to clipboard!", "#5b7fff");
  };

  return (
    <div className="overlay" onClick={() => setModal(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: modal === "intel" ? 560 : 760 }}>
        {modal === "edit" && (
          <>
            <div className="mhead">
              <h2>{eid ? "Edit Application" : "New Application"}</h2>
              <div className="mhead-right" style={{ gap: 8 }}>
                {eid && (
                  <>
                    <button className="ai-pill" onClick={() => fetchIntel(form)} title="Get AI Insights">
                      Intel
                    </button>
                    <button className="ai-pill" onClick={() => openCover(form)}>
                      AI Cover
                    </button>
                    <button className="ai-pill" onClick={() => openResumeMatch(form)}>
                      Resume Match
                    </button>
                    <button className="ai-pill" onClick={() => openFollowUp(form)}>
                      Follow Up
                    </button>
                  </>
                )}
                <button className="closex" onClick={() => setModal(null)}>
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>

            <div className="mbody">
              <div className="fg2">
                <div className="frow">
                  <span className="flbl">Company</span>
                  <input className="finp" value={form.company || ""} onChange={setF("company")} placeholder="e.g. Google" autoFocus />
                </div>
                <div className="frow">
                  <span className="flbl">Role</span>
                  <input className="finp" value={form.role || ""} onChange={setF("role")} placeholder="e.g. Software Engineer Intern" />
                </div>
              </div>

              <div className="fg2">
                <div className="frow">
                  <span className="flbl">Status</span>
                  <select className="finp" value={form.status || "To Do"} onChange={setF("status")}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="frow">
                  <span className="flbl">Interview Stage</span>
                  <select className="finp" value={form.interview_stage || ""} onChange={setF("interview_stage")}>
                    {INTERVIEW_STAGES.map((s) => (
                      <option key={s || "none"} value={s}>
                        {s || "None"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="fg2">
                <div className="frow">
                  <span className="flbl">Date Applied</span>
                  <input className="finp" type="date" value={form.applied_date || ""} onChange={setF("applied_date")} />
                </div>
                <div className="frow">
                  <span className="flbl">Deadline</span>
                  <input className="finp" type="date" value={form.deadline || ""} onChange={setF("deadline")} />
                </div>
              </div>

              <div className="fg2">
                <div className="frow">
                  <span className="flbl">Next Action Date</span>
                  <input className="finp" type="date" value={form.next_action_date || ""} onChange={setF("next_action_date")} />
                </div>
                <div className="frow">
                  <span className="flbl">Last Contact</span>
                  <input className="finp" type="date" value={form.last_contact_date || ""} onChange={setF("last_contact_date")} />
                </div>
              </div>

              <div className="fg2">
                <div className="frow">
                  <span className="flbl">Location</span>
                  <input className="finp" value={form.location || ""} onChange={setF("location")} placeholder="e.g. San Francisco, CA" />
                </div>
                <div className="frow">
                  <span className="flbl">Remote?</span>
                  <select className="finp" value={form.remote ? "true" : "false"} onChange={(e) => setForm({ ...form, remote: e.target.value === "true" })}>
                    <option value="false">No (On-site / Hybrid)</option>
                    <option value="true">Yes (Fully Remote)</option>
                  </select>
                </div>
              </div>

              <div className="fg2">
                <div className="frow">
                  <span className="flbl">Source</span>
                  <input className="finp" value={form.source || ""} onChange={setF("source")} placeholder="e.g. LinkedIn" />
                </div>
                <div className="frow">
                  <span className="flbl">Follow-up Sent?</span>
                  <select className="finp" value={form.follow_up_sent ? "true" : "false"} onChange={(e) => setForm({ ...form, follow_up_sent: e.target.value === "true" })}>
                    <option value="false">Pending</option>
                    <option value="true">Sent</option>
                  </select>
                </div>
              </div>

              <div className="frow">
                <span className="flbl">Application Link</span>
                <input className="finp" value={form.link || ""} onChange={setF("link")} placeholder="https://..." />
              </div>

              <div className="fg2">
                <div className="frow">
                  <span className="flbl">Recruiter Name</span>
                  <input className="finp" value={form.recruiter_name || ""} onChange={setF("recruiter_name")} placeholder="e.g. Jane Recruiter" />
                </div>
                <div className="frow">
                  <span className="flbl">Recruiter Email</span>
                  <input className="finp" value={form.recruiter_email || ""} onChange={setF("recruiter_email")} placeholder="e.g. jane@company.com" />
                </div>
              </div>

              <div className="fg2">
                <div className="frow">
                  <span className="flbl">Referral</span>
                  <input className="finp" value={form.referral_name || ""} onChange={setF("referral_name")} placeholder="Who referred you?" />
                </div>
                <div className="frow">
                  <span className="flbl">Resume Version</span>
                  <input className="finp" value={form.resume_version || ""} onChange={setF("resume_version")} placeholder="e.g. SWE-v3" />
                </div>
              </div>

              <div className="frow">
                <span className="flbl">Cover Letter Version</span>
                <input className="finp" value={form.cover_letter_version || ""} onChange={setF("cover_letter_version")} placeholder="e.g. CL-v2" />
              </div>

              <div className="frow">
                <span className="flbl">Notes</span>
                <textarea className="finp fta" value={form.notes || ""} onChange={setF("notes")} style={{ minHeight: "100px" }} />
              </div>

              {history.length > 0 && (
                <div className="frow">
                  <span className="flbl">Activity Log</span>
                  <div className="note" style={{ marginTop: 0 }}>
                    {history.slice().reverse().map((item, index) => (
                      <div key={`${item.timestamp}-${index}`} style={{ paddingBottom: index === history.length - 1 ? 0 : "10px", marginBottom: index === history.length - 1 ? 0 : "10px", borderBottom: index === history.length - 1 ? "none" : "1px solid var(--b0)" }}>
                        <div style={{ fontSize: "12px", color: "var(--txt2)" }}>{item.message}</div>
                        <div style={{ fontSize: "10px", color: "var(--txt3)", marginTop: "4px" }}>{item.timestamp}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mfoot" style={{ justifyContent: eid ? "space-between" : "flex-end" }}>
              {eid && <button className="mbtn mbtn-d" onClick={del}>Delete</button>}
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="mbtn mbtn-g" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button className="mbtn mbtn-p" onClick={save}>
                  Save Changes
                </button>
              </div>
            </div>
          </>
        )}

        {modal === "cover" && (
          <>
            <div className="mhead">
              <h2>Generate Cover Letter</h2>
              <button className="closex" onClick={() => setModal("edit")}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mbody">
              {!resumeTxt ? (
                <div className="note" style={{ borderColor: "var(--red)", color: "var(--red)", background: "rgba(248, 113, 113, 0.05)" }}>
                  <strong>Missing Resume Context:</strong> Add your resume text in Settings before using this feature.
                </div>
              ) : (
                <div className="note">
                  Generating a custom letter for <strong>{coverApp?.role}</strong> at <strong>{coverApp?.company}</strong>.
                </div>
              )}

              {!coverOut && !coverLoad && (
                <div className="frow">
                  <span className="flbl">Paste Job Description (Optional but recommended)</span>
                  <textarea className="finp fta" placeholder="Paste the job description here so the AI can tailor the letter..." value={coverJob} onChange={(e) => setCoverJob(e.target.value)} style={{ minHeight: "150px" }} />
                </div>
              )}

              {coverLoad && (
                <div className="ai-loading">
                  <div className="spin"></div>
                  Generating your draft...
                </div>
              )}

              {coverOut && !coverLoad && (
                <div className="frow">
                  <span className="flbl" style={{ color: "var(--acc)", display: "flex", justifyContent: "space-between" }}>
                    Result
                    <span style={{ cursor: "pointer", color: "var(--txt2)" }} onClick={handleCopy}>
                      Copy
                    </span>
                  </span>
                  <div className="ai-out">{coverOut}</div>
                </div>
              )}
            </div>

            <div className="mfoot">
              <button className="mbtn mbtn-g" onClick={() => setModal("edit")}>
                Back
              </button>
              {!coverOut ? (
                <button className="mbtn mbtn-p" onClick={genCover} disabled={!resumeTxt || coverLoad}>
                  {coverLoad ? "Generating..." : "Generate"}
                </button>
              ) : (
                <button className="mbtn mbtn-p" onClick={handleCopy}>
                  Copy to Clipboard
                </button>
              )}
            </div>
          </>
        )}

        {modal === "intel" && (
          <>
            <div className="mhead">
              <h2>Company Intel: {form.company}</h2>
              <button className="closex" onClick={() => setModal("edit")}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mbody">
              {intelLoad ? (
                <div className="ai-loading">
                  <div className="spin"></div>
                  Analyzing company data...
                </div>
              ) : intelData ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div className="scard" style={{ margin: 0, padding: "16px", background: "var(--s3)" }}>
                    <div style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Estimated Salary</div>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--grn)" }}>{intelData.estimated_salary}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div className="scard" style={{ margin: 0, padding: "16px" }}>
                      <div style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "8px" }}>Pros</div>
                      <ul style={{ paddingLeft: "16px", fontSize: "13px", color: "var(--txt2)" }}>
                        {intelData.culture_pros.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="scard" style={{ margin: 0, padding: "16px" }}>
                      <div style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "8px" }}>Cons</div>
                      <ul style={{ paddingLeft: "16px", fontSize: "13px", color: "var(--txt2)" }}>
                        {intelData.culture_cons.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="fg2">
                    <div className="scard" style={{ margin: 0, padding: "16px" }}>
                      <div style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "4px" }}>Interview Difficulty</div>
                      <div style={{ fontWeight: "600" }}>{intelData.interview_difficulty}</div>
                    </div>
                    <div className="scard" style={{ margin: 0, padding: "16px" }}>
                      <div style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "4px" }}>Recent News</div>
                      <div style={{ fontSize: "13px", lineHeight: "1.4" }}>{intelData.recent_news}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty">No intel found.</div>
              )}
            </div>

            <div className="mfoot">
              <button className="mbtn mbtn-g" onClick={() => setModal("edit")}>
                Back to Details
              </button>
              <button className="mbtn mbtn-p" onClick={() => fetchIntel(form)}>
                Refresh Intel
              </button>
            </div>
          </>
        )}

        {modal === "match" && (
          <>
            <div className="mhead">
              <h2>Resume Match</h2>
              <button className="closex" onClick={() => setModal("edit")}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mbody">
              <div className="note">
                Match your stored resume against <strong>{form.role}</strong> at <strong>{form.company}</strong>. For best results, keep the job description in the application notes.
              </div>

              {matchLoad && (
                <div className="ai-loading">
                  <div className="spin"></div>
                  Scoring resume fit...
                </div>
              )}

              {matchData && !matchLoad && (
                <div style={{ display: "grid", gap: "16px" }}>
                  <div className="scard" style={{ margin: 0, padding: "18px", background: "var(--s3)" }}>
                    <div style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: ".08em" }}>Match Score</div>
                    <div style={{ fontSize: "34px", fontWeight: 800 }}>{matchData.score}%</div>
                    <div style={{ fontSize: "12px", color: "var(--txt2)", marginTop: "8px" }}>{matchData.summary}</div>
                  </div>

                  <div className="fg2">
                    <div className="scard" style={{ margin: 0, padding: "16px" }}>
                      <div style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "8px" }}>Strengths</div>
                      <ul style={{ paddingLeft: "16px", display: "grid", gap: "8px", color: "var(--txt2)", fontSize: "13px" }}>
                        {matchData.strengths?.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="scard" style={{ margin: 0, padding: "16px" }}>
                      <div style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "8px" }}>Missing Keywords</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {matchData.missing_keywords?.map((item, index) => (
                          <span key={index} className="tag t-warn">{item}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="scard" style={{ margin: 0, padding: "16px" }}>
                    <div style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "8px" }}>Next Steps</div>
                    <ul style={{ paddingLeft: "16px", display: "grid", gap: "8px", color: "var(--txt2)", fontSize: "13px" }}>
                      {matchData.next_steps?.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="mfoot">
              <button className="mbtn mbtn-g" onClick={() => setModal("edit")}>
                Back
              </button>
              <button className="mbtn mbtn-p" onClick={runResumeMatch} disabled={matchLoad || !resumeTxt}>
                {matchLoad ? "Scoring..." : matchData ? "Refresh Match" : "Generate Match"}
              </button>
            </div>
          </>
        )}

        {modal === "followup" && (
          <>
            <div className="mhead">
              <h2>Follow-up Draft</h2>
              <button className="closex" onClick={() => setModal("edit")}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="mbody">
              <div className="note">
                Draft a follow-up for <strong>{form.company}</strong> based on the current status, notes, and contact history.
              </div>

              {followUpLoad && (
                <div className="ai-loading">
                  <div className="spin"></div>
                  Writing follow-up email...
                </div>
              )}

              {followUpOut && !followUpLoad && (
                <div className="frow">
                  <span className="flbl" style={{ color: "var(--acc)", display: "flex", justifyContent: "space-between" }}>
                    Draft
                    <span style={{ cursor: "pointer", color: "var(--txt2)" }} onClick={() => navigator.clipboard.writeText(followUpOut)}>
                      Copy
                    </span>
                  </span>
                  <div className="ai-out">{followUpOut}</div>
                </div>
              )}
            </div>

            <div className="mfoot">
              <button className="mbtn mbtn-g" onClick={() => setModal("edit")}>
                Back
              </button>
              <button className="mbtn mbtn-p" onClick={runFollowUpDraft} disabled={followUpLoad || !resumeTxt}>
                {followUpLoad ? "Generating..." : followUpOut ? "Refresh Draft" : "Generate Draft"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
