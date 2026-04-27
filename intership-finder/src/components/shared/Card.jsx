import { SD } from "../../utils/constants";
import { fmt, daysUntil, isFollowUpDue, srcTag } from "../../utils/helpers";

export default function Card({ app, setDragId, openEdit }) {
  const deadlineDays = daysUntil(app.deadline);
  const nextActionDays = daysUntil(app.next_action_date);

  return (
    <div className="jcard" draggable onDragStart={() => setDragId(app.id)} onClick={() => openEdit(app)}>
      <div className={`jcard-stripe ${SD[app.status] || "d-W"}`} />
      <div className="jcard-co">{app.company}</div>
      <div className="jcard-role">
        {app.role}
        {app.location ? ` | ${app.location}` : ""}
      </div>
      <div className="jcard-meta">
        <span className={`tag ${srcTag(app.source)}`}>{app.source}</span>
        {app.remote && <span className="tag t-rm">remote</span>}
        {app.interview_stage && <span className="tag t-ot">{app.interview_stage}</span>}
        {app.recruiter_name && <span className="tag t-ot">{app.recruiter_name}</span>}
        {deadlineDays !== null && deadlineDays <= 3 && <span className="tag t-warn">deadline {fmt(app.deadline)}</span>}
        {deadlineDays !== null && deadlineDays > 3 && deadlineDays <= 7 && <span className="tag t-soon">deadline {fmt(app.deadline)}</span>}
        {isFollowUpDue(app) && <span className="tag t-warn">follow up</span>}
        {!isFollowUpDue(app) && nextActionDays !== null && nextActionDays <= 2 && !app.follow_up_sent && <span className="tag t-soon">next {fmt(app.next_action_date)}</span>}
        {app.resume_version && <span className="tag t-ot">resume {app.resume_version}</span>}
        {app.applied_date && <span className="jcard-date">{fmt(app.applied_date)}</span>}
      </div>
    </div>
  );
}
