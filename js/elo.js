// Elo ratings from completed games (FiveThirtyEight-style) and win probabilities.
export const HOME_FIELD = 48;
export const K = 28;
export const SPREAD_SIGMA = 13.45;

function expected(diff) {
  return 1 / (1 + Math.pow(10, -diff / 400));
}

// games: normalized games sorted by date; returns Map abbr -> rating.
export function computeElo(games, abbrs) {
  const r = new Map(abbrs.map((a) => [a, 1500]));
  for (const g of games) {
    if (!g.final) continue;
    const rh = r.get(g.home);
    const ra = r.get(g.away);
    const diff = rh + HOME_FIELD - ra;
    const pHome = expected(diff);
    const result = g.homeScore > g.awayScore ? 1 : g.homeScore < g.awayScore ? 0 : 0.5;
    const margin = Math.abs(g.homeScore - g.awayScore);
    const winnerDiff = result === 1 ? diff : result === 0 ? -diff : 0;
    const mult = Math.log(margin + 1) * (2.2 / (winnerDiff * 0.001 + 2.2));
    const delta = K * mult * (result - pHome);
    r.set(g.home, rh + delta);
    r.set(g.away, ra - delta);
  }
  return r;
}

// Standard normal CDF (Abramowitz-Stegun 7.1.26).
export function normCdf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? y : 1 - y;
}

// Probability the home team wins.
export function homeWinProb(game, ratings) {
  if (game.spread != null) return normCdf(game.spread / SPREAD_SIGMA);
  return expected(ratings.get(game.home) + HOME_FIELD - ratings.get(game.away));
}
