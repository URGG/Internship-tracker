import { STATUSES, SOURCES } from '../../utils/constants';

export default function Modal({
  modal, setModal, form, setForm, setF, eid, apps, save, del,
  coverApp, coverJob, setCoverJob, resumeTxt, setResumeTxt,
  coverLoad, coverOut, setCoverOut, genCover, openCover, toast
}) {
  if (!modal) return null;

  if (modal === "cover") return (
    <div className="overlay" onClick={() => setModal(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <h2>AI cover letter</h2>
          <div className="mhead-right">
            <span style={{ fontSize: 12, color: "var(--acc)", fontFamily: "var(--mono)", fontWeight: 600 }}>{coverApp?.company}</span>
            <button className="closex" onClick={() => setModal(null)}>×</button>
          </div>
        </div>
        <div className="mbody">
          {!coverOut && <>
            <div className="frow">
              <span className="flbl">Job description</span>
              <textarea className="finp fta" style={{ minHeight: 130 }} value={coverJob} onChange={(e) => setCoverJob(e.target.value)} placeholder="Paste the full job description here…" />
            </div>
            {!resumeTxt && <div className="frow">
              <span className="flbl">Your background <span style={{ color: "var(--txt3)" }}>(or add in Settings)</span></span>
              <textarea className="finp fta" value={resumeTxt} onChange={(e) => setResumeTxt(e.target.value)} placeholder="CS junior, skills, past internships…" />
            </div>}
          </>}
          {coverLoad && <div className="ai-loading"><div className="spin" /><span style={{ fontFamily: "var(--mono)" }}>Writing your letter…</span></div>}
          {coverOut && <>
            <div className="ai-out">{coverOut}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="mbtn" onClick={() => { navigator.clipboard.writeText(coverOut); toast("Copied!", "#34d399"); }}>Copy</button>
              <button className="mbtn mbtn-g" onClick={() => setCoverOut("")}>↺ Regenerate</button>
            </div>
          </>}
        </div>
        <div className="mfoot">
          <button className="mbtn mbtn-g" onClick={() => setModal(null)}>Close</button>
          {!coverOut && !coverLoad && <button className="mbtn mbtn-p" onClick={genCover}>Generate ↗</button>}
        </div>
      </div>
    </div>
  );

  /* Add / Edit Form */
  const isEdit = eid !== null;
  return (
    <div className="overlay" onClick={() => setModal(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <h2>{isEdit ? form.company || "Edit application" : "New application"}</h2>
          <div className="mhead-right">
            {isEdit && <button className="ai-pill" onClick={() => { const a = apps.find((x) => x.id === eid); setModal(null); setTimeout(() => openCover(a), 50); }}>AI cover ↗</button>}
            <button className="closex" onClick={() => setModal(null)}>×</button>
          </div>
        </div>
        <div className="mbody">
          <div className="fg2">
            <div className="frow"><span className="flbl">Company</span><input className="finp" value={form.company} onChange={setF("company")} placeholder="Google" /></div>
            <div className="frow"><span className="flbl">Role</span><input className="finp" value={form.role} onChange={setF("role")} placeholder="SWE Intern" /></div>
          </div>
          <div className="fg2">
            <div className="frow"><span className="flbl">Status</span>
              <select className="finp" value={form.status} onChange={setF("status")}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="frow"><span className="flbl">Source</span>
              <select className="finp" value={form.source} onChange={setF("source")}>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="fg2">
            <div className="frow"><span className="flbl">Date applied</span><input type="date" className="finp" value={form.date} onChange={setF("date")} /></div>
            <div className="frow"><span className="flbl">Deadline</span><input type="date" className="finp" value={form.deadline} onChange={setF("deadline")} /></div>
          </div>
          <div className="fg2">
            <div className="frow"><span className="flbl">Location</span><input className="finp" value={form.location} onChange={setF("location")} placeholder="SF, CA or Remote" /></div>
            <div className="frow"><span className="flbl">Remote</span>
              <select className="finp" value={form.remote ? "yes" : "no"} onChange={(e) => setForm((f) => ({ ...f, remote: e.target.value === "yes" }))}>
                <option value="no">No</option><option value="yes">Yes</option>
              </select>
            </div>
          </div>
          <div className="frow"><span className="flbl">Apply link</span><input className="finp" value={form.link} onChange={setF("link")} placeholder="https://…" /></div>
          <div className="frow"><span className="flbl">Notes</span><textarea className="finp fta" value={form.notes} onChange={setF("notes")} placeholder="Referral, recruiter name, next steps…" /></div>
        </div>
        <div className="mfoot">
          {isEdit && <button className="mbtn mbtn-d" onClick={del}>Delete</button>}
          <button className="mbtn mbtn-g" onClick={() => setModal(null)}>Cancel</button>
          <button className="mbtn mbtn-p" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}