import { SOURCES, KCOLS, SD, SP } from "../utils/constants";
import { fmt, daysUntil, isFollowUpDue, parseActivityLog, srcTag } from "../utils/helpers";
import Card from "../components/shared/Card";

export default function TrackerPage({
  stats,
  srcF,
  setSrcF,
  view,
  setView,
  filtered,
  dragOver,
  setDragOver,
  onDrop,
  openEdit,
  openCover,
  setDragId,
  reminders,
}) {
  return (
    <>
      <div className="stats">
        {[
          { lbl: "Total tracked", val: stats.total, sub: "applications", cls: "ca" },
          { lbl: "Applied", val: stats.applied, sub: "submitted", cls: "cp" },
          { lbl: "In Interview", val: stats.ivw, sub: "active rounds", cls: "cb" },
          { lbl: "Follow-ups", val: stats.reminders, sub: stats.reminders > 0 ? "action needed" : "all clear", cls: "cb" },
          { lbl: "Offers", val: stats.offers, sub: stats.offers > 0 ? "momentum" : "keep pushing", cls: "cg" },
        ].map((s) => (
          <div key={s.lbl} className="stat" style={{ color: `var(--${s.cls === "ca" ? "acc" : s.cls === "cp" ? "acc2" : s.cls === "cb" ? "amb" : "grn"})` }}>
            <div className="stat-lbl">{s.lbl}</div>
            <div className={`stat-val ${s.cls}`}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {reminders.length > 0 && (
        <div className="scard" style={{ marginBottom: "20px" }}>
          <h3 style={{ marginBottom: "14px" }}>Action Queue</h3>
          <div style={{ display: "grid", gap: "10px" }}>
            {reminders.slice(0, 6).map((app) => {
              const followUp = isFollowUpDue(app);
              const deadlineDays = daysUntil(app.deadline);
              return (
                <button
                  key={app.id}
                  onClick={() => openEdit(app)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    background: "var(--s2)",
                    border: "1px solid var(--b0)",
                    borderRadius: "var(--r)",
                    padding: "12px 14px",
                    color: "var(--txt)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>{app.company}</div>
                    <div style={{ color: "var(--txt2)", fontSize: "12px", marginTop: "3px" }}>{app.role}</div>
                    <div style={{ color: "var(--txt3)", fontSize: "11px", marginTop: "5px" }}>
                      {followUp ? `Follow up by ${fmt(app.next_action_date)}` : `Deadline on ${fmt(app.deadline)}`}
                      {app.recruiter_name ? ` | ${app.recruiter_name}` : ""}
                    </div>
                  </div>
                  <span className={`tag ${followUp || (deadlineDays !== null && deadlineDays <= 1) ? "t-warn" : "t-soon"}`}>
                    {followUp ? "follow up" : "deadline"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="fbar">
        <span className="fbar-lbl">source:</span>
        {["all", ...SOURCES].map((s) => (
          <button key={s} className={`chip${srcF === s ? " on" : ""}`} onClick={() => setSrcF(s)}>
            {s}
          </button>
        ))}
        <div className="vsw">
          <button className={`vsw-btn${view === "board" ? " on" : ""}`} onClick={() => setView("board")}>
            Board
          </button>
          <button className={`vsw-btn${view === "list" ? " on" : ""}`} onClick={() => setView("list")}>
            List
          </button>
          <button className={`vsw-btn${view === "timeline" ? " on" : ""}`} onClick={() => setView("timeline")}>
            Timeline
          </button>
        </div>
      </div>

      {view === "board" ? (
        <div className="kanban">
          {KCOLS.map((col) => {
            const ca = filtered.filter((a) => a.status === col);
            return (
              <div
                key={col}
                className={`kcol${dragOver === col ? " drag-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => onDrop(col)}
              >
                <div className="khead">
                  <div className={`kdot ${SD[col]}`} />
                  <span className="kttl">{col}</span>
                  <span className="kcnt">{ca.length}</span>
                </div>
                <div className="kcards">
                  {ca.length === 0 && <div className="kdrop">drop here</div>}
                  {ca.map((a) => (
                    <Card key={a.id} app={a} setDragId={setDragId} openEdit={openEdit} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "list" ? (
        <div className="ltbl-wrap">
          <table className="ltbl">
            <thead>
              <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Status</th>
                <th>Source</th>
                <th>Applied</th>
                <th>Deadline</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      <div className="empty-ico">o</div>
                      <p>no applications found</p>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((a) => {
                const du = daysUntil(a.deadline);
                return (
                  <tr key={a.id} onClick={() => openEdit(a)}>
                    <td style={{ fontWeight: 700 }}>{a.company}</td>
                    <td style={{ color: "var(--txt2)", fontSize: 12 }}>
                      {a.role}
                      {a.interview_stage ? ` | ${a.interview_stage}` : ""}
                    </td>
                    <td>
                      <span className={`spill ${SP[a.status] || "sw"}`}>
                        <span className={`kdot ${SD[a.status]}`} style={{ width: 6, height: 6 }} />
                        {a.status}
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${srcTag(a.source)}`}>{a.source}</span>
                    </td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--txt3)" }}>{fmt(a.applied_date)}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: du !== null && du <= 3 ? "var(--red)" : du !== null && du <= 7 ? "var(--amb)" : "var(--txt3)" }}>{fmt(a.deadline)}</td>
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                        openCover(a);
                      }}
                    >
                      <button className="rbtn">AI Cover ↗</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scard" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: "14px" }}>Application Timeline</h3>
          <div style={{ display: "grid", gap: "12px" }}>
            {filtered.length === 0 && <div className="note">No applications match this view yet.</div>}
            {filtered
              .slice()
              .sort((a, b) => {
                const aDate = parseActivityLog(a.activity_log).slice(-1)[0]?.timestamp || a.applied_date || "";
                const bDate = parseActivityLog(b.activity_log).slice(-1)[0]?.timestamp || b.applied_date || "";
                return bDate.localeCompare(aDate);
              })
              .map((app) => {
                const events = parseActivityLog(app.activity_log).slice().reverse();
                return (
                  <button
                    key={app.id}
                    onClick={() => openEdit(app)}
                    style={{
                      textAlign: "left",
                      background: "var(--s2)",
                      border: "1px solid var(--b0)",
                      borderRadius: "var(--r)",
                      padding: "16px",
                      color: "var(--txt)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px" }}>{app.company}</div>
                        <div style={{ color: "var(--txt2)", fontSize: "12px", marginTop: "3px" }}>{app.role}</div>
                      </div>
                      <span className={`spill ${SP[app.status] || "sw"}`}>{app.status}</span>
                    </div>
                    <div style={{ display: "grid", gap: "10px" }}>
                      {events.length === 0 ? (
                        <div className="note" style={{ marginTop: 0 }}>No timeline events yet.</div>
                      ) : (
                        events.map((event, index) => (
                          <div key={`${event.timestamp}-${index}`} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: "10px", alignItems: "start" }}>
                            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--txt)", marginTop: "4px" }} />
                            <div>
                              <div style={{ fontSize: "12px", color: "var(--txt2)" }}>{event.message}</div>
                              <div style={{ fontSize: "10px", color: "var(--txt3)", marginTop: "3px" }}>{event.timestamp}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}
