// "End-of-season outcomes" band diagram + upcoming games panel.
import { TEAMS } from './teams.js';
import { fmtPct, fmtRecord, fmtDate, fmtWeekday, fmtTime, possessive, logo } from './format.js';

function band(x0, y0a, y0b, x1, y1a, y1b, fill, minH = 1.5) {
  if (y0b - y0a < minH) { y0b = y0a + minH; }
  if (y1b - y1a < minH) { y1b = y1a + minH; }
  const cx = (x0 + x1) / 2;
  return `<path d="M${x0},${y0a} C${cx},${y0a} ${cx},${y1a} ${x1},${y1a} L${x1},${y1b} C${cx},${y1b} ${cx},${y0b} ${x0},${y0b} Z" fill="${fill}"/>`;
}

export function renderOutcomes(ctx) {
  const me = ctx.state.team;
  const name = TEAMS[me].name;
  const a = ctx.acc;
  const n = a ? a.n : 0;
  const q = (k) => (n ? k / n : 0);
  const seed = (k) => q(a ? a.seed[me * 8 + k] : 0);
  const out = seed(0);
  const pick1 = q(a ? a.pick1[me] : 0);
  const items = [
    { key: 'seed1', p: seed(1), grp: 'in', lines: ['Div. champ,', 'No. 1 seed + bye'] },
    { key: 'seed24', p: seed(2) + seed(3) + seed(4), grp: 'in', lines: ['Div. champ,', 'No. 2, 3 or 4 seed'] },
    { key: 'wc', p: seed(5) + seed(6) + seed(7), grp: 'in', lines: ['Wild card berth,', 'No. 5, 6 or 7 seed'] },
    { key: 'pick218', p: Math.max(0, out - pick1), grp: 'out', lines: ['Pick No. 2–18', '2027 draft'] },
    { key: 'pick1', p: pick1, grp: 'out', lines: ['No. 1 pick', '2027 draft'] },
  ];
  const inP = items.filter((i) => i.grp === 'in').reduce((s, i) => s + i.p, 0);

  const W = 900, H = 600, X0 = 90, X1 = 700, TOP = 120, SPAN = 400, GAP = 26, MINH = 3;
  // left stack: playoffs on top, out below, with a gap between groups
  const groupGap = inP > 0 && out > 0 ? 10 : 0;
  const scale = (SPAN - groupGap) / 1;
  let y = TOP;
  const leftIn = { a: y, b: y + inP * scale }; y = leftIn.b + groupGap;
  const leftOut = { a: y, b: y + out * scale };
  // right stack: each item with its own gap
  const totalRightGap = GAP * (items.length - 1);
  const rscale = (SPAN + 60 - totalRightGap) / 1;
  let ry = TOP - 30;
  let svg = `<defs>
    <linearGradient id="g-in" x1="0" x2="1"><stop offset="0" stop-color="#cfe6e0"/><stop offset="1" stop-color="#1b4f46"/></linearGradient>
    <linearGradient id="g-out" x1="0" x2="1"><stop offset="0" stop-color="#f0e2c0"/><stop offset="1" stop-color="#6b4310"/></linearGradient>
  </defs>`;
  let cursorIn = leftIn.a, cursorOut = leftOut.a;
  let labels = '';
  for (const it of items) {
    const h = Math.max(it.p * rscale, it.p > 0 ? MINH : 0);
    const y1a = ry, y1b = ry + h;
    if (it.grp === 'in') {
      const h0 = it.p * scale;
      svg += band(X0, cursorIn, cursorIn + h0, X1, y1a, y1b, 'url(#g-in)', it.p > 0 ? MINH : 0);
      cursorIn += h0;
    } else {
      const h0 = it.p * scale;
      svg += band(X0, cursorOut, cursorOut + h0, X1, y1a, y1b, 'url(#g-out)', it.p > 0 ? MINH : 0);
      cursorOut += h0;
    }
    const color = it.grp === 'in' ? '#1b4f46' : '#6b4310';
    const ly = Math.max(y1b, y1a + 14);
    labels += `<text x="${X1 + 16}" y="${ly}" class="pct-lbl" fill="${color}">${fmtPct(it.p)}</text>
      <text x="${X1 + 16}" y="${ly + 24}" class="lbl-sm">${it.lines[0]}</text>
      <text x="${X1 + 16}" y="${ly + 44}" class="lbl-sm">${it.lines[1]}</text>`;
    ry = y1b + GAP + (h < 50 ? 50 - h : 0);
  }
  // left axis bar and labels
  svg += `<rect x="${X0 - 6}" y="${TOP}" width="4" height="${SPAN}" fill="#121212"/>`;
  svg += `<text x="${X0 - 90}" y="${TOP + SPAN / 2 - 12}" class="lbl-rec-cap">Record</text>`;
  svg += `<text x="${X0 - 90}" y="${TOP + SPAN / 2 + 24}" class="lbl-rec">${fmtRecord(ctx.selections.state, me)}</text>`;
  svg += `<text x="${X0 + 60}" y="${TOP - 70}" class="lbl-mid" fill="#1b4f46">Make playoffs</text>
    <text x="${X0 + 60}" y="${TOP - 14}" class="lbl-big" fill="#1b4f46">${fmtPct(inP)}</text>
    <text x="${X0 + 150}" y="${TOP + 2}" fill="#1b4f46" font-size="12">▼</text>
    <text x="${X0 + 150}" y="${TOP + SPAN + 20}" fill="#6b4310" font-size="12">▲</text>
    <text x="${X0 + 60}" y="${TOP + SPAN + 78}" class="lbl-big" fill="#6b4310">${fmtPct(out)}</text>
    <text x="${X0 + 100}" y="${TOP + SPAN + 110}" class="lbl-mid" fill="#6b4310">Out</text>`;
  svg += labels;

  return `<div class="outcomes">
    <p class="copy">Below are our projections for every way the ${name}’ season may end, from the No. 1 seed in the ${TEAMS[me].conf ? 'NFC' : 'AFC'} to the No. 1 pick in the NFL draft. These estimates update as you lock game results.</p>
    <h2>End-of-season outcomes</h2>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="End-of-season outcomes for the ${name}">${svg}</svg>
    <div class="out-list">
      <div class="out-sum"><span>Record <b>${fmtRecord(ctx.selections.state, me)}</b></span><span class="in">Make playoffs <b>${fmtPct(inP)}</b></span><span class="out">Out <b>${fmtPct(out)}</b></span></div>
      <div class="bars">${items.map((it) => `<span class="lbl">${it.lines.join(' ')}</span><div class="track"><i class="${it.grp === 'out' ? 'out' : ''}" style="width:${(it.p * 100).toFixed(1)}%"></i></div><span class="val">${fmtPct(it.p)}</span>`).join('')}</div>
    </div>
    <p class="copy">This diagram shows our projections for every possible end-of-season outcome the ${name} may attain.</p>
  </div>`;
}

