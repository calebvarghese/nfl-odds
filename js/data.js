// Season data: live from ESPN (cached 10 min in localStorage), fallback to data/season.json.
const SEASON = 2026;
const CACHE_KEY = `nfl-sim-season-${SEASON}`;
const CACHE_TTL_MS = 10 * 60 * 1000;
const URL = (week) =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${SEASON}`;

function parseSpread(comp) {
  const odds = comp.odds && comp.odds[0];
  if (!odds || !odds.details) return null;
  if (odds.details === 'EVEN') return 0;
  const m = /^(\S+)\s+(-?[\d.]+)$/.exec(odds.details);
  if (!m) return null;
  const home = comp.competitors.find((c) => c.homeAway === 'home');
  const pts = parseFloat(m[2]);
  // Positive spread = home team favored by that many points.
  return m[1] === home.team.abbreviation ? -pts : pts;
}

function normalizeWeek(week, payload) {
  return payload.events.map((ev) => {
    const comp = ev.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === 'home');
    const away = comp.competitors.find((c) => c.homeAway === 'away');
    const status = comp.status.type.name;
    const final = status === 'STATUS_FINAL';
    return {
      id: ev.id,
      week,
      date: ev.date,
      home: home.team.abbreviation,
      away: away.team.abbreviation,
      homeScore: final ? Number(home.score || 0) : null,
      awayScore: final ? Number(away.score || 0) : null,
      final,
      status,
      spread: parseSpread(comp),
    };
  });
}

async function fetchLive() {
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
  const payloads = await Promise.all(
    weeks.map(async (w) => {
      const r = await fetch(URL(w));
      if (!r.ok) throw new Error(`ESPN week ${w}: ${r.status}`);
      return [w, await r.json()];
    }),
  );
  const games = payloads.flatMap(([w, p]) => normalizeWeek(w, p));
  games.sort((a, b) => a.week - b.week || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (games.length < 200) throw new Error('ESPN returned too few games');
  return { season: SEASON, games, source: 'espn', fetchedAt: Date.now() };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.fetchedAt > CACHE_TTL_MS) return null;
    return { ...data, source: 'cache' };
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}

export async function loadSeason() {
  const cached = readCache();
  if (cached) return cached;
  try {
    const live = await fetchLive();
    writeCache(live);
    return live;
  } catch (err) {
    console.warn('Live fetch failed, using snapshot:', err);
    const r = await fetch('data/season.json');
    const snap = await r.json();
    return { ...snap, source: 'snapshot', fetchedAt: 0 };
  }
}
