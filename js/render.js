// DOM rendering for the simulator view.
import { TEAMS, DIV_NAMES, CONF_NAMES } from './teams.js';
import { fmtDate, fmtTime, fmtPct, fmtRecord, fmtDivRecord, possessive, logo, tint } from './format.js';

const SCEN_LABEL = {
  playoffs: 'chance to make the playoffs',
  division: 'chance to win the division',
  seed1: 'chance to earn the No. 1 seed',
  pick1: 'chance to get the No. 1 pick',
};
const SCEN_VERB = { playoffs: 'make the playoffs', division: 'win the division', seed1: 'earn the No. 1 seed', pick1: 'get the No. 1 pick' };

function teamButton(ctx, r, side, teamIdx, { showPct = true } = {}) {
  const lock = ctx.state.locks[r];
  const t = TEAMS[teamIdx];
  let cls = 'tbtn';
  let pct = '';
  if (lock === side) cls += ' locked';
  else if (lock >= 0) cls += ' loser';
  else if (showPct) {
    const c = ctx.cond(r, side);
    const style = ` style="--tint:${tint(c == null ? null : c - ctx.baseline, ctx.baseline)}"`;
    pct = `<span class="pct"${style}>${fmtPct(c)}</span>`;
  }
  return `<button type="button" class="${cls}" data-r="${r}" data-side="${side}" aria-pressed="${lock === side}">${logo(t.abbr)}<span class="nm">${t.name}</span>${pct}</button>`;
}

function teamGames(ctx) {
  const me = ctx.state.team;
  const name = TEAMS[me].name;
  const rows = ctx.remaining
    .map((gi, r) => ({ g: ctx.games[gi], r }))
    .filter(({ g }) => g.homeIdx === me || g.awayIdx === me);
  if (!rows.length) return `<h2>${possessive(name)} games</h2><p class="copy">The ${name} have no games remaining.</p>`;
  const body = rows.map(({ g, r }) => {
    const away = g.awayIdx === me;
    const mySide = away ? 1 : 0;
    const opp = away ? g.homeIdx : g.awayIdx;
    return `<div class="game-row">
      <div class="when"><b>Week ${g.week}</b>${fmtDate(g.date)}</div>
      ${teamButton(ctx, r, mySide, me)}
      <span class="at">${away ? '@' : ''}</span>
      ${teamButton(ctx, r, 1 - mySide, opp)}
    </div>`;
  }).join('');
  const weeks = [...new Set(rows.map(({ g }) => g.week))];
  return `<h2>${possessive(name)} games</h2>
    <div class="col-heads"><span></span><span>Odds if the ${name} win</span><span></span><span>Odds if the ${name} lose</span></div>
    ${body}
    <div class="week-reset"><button type="button" class="reset" data-reset-weeks="${weeks.join(',')}" data-reset-team="${me}">${resetIcon()} Reset</button></div>`;
}

