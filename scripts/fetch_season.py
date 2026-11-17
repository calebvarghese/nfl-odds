#!/usr/bin/env python3
"""Snapshot the 2026 NFL regular season from ESPN into data/season.json.

Run: python3 scripts/fetch_season.py
"""
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SEASON = 2026
URL = ("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
       "?seasontype=2&week={week}&dates={season}")


def fetch_week(week):
    with urllib.request.urlopen(URL.format(week=week, season=SEASON), timeout=20) as r:
        return week, json.load(r)


def parse_spread(comp):
    odds = comp.get("odds") or []
    if not odds:
        return None
    details = odds[0].get("details")  # e.g. "DET -2.5" or "EVEN"
    if not details or details == "EVEN":
        return 0.0 if details == "EVEN" else None
    try:
        fav, num = details.rsplit(" ", 1)
        pts = float(num)
    except ValueError:
        return None
    home = next(c for c in comp["competitors"] if c["homeAway"] == "home")
    # Positive spread = home team favored by that many points.
    return -pts if fav == home["team"]["abbreviation"] else pts


def normalize(week, payload):
    games = []
    for ev in payload["events"]:
        comp = ev["competitions"][0]
        home = next(c for c in comp["competitors"] if c["homeAway"] == "home")
        away = next(c for c in comp["competitors"] if c["homeAway"] == "away")
        status = comp["status"]["type"]["name"]
        final = status == "STATUS_FINAL"
        games.append({
            "id": ev["id"],
            "week": week,
            "date": ev["date"],
            "home": home["team"]["abbreviation"],
            "away": away["team"]["abbreviation"],
            "homeScore": int(home.get("score") or 0) if final else None,
            "awayScore": int(away.get("score") or 0) if final else None,
            "final": final,
            "status": status,
            "spread": parse_spread(comp),
        })
    return games


def main():
    out = Path(__file__).resolve().parent.parent / "data" / "season.json"
    with ThreadPoolExecutor(max_workers=18) as ex:
        results = list(ex.map(fetch_week, range(1, 19)))
    games = []
    for week, payload in sorted(results):
        games.extend(normalize(week, payload))
    games.sort(key=lambda g: (g["week"], g["date"], g["id"]))
    out.write_text(json.dumps({"season": SEASON, "games": games}, indent=1))
    unplayed = sum(1 for g in games if not g["final"])
    print(f"wrote {out}: {len(games)} games, {unplayed} unplayed", file=sys.stderr)


if __name__ == "__main__":
    main()
