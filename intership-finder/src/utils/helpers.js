import { ST } from "./constants";

export function fmt(d) {
  if (!d) return "-";
  const [, m, day] = d.split("-");
  return `${+m}/${+day}`;
}

export function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}

export function daysBetween(start, end) {
  if (!start || !end) return null;
  return Math.max(0, Math.ceil((new Date(end) - new Date(start)) / 86400000));
}

export function daysSince(d) {
  if (!d) return null;
  return Math.max(0, Math.floor((new Date() - new Date(d)) / 86400000));
}

export function uid() {
  return Date.now() + Math.random();
}

export function srcTag(s) {
  return ST[s] || "t-ot";
}

export function isFollowUpDue(app) {
  const due = daysUntil(app.next_action_date);
  return due !== null && due <= 0 && !app.follow_up_sent;
}

export function parseActivityLog(log) {
  if (!log) return [];
  if (Array.isArray(log)) return log;
  try {
    const parsed = JSON.parse(log);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function detectSource(url) {
  if (/linkedin/i.test(url)) return "LinkedIn";
  if (/indeed/i.test(url)) return "Indeed";
  if (/handshake/i.test(url)) return "Handshake";
  return "Other";
}

export function externalHref(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getApplicationHealth(app = {}) {
  const checks = [
    { ok: Boolean(app.link), gap: "Add posting link" },
    { ok: Boolean(app.next_action_date), gap: "Set next action" },
    { ok: Boolean(app.source), gap: "Track source" },
    { ok: Boolean(app.resume_version), gap: "Tag resume version" },
    { ok: Boolean(app.notes && app.notes.trim().length > 20), gap: "Add useful notes" },
  ];

  if (app.status !== "To Do") checks.push({ ok: Boolean(app.applied_date), gap: "Add applied date" });
  if (app.status === "Interview") checks.push({ ok: Boolean(app.interview_stage), gap: "Set interview stage" });
  if (!["To Do", "Rejected", "Offer"].includes(app.status)) {
    checks.push({
      ok: Boolean(app.recruiter_name || app.recruiter_email || app.referral_name),
      gap: "Add contact or referral",
    });
  }

  const passed = checks.filter((check) => check.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const gaps = checks.filter((check) => !check.ok).map((check) => check.gap);

  return {
    score,
    gaps,
    label: score >= 85 ? "strong" : score >= 60 ? "ready" : "thin",
    cls: score >= 85 ? "h-good" : score >= 60 ? "h-mid" : "h-low",
  };
}

export function getActionSignal(app = {}) {
  const deadlineDays = daysUntil(app.deadline);
  const nextActionDays = daysUntil(app.next_action_date);
  const appliedAge = daysSince(app.applied_date);
  const terminal = ["Offer", "Rejected"].includes(app.status);

  if (nextActionDays !== null && nextActionDays <= 0 && !app.follow_up_sent) {
    return {
      score: 100 + Math.abs(nextActionDays),
      label: "Follow up",
      detail: `Action was due ${fmt(app.next_action_date)}`,
      cls: "t-warn",
    };
  }

  if (deadlineDays !== null && deadlineDays <= 1) {
    return {
      score: 90,
      label: "Deadline",
      detail: `Deadline ${fmt(app.deadline)}`,
      cls: "t-warn",
    };
  }

  if (app.status === "Interview" && !app.interview_stage) {
    return {
      score: 74,
      label: "Prep gap",
      detail: "Interview stage is missing",
      cls: "t-soon",
    };
  }

  if (!terminal && appliedAge !== null && appliedAge >= 14 && !app.last_contact_date) {
    return {
      score: 68,
      label: "Stale",
      detail: `${appliedAge} days without a response`,
      cls: "t-soon",
    };
  }

  if (!terminal && !app.next_action_date) {
    return {
      score: 48,
      label: "No next step",
      detail: "Add a date to keep it moving",
      cls: "t-ot",
    };
  }

  if (deadlineDays !== null && deadlineDays <= 7) {
    return {
      score: 42,
      label: "Upcoming",
      detail: `Deadline ${fmt(app.deadline)}`,
      cls: "t-soon",
    };
  }

  return { score: 0, label: "Clear", detail: "No action needed", cls: "t-ot" };
}
