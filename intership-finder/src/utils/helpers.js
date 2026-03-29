import { ST } from './constants';

export function fmt(d) { if (!d) return "—"; const [, m, day] = d.split("-"); return `${+m}/${+day}` }

export function daysUntil(d) { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000) }

export function uid() { return Date.now() + Math.random() }

export function srcTag(s) { return ST[s] || "t-ot" }

export function detectSource(url) {
    if (/linkedin/i.test(url)) return "LinkedIn";
    if (/indeed/i.test(url)) return "Indeed";
    if (/handshake/i.test(url)) return "Handshake";
    return "Other";
}