// node scripts/test_sim.mjs  -- sanity-check the simulator on data/season.json
import { readFileSync } from 'node:fs';
import { TEAMS, TEAM_INDEX } from '../js/teams.js';
import { computeElo, homeWinProb } from '../js/elo.js';
import { createSim } from '../js/simcore.js';

const season = JSON.parse(readFileSync(new URL('../data/season.json', import.meta.url)));
const ratings = computeElo(season.games, TEAMS.map((t) => t.abbr));
const sorted = [...ratings].sort((a, b) => b[1] - a[1]);
console.log('top5', sorted.slice(0, 5).map(([a, r]) => `${a} ${r.toFixed(0)}`).join(' '));
console.log('bot5', sorted.slice(-5).map(([a, r]) => `${a} ${r.toFixed(0)}`).join(' '));

const games = season.games.map((g) => ({
  homeIdx: TEAM_INDEX[g.home], awayIdx: TEAM_INDEX[g.away], final: g.final,
  homeScore: g.homeScore, awayScore: g.awayScore, prob: g.final ? null : homeWinProb(g, ratings),
}));
const sim = createSim({ teams: TEAMS, games });
const locks = new Int8Array(sim.R).fill(-1);
const N = 20000;
const t0 = Date.now();
sim.run(locks, N);
console.log(`${N} sims in ${Date.now() - t0} ms, R=${sim.R}`);
const a = sim.acc;
const p = (t, s) => a.seed[t * 8 + s] / a.n;
for (const c of [0, 1]) {
  let sumPlayoff = 0, sumSeed1 = 0;
  TEAMS.forEach((t, i) => { if (t.conf === c) { sumPlayoff += 1 - p(i, 0); sumSeed1 += p(i, 1); } });
  console.log(`conf ${c}: playoff sum ${sumPlayoff.toFixed(3)} seed1 sum ${sumSeed1.toFixed(3)}`);
}
console.log('pick1 sum', (a.pick1.reduce((x, y) => x + y, 0) / a.n).toFixed(3));
const rows = TEAMS.map((t, i) => ({ abbr: t.abbr, playoff: 1 - p(i, 0), div: a.divWin[i] / a.n, seed1: p(i, 1), pick1: a.pick1[i] / a.n }));
rows.sort((x, y) => y.playoff - x.playoff);
for (const r of rows) console.log(r.abbr.padEnd(4), (r.playoff * 100).toFixed(1).padStart(5), (r.div * 100).toFixed(1).padStart(5), (r.seed1 * 100).toFixed(1).padStart(5), (r.pick1 * 100).toFixed(1).padStart(5));
// conditional check for WSH on its first remaining game
const w = TEAM_INDEX.WSH;
const r0 = sim.remaining.findIndex((gi) => games[gi].homeIdx === w || games[gi].awayIdx === w);
const off = (0 * 32 + w) * sim.R * 2 + r0 * 2;
console.log('WSH cond first game: home-win', (a.cond[off] / a.gameN[r0 * 2]).toFixed(3), 'away-win', (a.cond[off + 1] / a.gameN[r0 * 2 + 1]).toFixed(3));
