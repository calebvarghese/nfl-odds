import { TEAMS, TEAM_INDEX, logoUrl } from './teams.js';
import { loadSeason } from './data.js';
import { computeElo, homeWinProb } from './elo.js';
import { createSim, SCENARIOS } from './simcore.js';
import { renderLeft, renderPanel, renderSubbar } from './render.js';
import { renderOutcomes, renderUpcoming } from './outcomes.js';

const SIMS = 40000;
const BATCH = 4000;

const $ = (s) => document.querySelector(s);
const els = {
  left: $('#left'), panel: $('#panel'), foot: $('#foot'),
  teamSelect: $('#team-select'), scenarioSelect: $('#scenario-select'),
  lockCount: $('#lock-count'), resetAll: $('#reset-all'),
  subSim: $('#subbar-sim'), subCharts: $('#subbar-charts'),
  logo: $('#sub-logo'), logo2: $('#sub-logo-2'),
};

const state = { team: TEAM_INDEX.WSH, scenario: 'playoffs', view: 'sim', locks: null };
let games, remaining, sim, worker, acc = null;
const sims = { done: 0, total: 0, running: false };
let runId = 0;

// ---------- hash state ----------
function readHash() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (h.get('team') && TEAM_INDEX[h.get('team')] != null) state.team = TEAM_INDEX[h.get('team')];
  if (h.get('scenario') && SCENARIOS.includes(h.get('scenario'))) state.scenario = h.get('scenario');
  state.view = h.get('view') === 'charts' ? 'charts' : 'sim';
  state.locks.fill(-1);
  const locks = h.get('locks');
  if (locks) {
    const byId = new Map(remaining.map((gi, r) => [games[gi].id, r]));
    for (const tok of locks.split(',')) {
      const m = /^(\d+)([ha])$/.exec(tok);
      if (m && byId.has(m[1])) state.locks[byId.get(m[1])] = m[2] === 'h' ? 0 : 1;
    }
  }
}

let writingHash = false;
function writeHash() {
  const h = new URLSearchParams();
  h.set('team', TEAMS[state.team].abbr);
  if (state.scenario !== 'playoffs') h.set('scenario', state.scenario);
  if (state.view !== 'sim') h.set('view', state.view);
  const locks = [];
  state.locks.forEach((v, r) => { if (v >= 0) locks.push(`${games[remaining[r]].id}${v === 0 ? 'h' : 'a'}`); });
  if (locks.length) h.set('locks', locks.join(','));
  writingHash = true;
  history.replaceState(null, '', `#${h.toString().replace(/%2C/g, ',')}`);
  writingHash = false;
}

// ---------- derived numbers ----------
const ctx = {
  state, sims,
  get games() { return games; },
  get remaining() { return remaining; },
  get acc() { return acc; },
  get selections() { return sim.selectionsStandings(state.locks); },
  get baseline() { return this.scenarioProb(state.team, state.scenario); },
  scenarioProb(t, sc) {
    if (!acc || !acc.n) return null;
    const n = acc.n;
    switch (sc) {
      case 'playoffs': return 1 - acc.seed[t * 8] / n;
      case 'division': return acc.divWin[t] / n;
      case 'seed1': return acc.seed[t * 8 + 1] / n;
      case 'pick1': return acc.pick1[t] / n;
      default: return null;
    }
  },
  seedBreakdown(t) {
    if (!acc || !acc.n) return { seed1: 0, host: 0, wild: 0, out: 0 };
    const n = acc.n, s = (k) => acc.seed[t * 8 + k] / n;
    return { seed1: s(1), host: s(2) + s(3) + s(4), wild: s(5) + s(6) + s(7), out: s(0) };
  },
  // P(scenario for selected team | game r won by side)
  cond(r, side) {
    if (!acc || !acc.n) return null;
    const cnt = acc.gameN[r * 2 + side];
    if (!cnt) return null;
    const sIdx = SCENARIOS.indexOf(state.scenario);
    return acc.cond[((sIdx * 32 + state.team) * remaining.length + r) * 2 + side] / cnt;
  },
};

// ---------- rendering ----------
function render() {
  const t = TEAMS[state.team];
  els.logo.src = els.logo2.src = logoUrl(t.abbr);
  els.teamSelect.value = String(state.team);
  els.scenarioSelect.value = state.scenario;
  els.lockCount.innerHTML = renderSubbar(ctx);
  els.subSim.hidden = state.view !== 'sim';
  els.subCharts.hidden = state.view !== 'charts';
  document.querySelectorAll('.nav-links a').forEach((a) => a.classList.toggle('active', a.dataset.view === state.view));
  if (state.view === 'sim') {
    els.left.innerHTML = renderLeft(ctx);
    els.panel.innerHTML = renderPanel(ctx);
  } else {
    els.left.innerHTML = renderOutcomes(ctx);
    els.panel.innerHTML = renderUpcoming(ctx);
  }
}

