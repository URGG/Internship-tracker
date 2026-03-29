import { SD } from '../../utils/constants';
import { fmt, daysUntil, srcTag } from '../../utils/helpers';

export default function Card({ app, setDragId, openEdit }) {
  const du = daysUntil(app.deadline);
  
  return (
    <div className="jcard" draggable onDragStart={() => setDragId(app.id)} onClick={() => openEdit(app)}>
      <div className={`jcard-stripe ${SD[app.status] || "d-W"}`} />
      <div className="jcard-co">{app.company}</div>
      <div className="jcard-role">{app.role}{app.location ? ` · ${app.location}` : ""}</div>
      <div className="jcard-meta">
        <span className={`tag ${srcTag(app.source)}`}>{app.source}</span>
        {app.remote && <span className="tag t-rm">remote</span>}
        {du !== null && du <= 3 && <span className="tag t-warn">due {fmt(app.deadline)}</span>}
        {du !== null && du > 3 && du <= 7 && <span className="tag t-soon">due {fmt(app.deadline)}</span>}
        {app.date && <span className="jcard-date">{fmt(app.date)}</span>}
      </div>
    </div>
  );
}