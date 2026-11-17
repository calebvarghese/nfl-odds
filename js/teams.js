// Static NFL team metadata. conf: 0 = AFC, 1 = NFC. div index 0..7:
// 0 AFC East, 1 AFC North, 2 AFC South, 3 AFC West, 4 NFC East, 5 NFC North, 6 NFC South, 7 NFC West.
export const CONF_NAMES = ['AFC', 'NFC'];
export const DIV_NAMES = ['AFC East', 'AFC North', 'AFC South', 'AFC West',
  'NFC East', 'NFC North', 'NFC South', 'NFC West'];

const T = (abbr, city, name, div) => ({ abbr, city, name, div, conf: div < 4 ? 0 : 1 });

export const TEAMS = [
  T('BUF', 'Buffalo', 'Bills', 0), T('MIA', 'Miami', 'Dolphins', 0), T('NE', 'New England', 'Patriots', 0), T('NYJ', 'New York', 'Jets', 0),
  T('BAL', 'Baltimore', 'Ravens', 1), T('CIN', 'Cincinnati', 'Bengals', 1), T('CLE', 'Cleveland', 'Browns', 1), T('PIT', 'Pittsburgh', 'Steelers', 1),
  T('HOU', 'Houston', 'Texans', 2), T('IND', 'Indianapolis', 'Colts', 2), T('JAX', 'Jacksonville', 'Jaguars', 2), T('TEN', 'Tennessee', 'Titans', 2),
  T('DEN', 'Denver', 'Broncos', 3), T('KC', 'Kansas City', 'Chiefs', 3), T('LV', 'Las Vegas', 'Raiders', 3), T('LAC', 'Los Angeles', 'Chargers', 3),
  T('DAL', 'Dallas', 'Cowboys', 4), T('NYG', 'New York', 'Giants', 4), T('PHI', 'Philadelphia', 'Eagles', 4), T('WSH', 'Washington', 'Commanders', 4),
  T('CHI', 'Chicago', 'Bears', 5), T('DET', 'Detroit', 'Lions', 5), T('GB', 'Green Bay', 'Packers', 5), T('MIN', 'Minnesota', 'Vikings', 5),
  T('ATL', 'Atlanta', 'Falcons', 6), T('CAR', 'Carolina', 'Panthers', 6), T('NO', 'New Orleans', 'Saints', 6), T('TB', 'Tampa Bay', 'Buccaneers', 6),
  T('ARI', 'Arizona', 'Cardinals', 7), T('LAR', 'Los Angeles', 'Rams', 7), T('SF', 'San Francisco', '49ers', 7), T('SEA', 'Seattle', 'Seahawks', 7),
];

export const TEAM_INDEX = Object.fromEntries(TEAMS.map((t, i) => [t.abbr, i]));

export function logoUrl(abbr) {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${abbr.toLowerCase()}.png`;
}
