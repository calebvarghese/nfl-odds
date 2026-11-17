// Standings state + NFL tiebreakers. Pure functions over typed arrays so the
// simulation worker can call them tens of thousands of times.
//
// meta: { n, div: Int8Array(n), conf: Int8Array(n) }
// result codes: 0 = home win, 1 = away win, 2 = tie

export function createState(n) {
  return {
    n,
    W: new Float32Array(n), L: new Uint8Array(n), T: new Uint8Array(n), G: new Uint8Array(n),
    divW: new Float32Array(n), divG: new Uint8Array(n), divT: new Uint8Array(n),
    confW: new Float32Array(n), confG: new Uint8Array(n),
    h2hW: new Float32Array(n * n), h2hG: new Uint8Array(n * n),
    pct: new Float32Array(n),
  };
}

export function copyState(dst, src) {
  dst.W.set(src.W); dst.L.set(src.L); dst.T.set(src.T); dst.G.set(src.G);
  dst.divW.set(src.divW); dst.divG.set(src.divG); dst.divT.set(src.divT);
  dst.confW.set(src.confW); dst.confG.set(src.confG);
  dst.h2hW.set(src.h2hW); dst.h2hG.set(src.h2hG);
}

export function addResult(s, meta, h, a, result) {
  const n = s.n;
  const hw = result === 0 ? 1 : result === 1 ? 0 : 0.5;
  const aw = 1 - hw;
  s.W[h] += hw; s.W[a] += aw; s.G[h]++; s.G[a]++;
  if (result === 2) { s.T[h]++; s.T[a]++; } else if (result === 0) s.L[a]++; else s.L[h]++;
  s.h2hW[h * n + a] += hw; s.h2hW[a * n + h] += aw;
  s.h2hG[h * n + a]++; s.h2hG[a * n + h]++;
  if (meta.conf[h] === meta.conf[a]) {
    s.confW[h] += hw; s.confW[a] += aw; s.confG[h]++; s.confG[a]++;
    if (meta.div[h] === meta.div[a]) {
      s.divW[h] += hw; s.divW[a] += aw; s.divG[h]++; s.divG[a]++;
      if (result === 2) { s.divT[h]++; s.divT[a]++; }
    }
  }
}

export function computePct(s) {
  for (let i = 0; i < s.n; i++) s.pct[i] = s.G[i] ? s.W[i] / s.G[i] : 0;
}

// ---- tiebreaker metrics ------------------------------------------------

function ratio(w, g) { return g ? w / g : 0; }

// Head-to-head pct among the candidates. Null if any candidate has not played
// another candidate (the step is skipped per NFL rules).
function h2hPct(s, cands) {
  const n = s.n;
  const out = new Array(cands.length);
  for (let i = 0; i < cands.length; i++) {
    let w = 0, g = 0;
    for (let j = 0; j < cands.length; j++) {
      if (i === j) continue;
      w += s.h2hW[cands[i] * n + cands[j]];
      g += s.h2hG[cands[i] * n + cands[j]];
    }
    if (g === 0) return null;
    out[i] = w / g;
  }
  return out;
}

// Wild-card head-to-head: two clubs -> straight H2H; three or more -> only a
// sweep (one club beat all others, or lost to all others) counts.
function h2hWildcard(s, cands) {
  if (cands.length === 2) return h2hPct(s, cands);
  const n = s.n;
  const vals = new Array(cands.length).fill(0.5);
  let applied = false;
  for (let i = 0; i < cands.length; i++) {
    let w = 0, g = 0, playedAll = true;
    for (let j = 0; j < cands.length; j++) {
      if (i === j) continue;
      const gg = s.h2hG[cands[i] * n + cands[j]];
      if (gg === 0) { playedAll = false; break; }
      w += s.h2hW[cands[i] * n + cands[j]];
      g += gg;
    }
    if (!playedAll) continue;
    if (w === g) { vals[i] = 1; applied = true; } else if (w === 0) { vals[i] = 0; applied = true; }
  }
  return applied ? vals : null;
}

function divRecord(s, cands) { return cands.map((t) => ratio(s.divW[t], s.divG[t])); }
function confRecord(s, cands) { return cands.map((t) => ratio(s.confW[t], s.confG[t])); }

function commonGames(minGames) {
  return (s, cands) => {
    const n = s.n;
    const candSet = new Set(cands);
    // common opponents = teams every candidate has played (excluding candidates)
    const common = [];
    for (let j = 0; j < n; j++) {
      if (candSet.has(j)) continue;
      let all = true;
      for (const t of cands) if (s.h2hG[t * n + j] === 0) { all = false; break; }
      if (all) common.push(j);
    }
    if (common.length === 0) return null;
    const out = new Array(cands.length);
    for (let i = 0; i < cands.length; i++) {
      let w = 0, g = 0;
      for (const j of common) { w += s.h2hW[cands[i] * n + j]; g += s.h2hG[cands[i] * n + j]; }
      if (g < minGames) return null;
      out[i] = ratio(w, g);
    }
    return out;
  };
}

