import { SD } from "../../utils/constants";
import { fmt, daysUntil, externalHref, getActionSignal, getApplicationHealth, isFollowUpDue, srcTag } from "../../utils/helpers";
import Icon from "./Icon";

export default function Card({ app, setDragId, setDragOver, openEdit }) {
  const deadlineDays = daysUntil(app.deadline);
  const nextActionDays = daysUntil(app.next_action_date);
  const postingHref = externalHref(app.link);
  const health = getApplicationHealth(app);
  const signal = getActionSignal(app);

  return (
    <div
      className="jcard"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(app.id));
        setDragId(app.id);
      }}
      onDragEnd={() => {
        setDragId(null);
        setDragOver(null);
      }}
      onClick={() => openEdit(app)}
    >
      <div className={`jcard-stripe ${SD[app.status] || "d-W"}`} />
      <div className="jcard-top">
        <div className="jcard-co">{app.company}</div>
        {postingHref && (
          <a
            className="jcard-link"
            href={postingHref}
            target="_blank"
            rel="noreferrer"
            title="Open application link"
            aria-label={`Open application link for ${app.company}`}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Icon name="external" size={14} />
          </a>
        )}
      </div>
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
      <div className="jcard-health">
        <div className="health-meter" aria-hidden="true">
          <span className={health.cls} style={{ width: `${health.score}%` }} />
        </div>
        <span className={`health-label ${health.cls}`}>{health.score}% {health.label}</span>
        {signal.score > 0 && <span className={`tag ${signal.cls}`}>{signal.label}</span>}
      </div>
    </div>
  );
}
