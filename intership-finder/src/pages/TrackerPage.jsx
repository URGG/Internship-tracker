import { SOURCES, KCOLS, SD, SP } from '../utils/constants';
import { fmt, daysUntil, srcTag } from '../utils/helpers';
import Card from '../components/shared/Card';

export default function TrackerPage({
  stats, srcF, setSrcF, view, setView, filtered, dragOver, setDragOver,
  onDrop, openEdit, openCover, setDragId
}) {
  return (
    <>
      <div className="stats">
        {[
          { lbl: "Total tracked", val: stats.total, sub: "applications", cls: "ca" },
          { lbl: "Applied", val: stats.applied, sub: "submitted", cls: "cp" },
          { lbl: "In Interview", val: stats.ivw, sub: "active rounds", cls: "cb" },
          { lbl: "Offers", val: stats.offers, sub: stats.offers > 0 ? "🎉 congrats!" : "keep pushing", cls: "cg" },
        ].map((s) => (
          <div key={s.lbl} className="stat" style={{ color: `var(--${s.cls === "ca" ? "acc" : s.cls === "cp" ? "acc2" : s.cls === "cb" ? "amb" : "grn"})` }}>
            <div className="stat-lbl">{s.lbl}</div>
            <div className={`stat-val ${s.cls}`}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="fbar">
        <span className="fbar-lbl">source:</span>
        {["all", ...SOURCES].map((s) => (
          <button key={s} className={`chip${srcF === s ? " on" : ""}`} onClick={() => setSrcF(s)}>{s}</button>
        ))}
        <div className="vsw">
          <button className={`vsw-btn${view === "board" ? " on" : ""}`} onClick={() => setView("board")}>Board</button>
          <button className={`vsw-btn${view === "list" ? " on" : ""}`} onClick={() => setView("list")}>List</button>
        </div>
      </div>

      {view === "board" ? (
        <div className="kanban">
          {KCOLS.map((col) => {
            const ca = filtered.filter((a) => a.status === col);
            return (
              <div key={col} className={`kcol${dragOver === col ? " drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => onDrop(col)}>
                <div className="khead">
                  <div className={`kdot ${SD[col]}`} />
                  <span className="kttl">{col}</span>
                  <span className="kcnt">{ca.length}</span>
                </div>
                <div className="kcards">
                  {ca.length === 0 && <div className="kdrop">drop here</div>}
                  {ca.map((a) => <Card key={a.id} app={a} setDragId={setDragId} openEdit={openEdit} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ltbl-wrap">
          <table className="ltbl">
            <thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Source</th><th>Applied</th><th>Deadline</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7}><div className="empty"><div className="empty-ico">○</div><p>no applications found</p></div></td></tr>}
              {filtered.map((a) => {
                const du = daysUntil(a.deadline);
                return (
                  <tr key={a.id} onClick={() => openEdit(a)}>
                    <td style={{ fontWeight: 700 }}>{a.company}</td>
                    <td style={{ color: "var(--txt2)", fontSize: 12 }}>{a.role}</td>
                    <td><span className={`spill ${SP[a.status] || "sw"}`}><span className={`kdot ${SD[a.status]}`} style={{ width: 6, height: 6 }} />{a.status}</span></td>
                    <td><span className={`tag ${srcTag(a.source)}`}>{a.source}</span></td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--txt3)" }}>{fmt(a.date)}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: du !== null && du <= 3 ? "var(--red)" : du !== null && du <= 7 ? "var(--amb)" : "var(--txt3)" }}>{fmt(a.deadline)}</td>
                    <td onClick={(e) => { e.stopPropagation(); openCover(a); }}><button className="rbtn">AI cover ↗</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}