function renderPanelOnly() {
  if (state.view === 'sim') els.panel.innerHTML = renderPanel(ctx);
  else els.left.innerHTML = renderOutcomes(ctx);
}

// ---------- simulation ----------
function startRun({ reset }) {
  runId++;
  sims.running = true;
  if (reset) { sims.done = 0; sims.total = SIMS; } else { sims.total += SIMS; }
  worker.postMessage({ type: 'run', runId, reset, locks: state.locks, count: SIMS, batch: BATCH });
}

function onWorker(e) {
  const msg = e.data;
  if (msg.type === 'ready') { startRun({ reset: true }); return; }
  if (msg.type === 'progress' && msg.runId === runId) {
    acc = msg.acc;
    sims.done = acc.n;
    sims.running = msg.done < msg.total;
    render();
  }
}

// ---------- events ----------
function setLock(r, side) {
  state.locks[r] = state.locks[r] === side ? -1 : side;
  writeHash();
  render();
  startRun({ reset: true });
}

function resetLocks(filter) {
  let changed = false;
  state.locks.forEach((v, r) => { if (v >= 0 && filter(r)) { state.locks[r] = -1; changed = true; } });
  if (!changed) return;
  writeHash();
  render();
  startRun({ reset: true });
}

function wireEvents() {
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#view="]');
    if (link) {
      e.preventDefault();
      state.view = link.getAttribute('href') === '#view=charts' ? 'charts' : 'sim';
      writeHash();
      render();
      window.scrollTo(0, 0);
      return;
    }
    const btn = e.target.closest('button.tbtn');
    if (btn) { setLock(Number(btn.dataset.r), Number(btn.dataset.side)); return; }
    const wk = e.target.closest('[data-reset-weeks]');
    if (wk) {
      const weeks = new Set(wk.dataset.resetWeeks.split(',').map(Number));
      const team = wk.dataset.resetTeam != null ? Number(wk.dataset.resetTeam) : null;
      resetLocks((r) => {
        const g = games[remaining[r]];
        return weeks.has(g.week) && (team == null || g.homeIdx === team || g.awayIdx === team);
      });
      return;
    }
    if (e.target.closest('#run-more')) { startRun({ reset: false }); render(); }
  });
  els.resetAll.addEventListener('click', () => resetLocks(() => true));
  els.teamSelect.addEventListener('change', () => { state.team = Number(els.teamSelect.value); writeHash(); render(); });
  els.scenarioSelect.addEventListener('change', () => { state.scenario = els.scenarioSelect.value; writeHash(); render(); });
  window.addEventListener('hashchange', () => {
    if (writingHash) return;
    const before = Array.from(state.locks).join(',');
    readHash();
    render();
    if (Array.from(state.locks).join(',') !== before) startRun({ reset: true });
  });
}

// ---------- boot ----------
async function boot() {
  const sorted = TEAMS.map((t, i) => ({ i, label: `${t.city} ${t.name}` })).sort((a, b) => a.label.localeCompare(b.label));
  els.teamSelect.innerHTML = sorted.map(({ i, label }) => `<option value="${i}">${label}</option>`).join('');

  const season = await loadSeason();
  const ratings = computeElo(season.games, TEAMS.map((t) => t.abbr));
  games = season.games.map((g) => ({
    id: g.id, week: g.week, date: g.date, final: g.final,
    homeIdx: TEAM_INDEX[g.home], awayIdx: TEAM_INDEX[g.away],
    homeScore: g.homeScore, awayScore: g.awayScore,
    prob: g.final ? null : homeWinProb(g, ratings),
  }));
  sim = createSim({ teams: TEAMS, games });
  remaining = sim.remaining;
  state.locks = new Int8Array(remaining.length).fill(-1);
  readHash();
  writeHash();

  const src = { espn: 'ESPN (live)', cache: 'ESPN (cached)', snapshot: 'local snapshot' }[season.source];
  const played = games.filter((g) => g.final).length;
  els.foot.textContent = `Data: ${src}. ${played} games final, ${remaining.length} remaining. Win probabilities from Elo ratings built on 2026 results, overridden by the betting line where one is posted. Seeding uses NFL tiebreakers (head-to-head, division, common games, conference, strength of victory, strength of schedule).`;

  worker = new Worker('js/sim.worker.js', { type: 'module' });
  worker.onmessage = onWorker;
  worker.postMessage({ type: 'init', data: { teams: TEAMS.map((t) => ({ conf: t.conf, div: t.div })), games } });
  wireEvents();
  render();
}

boot().catch((err) => {
  console.error(err);
  els.left.innerHTML = `<div class="loading">Could not load season data: ${err.message}</div>`;
});