function resetIcon() {
  return `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3a5 5 0 1 1-4.5 2.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 1.5v4h4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
}

function allGames(ctx) {
  const byWeek = new Map();
  ctx.remaining.forEach((gi, r) => {
    const g = ctx.games[gi];
    if (!byWeek.has(g.week)) byWeek.set(g.week, []);
    byWeek.get(g.week).push({ g, r });
  });
  let html = `<h2>All games by week</h2>`;
  for (const [week, rows] of byWeek) {
    html += `<div class="week-head"><h3>Week ${week}</h3></div>`;
    html += rows.map(({ g, r }) => `<div class="game-row wk">
      <div class="when"><b>${fmtDate(g.date)}</b>${fmtTime(g.date)}</div>
      ${teamButton(ctx, r, 1, g.awayIdx)}
      ${teamButton(ctx, r, 0, g.homeIdx)}
    </div>`).join('');
    html += `<div class="week-reset"><button type="button" class="reset" data-reset-weeks="${week}">${resetIcon()} Reset</button></div>`;
  }
  return html;
}

export function renderLeft(ctx) {
  const name = TEAMS[ctx.state.team].name;
  return `
    <div class="legend">
      <div class="cap">Impact of game result</div>
      <div class="bar"></div>
      <div class="ends"><span class="inc">Increase odds</span><span>No change</span><span class="dec">Decrease odds</span></div>
    </div>
    ${teamGames(ctx)}
    <p class="copy">The tables below represent all NFL games remaining. While the ${name}’ games are typically the most important, outcomes from other games can affect the ${name}’ chances indirectly.</p>
    ${allGames(ctx)}`;
}

function seedBadge(rank) {
  return `<span class="badge ${rank <= 7 ? 'in' : ''}">${rank}</span>`;
}

function divisionTable(ctx) {
  const me = ctx.state.team;
  const t = TEAMS[me];
  const { state: s, confs } = ctx.selections;
  const conf = confs[t.conf];
  const rankOf = new Map(conf.order.map((x, i) => [x, i + 1]));
  const rows = conf.divOrder.get(t.div).map((x) => `<tr class="${x === me ? 'me' : ''}">
      <td class="seed">${seedBadge(rankOf.get(x))}</td>
      <td>${logo(TEAMS[x].abbr)}${TEAMS[x].name}</td>
      <td class="r">${fmtRecord(s, x)}</td>
      <td class="r">${fmtDivRecord(s, x)}</td></tr>`).join('');
  return `<div class="tbl-title">${DIV_NAMES[t.div]} with your selections</div>
    <table class="st"><thead><tr><th colspan="2">Playoff seed</th><th class="r">Overall</th><th class="r">Div.</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function conferenceTable(ctx) {
  const me = ctx.state.team;
  const t = TEAMS[me];
  const { state: s, confs } = ctx.selections;
  const order = confs[t.conf].order;
  const groups = [['Leaders', 0, 4], ['Wild card', 4, 7], ['In the hunt', 7, 16]];
  let rows = '';
  for (const [label, a, b] of groups) {
    for (let i = a; i < b; i++) {
      const x = order[i];
      const first = i === a;
      rows += `<tr class="${x === me ? 'me' : ''} ${i === b - 1 ? 'grp-end' : ''}">
        <td class="seed">${seedBadge(i + 1)}</td>
        <td>${logo(TEAMS[x].abbr)}${TEAMS[x].name}</td>
        <td class="r">${fmtRecord(s, x)}</td>
        ${first ? `<td class="grp" rowspan="${b - a}">${label}</td>` : ''}</tr>`;
    }
  }
  return `<div class="tbl-title">${CONF_NAMES[t.conf]} seeds with your selections</div>
    <table class="st"><thead><tr><th colspan="2">Playoff seed</th><th class="r">Overall</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderPanel(ctx) {
  const me = ctx.state.team;
  const name = TEAMS[me].name;
  const sc = ctx.state.scenario;
  const p = ctx.scenarioProb(me, sc);
  const b = ctx.seedBreakdown(me);
  const bar = (lbl, v, cls = '') => `<span class="lbl">${lbl}</span><div class="track"><i class="${cls}" style="width:${(v * 100).toFixed(1)}%"></i></div><span class="val">${fmtPct(v)}</span>`;
  const done = ctx.sims.done, total = ctx.sims.total;
  return `
    <div class="big">${fmtPct(p)}</div>
    <h3 class="big-label">${possessive(name)} ${SCEN_LABEL[sc]}</h3>
    <div class="sims"><em>${done.toLocaleString()} simulations</em><div class="prog"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div><button type="button" id="run-more" ${ctx.sims.running ? 'disabled' : ''}>Run more ➤</button></div>
    <div class="bars">
      ${bar('No. 1 seed', b.seed1)}
      ${bar('Host wild card', b.host)}
      ${bar('Wild card', b.wild)}
      ${bar('Out', b.out, 'out')}
    </div>
    ${divisionTable(ctx)}
    ${conferenceTable(ctx)}`;
}

export function renderSubbar(ctx) {
  const n = ctx.state.locks.reduce((k, v) => k + (v >= 0 ? 1 : 0), 0);
  return `<b>${n}/${ctx.remaining.length}</b> game results selected.`;
}

export { SCEN_VERB };
