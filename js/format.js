import { logoUrl } from './teams.js';

const ET = 'America/New_York';
const MONTHS = { Jan: 'Jan.', Feb: 'Feb.', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'Aug.', Sep: 'Sept.', Oct: 'Oct.', Nov: 'Nov.', Dec: 'Dec.' };

export function fmtDate(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ET, month: 'short', day: 'numeric' }).formatToParts(d);
  const m = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return `${MONTHS[m] || m} ${day}`;
}

export function fmtWeekday(iso) {
  const d = new Date(iso);
  const w = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short' }).format(d);
  return { Thu: 'Thurs.', Tue: 'Tues.', Wed: 'Wed.', Mon: 'Mon.', Fri: 'Fri.', Sat: 'Sat.', Sun: 'Sun.' }[w] || w;
}

export function fmtTime(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour').value;
  const mi = parts.find((p) => p.type === 'minute').value;
  const ap = parts.find((p) => p.type === 'dayPeriod').value.toLowerCase();
  return `${h}:${mi} ${ap === 'am' ? 'a.m.' : 'p.m.'}`;
}

export function fmtPct(p, { lt1 = true } = {}) {
  if (p == null || Number.isNaN(p)) return '—';
  if (p <= 0) return '0%';
  if (p >= 1) return '100%';
  if (p > 0.995) return '>99%';
  // Low-probability outcomes (No. 1 pick, No. 1 seed for long shots) need a
  // decimal, or every value collapses to <1%, 0% or 1%.
  if (p < 0.1) {
    if (lt1 && p < 0.0005) return '<0.1%';
    return `${(p * 100).toFixed(1)}%`;
  }
  return `${Math.round(p * 100)}%`;
}

export function fmtRecord(s, t) {
  const w = Math.round(s.W[t] - s.T[t] * 0.5);
  return s.T[t] ? `${w}-${s.L[t]}-${s.T[t]}` : `${w}-${s.L[t]}`;
}

export function fmtDivRecord(s, t) {
  const ties = s.divT[t];
  const w = Math.round(s.divW[t] - ties * 0.5);
  const l = s.divG[t] - w - ties;
  return ties ? `${w}-${l}-${ties}` : `${w}-${l}`;
}

export function possessive(name) {
  return name.endsWith('s') ? `${name}’` : `${name}’s`;
}

export function logo(abbr, alt = '') {
  return `<img src="${logoUrl(abbr)}" alt="${alt}" loading="lazy">`;
}

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}
const NEUTRAL = '#ecece8', TEAL = '#8fcabd', BROWN = '#c49a4c';
// delta in probability units. Full color at a swing of half the baseline,
// clamped to 1-8 points, so small-probability scenarios still show contrast.
export function tint(delta, baseline = 0.5) {
  if (delta == null || Number.isNaN(delta)) return NEUTRAL;
  const scale = Math.min(0.08, Math.max(0.01, (baseline ?? 0.5) * 0.5));
  const t = Math.max(-1, Math.min(1, delta / scale));
  return t >= 0 ? mix(NEUTRAL, TEAL, t) : mix(NEUTRAL, BROWN, -t);
}
