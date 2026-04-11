import React from 'react';

export default function Modal({
  modal, setModal, form, setForm, setF, eid, save, del,
  coverApp, coverJob, setCoverJob, resumeTxt, coverLoad, 
  coverOut, setCoverOut, genCover, openCover, toast
}) {
  
  if (!modal) return null;

  const STATUSES = ["Wishlist", "Applied", "Interview", "Offer", "Rejected"];

  // Helper to copy the generated letter to your clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(coverOut);
    toast("Copied to clipboard!", "#5b7fff");
  };

  return (
    <div className="overlay" onClick={() => setModal(null)}>
      {/* Stop clicks inside the modal from closing it */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        
        {/* ========================================== */}
        {/* VIEW 1: ADD / EDIT JOB                     */}
        {/* ========================================== */}
        {modal === "edit" && (
          <>
            <div className="mhead">
              <h2>{eid ? "Edit Application" : "New Application"}</h2>
              <div className="mhead-right">
                {/* ✨ THE MAGIC BUTTON ✨ */}
                {eid && (
                  <button className="ai-pill" onClick={() => openCover(form)}>
                    ✨ AI Cover Letter
                  </button>
                )}
                <button className="closex" onClick={() => setModal(null)}>×</button>
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
                  <select className="finp" value={form.status || "Wishlist"} onChange={setF("status")}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="frow">
                  <span className="flbl">Date Applied</span>
                  <input className="finp" type="date" value={form.applied_date || ""} onChange={setF("applied_date")} />
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

              <div className="frow">
                <span className="flbl">Application Link</span>
                <input className="finp" value={form.link || ""} onChange={setF("link")} placeholder="https://..." />
              </div>
            </div>

            <div className="mfoot" style={{ justifyContent: eid ? "space-between" : "flex-end" }}>
              {eid && <button className="mbtn mbtn-d" onClick={del}>Delete</button>}
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="mbtn mbtn-g" onClick={() => setModal(null)}>Cancel</button>
                <button className="mbtn mbtn-p" onClick={save}>Save Changes</button>
              </div>
            </div>
          </>
        )}

        {/* ========================================== */}
        {/* VIEW 2: AI COVER LETTER GENERATOR          */}
        {/* ========================================== */}
        {modal === "cover" && (
          <>
            <div className="mhead">
              <h2>✨ Generate Cover Letter</h2>
              <button className="closex" onClick={() => { setModal("edit"); setCoverOut(""); }}>×</button>
            </div>

            <div className="mbody">
              {!resumeTxt ? (
                <div className="note" style={{ borderColor: "var(--red)", color: "var(--red)", background: "rgba(248, 113, 113, 0.05)" }}>
                  <strong>⚠️ Missing Resume Context:</strong> You haven't added your resume yet! Go to the <strong>Settings</strong> tab, paste your resume text, and save your Gemini API key before using this feature.
                </div>
              ) : (
                <div className="note">
                  Generating custom letter for <strong>{coverApp?.role}</strong> at <strong>{coverApp?.company}</strong>.
                </div>
              )}

              {!coverOut && !coverLoad && (
                <div className="frow">
                  <span className="flbl">Paste Job Description (Optional but recommended)</span>
                  <textarea 
                    className="finp fta" 
                    placeholder="Paste the requirements or description from the job posting here so the AI can tailor the letter..."
                    value={coverJob}
                    onChange={(e) => setCoverJob(e.target.value)}
                    style={{ minHeight: "150px" }}
                  />
                </div>
              )}

              {/* The Loading Spinner */}
              {coverLoad && (
                <div className="ai-loading">
                  <div className="spin"></div>
                  Generating your masterpiece...
                </div>
              )}

              {/* The AI Output Box */}
              {coverOut && !coverLoad && (
                <div className="frow">
                  <span className="flbl" style={{ color: "var(--acc)", display: "flex", justifyContent: "space-between" }}>
                    Result
                    <span style={{ cursor: "pointer", color: "var(--txt2)" }} onClick={handleCopy}>📋 Copy</span>
                  </span>
                  <div className="ai-out">{coverOut}</div>
                </div>
              )}
            </div>

            <div className="mfoot">
              <button className="mbtn mbtn-g" onClick={() => { setModal("edit"); setCoverOut(""); }}>Back</button>
              
              {!coverOut ? (
                <button 
                  className="mbtn mbtn-p" 
                  onClick={genCover} 
                  disabled={!resumeTxt || coverLoad}
                >
                  {coverLoad ? "Generating..." : "Generate ✨"}
                </button>
              ) : (
                <button className="mbtn mbtn-p" onClick={handleCopy}>
                  Copy to Clipboard
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}