export function renderUpcoming(ctx) {
  const me = ctx.state.team;
  const name = TEAMS[me].name;
  const rows = ctx.remaining
    .map((gi, r) => ({ g: ctx.games[gi], r }))
    .filter(({ g }) => g.homeIdx === me || g.awayIdx === me)
    .slice(0, 3)
    .map(({ g, r }) => {
      const lock = ctx.state.locks[r];
      const ph = lock === 0 ? 1 : lock === 1 ? 0 : g.prob;
      const pa = 1 - ph;
      const line = (idx, p, fav) => `<div>${logo(TEAMS[idx].abbr)}${TEAMS[idx].name}</div><div class="wp ${fav ? 'fav' : ''}">${Math.round(p * 100)}%</div>`;
      return `<div class="g">
        <div class="d">${fmtWeekday(g.date)} ${fmtDate(g.date)}<br>${fmtTime(g.date)}</div>
        ${line(g.awayIdx, pa, pa > ph)}
        ${line(g.homeIdx, ph, ph >= pa)}
      </div>`;
    }).join('');
  return `<div class="upc">
    <h3>Upcoming ${name} games</h3>
    <div class="note"><span>All times are in Eastern Time.</span><b>Win prob.</b></div>
    ${rows || '<p>No games remaining.</p>'}
    <a class="more" href="#view=sim">Full schedule and all game projections ›</a>
  </div>`;
}
