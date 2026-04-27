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
