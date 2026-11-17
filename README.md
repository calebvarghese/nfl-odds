# 2026 NFL Playoff Simulator

Static clone of The Athletic's NFL playoff picture simulator. Pick a team, lock
game results, and watch a 40,000-run Monte Carlo simulation update playoff,
division, No. 1 seed and No. 1 pick odds.

## Run

```
python3 -m http.server 8000
```

Open http://localhost:8000. Modules and the Web Worker need an HTTP origin, so
opening `index.html` directly from disk will not work.

## Data

Loaded live from ESPN's public scoreboard API on page load (cached in
`localStorage` for 10 minutes). If that fails the page falls back to
`data/season.json`. Refresh the snapshot with:

```
python3 scripts/fetch_season.py
```

## Model

- Win probability: Elo built from 2026 results (K=28, margin-of-victory
  multiplier, +48 home field). Where ESPN posts a betting line, the
  spread-implied probability is used instead.
- Seeding: NFL tiebreakers in order: head-to-head, division record, common
  games, conference record, strength of victory, strength of schedule, coin
  flip. Wild-card ties reduce to one club per division first.
- Draft order: non-playoff clubs by record, lower strength of schedule first.
- Conditional odds for every remaining game come from the same simulation run
  (hits given that side won / times that side won).

## Sanity check

```
node scripts/test_sim.mjs
```

Prints Elo top/bottom 5, timing, and checks that playoff probabilities sum to
7.0 per conference and No. 1 seed / No. 1 pick probabilities sum to 1.0.

## State

Team, scenario, view and locked results live in the URL hash, so a scenario
can be shared by copying the link.