// Combined record of defeated opponents (ties count half).
function strengthOfVictory(s, cands) {
  const n = s.n;
  return cands.map((t) => {
    let w = 0, g = 0;
    for (let j = 0; j < n; j++) {
      const wins = s.h2hW[t * n + j];
      if (wins > 0) { w += wins * s.W[j]; g += wins * s.G[j]; }
    }
    return ratio(w, g);
  });
}

// Combined record of all opponents, weighted by games played against each.
export function strengthOfSchedule(s, cands) {
  const n = s.n;
  return cands.map((t) => {
    let w = 0, g = 0;
    for (let j = 0; j < n; j++) {
      const gg = s.h2hG[t * n + j];
      if (gg) { w += gg * s.W[j]; g += gg * s.G[j]; }
    }
    return ratio(w, g);
  });
}

const DIV_CRITERIA = [h2hPct, divRecord, commonGames(0), confRecord, strengthOfVictory, strengthOfSchedule];
const WC_CRITERIA = [h2hWildcard, confRecord, commonGames(4), strengthOfVictory, strengthOfSchedule];

// Pick the best club from a group of clubs tied on winning percentage.
export function pickTop(s, meta, group, isDiv, rng) {
  if (group.length === 1) return group[0];
  let cands = group;
  if (!isDiv) {
    // Only one club per division may advance to the wild-card comparison.
    const byDiv = new Map();
    for (const t of cands) {
      const d = meta.div[t];
      if (!byDiv.has(d)) byDiv.set(d, []);
      byDiv.get(d).push(t);
    }
    if (byDiv.size < cands.length) {
      cands = [];
      for (const list of byDiv.values()) cands.push(list.length === 1 ? list[0] : pickTop(s, meta, list, true, rng));
    }
    if (cands.length === 1) return cands[0];
  }
  const crits = isDiv ? DIV_CRITERIA : WC_CRITERIA;
  for (let guard = 0; guard < 20; guard++) {
    let narrowed = false;
    for (const crit of crits) {
      const vals = crit(s, cands);
      if (!vals) continue;
      let best = -Infinity;
      for (const v of vals) if (v > best) best = v;
      const keep = [];
      for (let i = 0; i < cands.length; i++) if (vals[i] >= best - 1e-9) keep.push(cands[i]);
      if (keep.length === 1) return keep[0];
      if (keep.length < cands.length) { cands = keep; narrowed = true; break; }
    }
    if (!narrowed) break;
  }
  return cands[Math.floor(rng() * cands.length)];
}

// Order a set of clubs: by pct, tie clusters resolved with NFL procedure
// (after each club is placed, the procedure restarts for the remainder).
export function rankGroup(s, meta, teams, isDiv, rng) {
  const sorted = teams.slice().sort((a, b) => s.pct[b] - s.pct[a]);
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && s.pct[sorted[j]] === s.pct[sorted[i]]) j++;
    if (j - i === 1) out.push(sorted[i]);
    else {
      let grp = sorted.slice(i, j);
      while (grp.length) {
        const top = pickTop(s, meta, grp, isDiv, rng);
        out.push(top);
        grp = grp.filter((t) => t !== top);
      }
    }
    i = j;
  }
  return out;
}

// Returns { order: 16 clubs best to worst (first 4 are division winners, seeded),
//           divOrder: Map div -> ordered clubs }
export function rankConference(s, meta, confTeams, rng) {
  const byDiv = new Map();
  for (const t of confTeams) {
    const d = meta.div[t];
    if (!byDiv.has(d)) byDiv.set(d, []);
    byDiv.get(d).push(t);
  }
  const winners = [];
  const divOrder = new Map();
  for (const [d, list] of byDiv) {
    const ord = rankGroup(s, meta, list, true, rng);
    divOrder.set(d, ord);
    winners.push(ord[0]);
  }
  const seeded = rankGroup(s, meta, winners, false, rng);
  const winnerSet = new Set(winners);
  const rest = rankGroup(s, meta, confTeams.filter((t) => !winnerSet.has(t)), false, rng);
  return { order: seeded.concat(rest), divOrder };
}

// Draft order among non-playoff clubs: worst pct first, ties -> lower SOS first, then coin flip.
export function draftOrder(s, meta, teams, rng) {
  const sorted = teams.slice().sort((a, b) => s.pct[a] - s.pct[b]);
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && s.pct[sorted[j]] === s.pct[sorted[i]]) j++;
    if (j - i === 1) out.push(sorted[i]);
    else {
      const grp = sorted.slice(i, j);
      const sos = strengthOfSchedule(s, grp);
      const idx = grp.map((_, k) => k).sort((a, b) => (sos[a] - sos[b]) || (rng() - 0.5));
      for (const k of idx) out.push(grp[k]);
    }
    i = j;
  }
  return out;
}
