// Monte Carlo season simulator. Used by the worker (and by node tests).
import { createState, copyState, addResult, computePct, rankConference, draftOrder } from './standings.js';

export const SCENARIOS = ['playoffs', 'division', 'seed1', 'pick1'];
export const N_SCEN = SCENARIOS.length;

function resultOf(g) {
  return g.homeScore > g.awayScore ? 0 : g.homeScore < g.awayScore ? 1 : 2;
}

// teams: [{conf, div}] indexed; games: [{homeIdx, awayIdx, final, homeScore, awayScore, prob}]
export function createSim({ teams, games }, rng = Math.random) {
  const n = teams.length;
  const meta = {
    n,
    div: Int8Array.from(teams.map((t) => t.div)),
    conf: Int8Array.from(teams.map((t) => t.conf)),
  };
  const confTeams = [[], []];
  teams.forEach((t, i) => confTeams[t.conf].push(i));

  const base = createState(n);
  for (const g of games) if (g.final) addResult(base, meta, g.homeIdx, g.awayIdx, resultOf(g));

  const remaining = games.map((g, i) => (g.final ? -1 : i)).filter((i) => i >= 0);
  const R = remaining.length;
  const remHome = Int8Array.from(remaining.map((i) => games[i].homeIdx));
  const remAway = Int8Array.from(remaining.map((i) => games[i].awayIdx));
  const remProb = Float64Array.from(remaining.map((i) => games[i].prob));

  const st = createState(n);
  const winner = new Int8Array(R);

  const acc = {
    n: 0,
    seed: new Int32Array(n * 8),        // [team*8 + seed], seed 0 = out
    divWin: new Int32Array(n),
    pick1: new Int32Array(n),
    wins: new Int32Array(n * 18),       // final win count histogram (ties count as half, floored)
    gameN: new Int32Array(R * 2),       // [game*2 + side] times that side won
    cond: new Int32Array(N_SCEN * n * R * 2), // [(scen*n+team)*R*2 + game*2 + side]
  };

  function reset() {
    acc.n = 0;
    for (const k of ['seed', 'divWin', 'pick1', 'wins', 'gameN', 'cond']) acc[k].fill(0);
  }

  const lists = [[], [], [], []];

  function simulate(locks) {
    copyState(st, base);
    for (let r = 0; r < R; r++) {
      const w = locks[r] >= 0 ? locks[r] : rng() < remProb[r] ? 0 : 1;
      winner[r] = w;
      addResult(st, meta, remHome[r], remAway[r], w);
    }
    computePct(st);
    for (const l of lists) l.length = 0;
    const nonPlayoff = [];
    for (let c = 0; c < 2; c++) {
      const { order } = rankConference(st, meta, confTeams[c], rng);
      for (let k = 0; k < order.length; k++) {
        const t = order[k];
        if (k < 7) {
          acc.seed[t * 8 + k + 1]++;
          lists[0].push(t);
          if (k < 4) { acc.divWin[t]++; lists[1].push(t); }
          if (k === 0) lists[2].push(t);
        } else {
          acc.seed[t * 8]++;
          nonPlayoff.push(t);
        }
      }
    }
    const first = draftOrder(st, meta, nonPlayoff, rng)[0];
    acc.pick1[first]++;
    lists[3].push(first);
    for (let t = 0; t < n; t++) acc.wins[t * 18 + Math.min(17, Math.floor(st.W[t]))]++;

    for (let r = 0; r < R; r++) acc.gameN[r * 2 + winner[r]]++;
    for (let sIdx = 0; sIdx < N_SCEN; sIdx++) {
      for (const t of lists[sIdx]) {
        const off = (sIdx * n + t) * R * 2;
        for (let r = 0; r < R; r++) acc.cond[off + r * 2 + winner[r]]++;
      }
    }
    acc.n++;
  }

  function run(locks, count) {
    for (let i = 0; i < count; i++) simulate(locks);
  }

  // Deterministic standings from completed + locked games only.
  function selectionsStandings(locks) {
    const s = createState(n);
    copyState(s, base);
    for (let r = 0; r < R; r++) if (locks[r] >= 0) addResult(s, meta, remHome[r], remAway[r], locks[r]);
    computePct(s);
    const confs = [0, 1].map((c) => rankConference(s, meta, confTeams[c], () => 0.5));
    return { state: s, confs };
  }

  return { n, R, remaining, meta, acc, reset, run, selectionsStandings };
}
