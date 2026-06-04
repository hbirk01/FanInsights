"""
FanIQ NFL Data Scraper — All 32 Teams, Batched
================================================
Usage:
  python3 scraper.py --seasons 2018,2019          # first batch
  python3 scraper.py --seasons 2021,2022          # second batch (2021 = COVID recovery)
  python3 scraper.py --seasons 2023,2024          # third batch
  python3 scraper.py --seasons 2023,2024 --force  # re-scrape even if cached

Rules:
  - 2020 is ALWAYS skipped (zero attendance, COVID lockout)
  - 2021 is flagged covid_recovery=True (partial early-season restrictions)
  - Already-scraped team+season combos are skipped unless --force
  - All data merges into real_data.json (never overwritten from scratch)
"""

import urllib.request
import json
import time
import sys
from datetime import datetime, timezone

# ─── CLI args ───────────────────────────────────────────────────────────────

args = sys.argv[1:]
FORCE = "--force" in args
args = [a for a in args if not a.startswith("--")]

SEASONS_ARG = None
for a in args:
    if a.startswith("--seasons=") or "," in a or a.isdigit():
        SEASONS_ARG = a.replace("--seasons=", "")

if SEASONS_ARG:
    try:
        SEASONS = [int(s.strip()) for s in SEASONS_ARG.split(",")]
    except ValueError:
        print(f"Bad --seasons value: {SEASONS_ARG}")
        sys.exit(1)
else:
    SEASONS = [2018, 2019]   # safe default

# Hard-skip 2020 always
SEASONS = [s for s in SEASONS if s != 2020]
COVID_RECOVERY_YEARS = {2021}   # flag but don't skip

print(f"Seasons to scrape: {SEASONS}")
if not SEASONS:
    print("Nothing to do.")
    sys.exit(0)

# ─── helpers ────────────────────────────────────────────────────────────────

def get(url, label="", retries=2, quiet=False):
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=12) as r:
                data = json.loads(r.read())
                if label and not quiet:
                    print(f"    ✅ {label}")
                return data
        except Exception as e:
            if attempt == retries:
                if label and not quiet:
                    print(f"    ⚠️  {label}: {e}")
                return None
            time.sleep(0.5)

# ─── all 32 NFL teams ────────────────────────────────────────────────────────

NFL_TEAMS = {
    # NFC East
    "cowboys": {"espn_id":"6",  "name":"Dallas Cowboys",          "abbr":"DAL",
                "lat":32.7473,"lon":-97.0945,"cap":80000,"tz":-6,
                "division":"NFC East","rivals":["PHI","NYG","WSH"]},
    "eagles":  {"espn_id":"21", "name":"Philadelphia Eagles",     "abbr":"PHI",
                "lat":39.9008,"lon":-75.1675,"cap":69796,"tz":-5,
                "division":"NFC East","rivals":["DAL","NYG","WSH"]},
    "giants":  {"espn_id":"19", "name":"New York Giants",         "abbr":"NYG",
                "lat":40.8135,"lon":-74.0745,"cap":82500,"tz":-5,
                "division":"NFC East","rivals":["DAL","PHI","WSH"]},
    "commanders":{"espn_id":"28","name":"Washington Commanders",  "abbr":"WSH",
                "lat":38.9077,"lon":-76.8644,"cap":67617,"tz":-5,
                "division":"NFC East","rivals":["DAL","PHI","NYG"]},
    # NFC West
    "sf49ers": {"espn_id":"25", "name":"San Francisco 49ers",     "abbr":"SF",
                "lat":37.4032,"lon":-121.9698,"cap":68500,"tz":-8,
                "division":"NFC West","rivals":["LAR","SEA","ARI"]},
    "seahawks":{"espn_id":"26", "name":"Seattle Seahawks",        "abbr":"SEA",
                "lat":47.5952,"lon":-122.3316,"cap":68740,"tz":-8,
                "division":"NFC West","rivals":["SF","LAR","ARI"]},
    "rams":    {"espn_id":"14", "name":"Los Angeles Rams",        "abbr":"LAR",
                "lat":33.9535,"lon":-118.3392,"cap":70240,"tz":-8,
                "division":"NFC West","rivals":["SF","SEA","ARI"]},
    "cardinals":{"espn_id":"22","name":"Arizona Cardinals",       "abbr":"ARI",
                "lat":33.5277,"lon":-112.2626,"cap":63400,"tz":-7,
                "division":"NFC West","rivals":["SF","SEA","LAR"]},
    # NFC North
    "bears":   {"espn_id":"3",  "name":"Chicago Bears",           "abbr":"CHI",
                "lat":41.8623,"lon":-87.6167,"cap":61500,"tz":-6,
                "division":"NFC North","rivals":["DET","GB","MIN"]},
    "lions":   {"espn_id":"8",  "name":"Detroit Lions",           "abbr":"DET",
                "lat":42.3400,"lon":-83.0456,"cap":65000,"tz":-5,
                "division":"NFC North","rivals":["CHI","GB","MIN"]},
    "packers": {"espn_id":"9",  "name":"Green Bay Packers",       "abbr":"GB",
                "lat":44.5013,"lon":-88.0622,"cap":81441,"tz":-6,
                "division":"NFC North","rivals":["CHI","DET","MIN"]},
    "vikings": {"espn_id":"16", "name":"Minnesota Vikings",       "abbr":"MIN",
                "lat":44.9736,"lon":-93.2575,"cap":66860,"tz":-6,
                "division":"NFC North","rivals":["CHI","DET","GB"]},
    # NFC South
    "saints":  {"espn_id":"18", "name":"New Orleans Saints",      "abbr":"NO",
                "lat":29.9511,"lon":-90.0812,"cap":73208,"tz":-6,
                "division":"NFC South","rivals":["ATL","TB","CAR"]},
    "falcons": {"espn_id":"1",  "name":"Atlanta Falcons",         "abbr":"ATL",
                "lat":33.7554,"lon":-84.4009,"cap":71000,"tz":-5,
                "division":"NFC South","rivals":["NO","TB","CAR"]},
    "buccaneers":{"espn_id":"27","name":"Tampa Bay Buccaneers",   "abbr":"TB",
                "lat":27.9759,"lon":-82.5033,"cap":69218,"tz":-5,
                "division":"NFC South","rivals":["NO","ATL","CAR"]},
    "panthers":{"espn_id":"29", "name":"Carolina Panthers",       "abbr":"CAR",
                "lat":35.2258,"lon":-80.8528,"cap":74455,"tz":-5,
                "division":"NFC South","rivals":["NO","ATL","TB"]},
    # AFC East
    "bills":   {"espn_id":"2",  "name":"Buffalo Bills",           "abbr":"BUF",
                "lat":42.7738,"lon":-78.7870,"cap":71608,"tz":-5,
                "division":"AFC East","rivals":["NE","MIA","NYJ"]},
    "patriots":{"espn_id":"17", "name":"New England Patriots",    "abbr":"NE",
                "lat":42.0909,"lon":-71.2643,"cap":65878,"tz":-5,
                "division":"AFC East","rivals":["BUF","MIA","NYJ"]},
    "dolphins":{"espn_id":"15", "name":"Miami Dolphins",          "abbr":"MIA",
                "lat":25.9580,"lon":-80.2389,"cap":65326,"tz":-5,
                "division":"AFC East","rivals":["BUF","NE","NYJ"]},
    "jets":    {"espn_id":"20", "name":"New York Jets",           "abbr":"NYJ",
                "lat":40.8135,"lon":-74.0745,"cap":82500,"tz":-5,
                "division":"AFC East","rivals":["BUF","NE","MIA"]},
    # AFC West
    "chiefs":  {"espn_id":"12", "name":"Kansas City Chiefs",      "abbr":"KC",
                "lat":39.0489,"lon":-94.4839,"cap":76416,"tz":-6,
                "division":"AFC West","rivals":["LV","LAC","DEN"]},
    "raiders": {"espn_id":"13", "name":"Las Vegas Raiders",       "abbr":"LV",
                "lat":36.0909,"lon":-115.1833,"cap":65000,"tz":-8,
                "division":"AFC West","rivals":["KC","LAC","DEN"]},
    "chargers":{"espn_id":"24", "name":"Los Angeles Chargers",    "abbr":"LAC",
                "lat":33.9535,"lon":-118.3392,"cap":70240,"tz":-8,
                "division":"AFC West","rivals":["KC","LV","DEN"]},
    "broncos": {"espn_id":"7",  "name":"Denver Broncos",          "abbr":"DEN",
                "lat":39.7439,"lon":-105.0201,"cap":76125,"tz":-7,
                "division":"AFC West","rivals":["KC","LV","LAC"]},
    # AFC North
    "ravens":  {"espn_id":"33", "name":"Baltimore Ravens",        "abbr":"BAL",
                "lat":39.2779,"lon":-76.6227,"cap":71008,"tz":-5,
                "division":"AFC North","rivals":["PIT","CLE","CIN"]},
    "steelers":{"espn_id":"23", "name":"Pittsburgh Steelers",     "abbr":"PIT",
                "lat":40.4468,"lon":-80.0158,"cap":68400,"tz":-5,
                "division":"AFC North","rivals":["BAL","CLE","CIN"]},
    "browns":  {"espn_id":"5",  "name":"Cleveland Browns",        "abbr":"CLE",
                "lat":41.5061,"lon":-81.6995,"cap":67431,"tz":-5,
                "division":"AFC North","rivals":["BAL","PIT","CIN"]},
    "bengals": {"espn_id":"4",  "name":"Cincinnati Bengals",      "abbr":"CIN",
                "lat":39.0954,"lon":-84.5161,"cap":65515,"tz":-5,
                "division":"AFC North","rivals":["BAL","PIT","CLE"]},
    # AFC South
    "texans":  {"espn_id":"34", "name":"Houston Texans",          "abbr":"HOU",
                "lat":29.6847,"lon":-95.4107,"cap":72220,"tz":-6,
                "division":"AFC South","rivals":["IND","JAX","TEN"]},
    "colts":   {"espn_id":"11", "name":"Indianapolis Colts",      "abbr":"IND",
                "lat":39.7601,"lon":-86.1639,"cap":67000,"tz":-5,
                "division":"AFC South","rivals":["HOU","JAX","TEN"]},
    "jaguars": {"espn_id":"30", "name":"Jacksonville Jaguars",    "abbr":"JAX",
                "lat":30.3240,"lon":-81.6374,"cap":69132,"tz":-5,
                "division":"AFC South","rivals":["HOU","IND","TEN"]},
    "titans":  {"espn_id":"10", "name":"Tennessee Titans",        "abbr":"TEN",
                "lat":36.1665,"lon":-86.7713,"cap":69143,"tz":-6,
                "division":"AFC South","rivals":["HOU","IND","JAX"]},
}

# ─── MLB teams ────────────────────────────────────────────────────────────────
# 6 teams chosen for market/variance diversity (model training quality)
# Rockies = high variance outdoor; Yankees/Dodgers = large market near-sellout;
# Cubs = iconic historic park; Cardinals = mid-market consistent; Pirates = small market
MLB_TEAMS = {
    # NL West
    "rockies":  {"espn_id":"27", "name":"Colorado Rockies",       "abbr":"COL",
                 "lat":39.7559,"lon":-104.9942,"cap":50398,"tz":-7,
                 "division":"NL West","rivals":["LAD","SF","ARI","SD"],
                 "sport":"baseball","league":"mlb","dome":False},
    "dodgers":  {"espn_id":"19", "name":"Los Angeles Dodgers",    "abbr":"LAD",
                 "lat":34.0739,"lon":-118.2400,"cap":56000,"tz":-8,
                 "division":"NL West","rivals":["COL","SF","ARI","SD"],
                 "sport":"baseball","league":"mlb","dome":False},
    # NL Central
    "cubs":     {"espn_id":"16", "name":"Chicago Cubs",           "abbr":"CHC",
                 "lat":41.9484,"lon":-87.6553,"cap":41649,"tz":-6,
                 "division":"NL Central","rivals":["MIL","STL","CIN","PIT"],
                 "sport":"baseball","league":"mlb","dome":False},
    "cardinals":{"espn_id":"24", "name":"St. Louis Cardinals",    "abbr":"STL",
                 "lat":38.6226,"lon":-90.1928,"cap":45538,"tz":-6,
                 "division":"NL Central","rivals":["CHC","MIL","CIN","PIT"],
                 "sport":"baseball","league":"mlb","dome":False},
    "pirates":  {"espn_id":"23", "name":"Pittsburgh Pirates",     "abbr":"PIT",
                 "lat":40.4469,"lon":-80.0057,"cap":38362,"tz":-5,
                 "division":"NL Central","rivals":["CHC","STL","MIL","CIN"],
                 "sport":"baseball","league":"mlb","dome":False},
    # AL East
    "yankees":  {"espn_id":"10", "name":"New York Yankees",       "abbr":"NYY",
                 "lat":40.8296,"lon":-73.9262,"cap":47309,"tz":-5,
                 "division":"AL East","rivals":["BOS","TB","BAL","TOR"],
                 "sport":"baseball","league":"mlb","dome":False},
}

# ─── holiday cache ────────────────────────────────────────────────────────────

_holiday_cache = {}

def get_holidays(year):
    if year in _holiday_cache:
        return _holiday_cache[year]
    d = get(f"https://date.nager.at/api/v3/PublicHolidays/{year}/US", quiet=True)
    holidays = [{"date": h["date"], "name": h["localName"]} for h in d] if d else []
    _holiday_cache[year] = holidays
    return holidays

def holiday_signals(date_str):
    try:
        year = int(date_str[:4])
        from datetime import datetime as dt
        game = dt.strptime(date_str, "%Y-%m-%d")
        holidays = get_holidays(year)
        min_days, nearest = 999, ""
        for h in holidays:
            diff = abs((game - dt.strptime(h["date"], "%Y-%m-%d")).days)
            if diff < min_days:
                min_days, nearest = diff, h["name"]
        return {
            "days_to_nearest_holiday": min_days,
            "nearest_holiday": nearest,
            "is_holiday_week": min_days <= 3,
            "is_thanksgiving_week": min_days <= 3 and "Thanksgiving" in nearest,
            "is_new_year_week": min_days <= 3 and ("New Year" in nearest or "Christmas" in nearest),
        }
    except Exception:
        return {"days_to_nearest_holiday": 999, "nearest_holiday": "",
                "is_holiday_week": False, "is_thanksgiving_week": False, "is_new_year_week": False}

# ─── weather ──────────────────────────────────────────────────────────────────

_weather_cache = {}

def get_weather(lat, lon, date_str):
    key = (round(lat, 2), round(lon, 2), date_str)
    if key in _weather_cache:
        return _weather_cache[key]
    url = (f"https://archive-api.open-meteo.com/v1/archive?"
           f"latitude={lat}&longitude={lon}&start_date={date_str}&end_date={date_str}"
           f"&hourly=temperature_2m,precipitation,windspeed_10m"
           f"&timezone=America/Los_Angeles")
    d = get(url, quiet=True)
    if not d:
        return {}
    h = d["hourly"]
    idx = slice(12, 18)
    temps  = h["temperature_2m"][idx]
    precip = h["precipitation"][idx]
    wind   = h["windspeed_10m"][idx]
    if not temps:
        return {}
    avg_t = sum(temps) / len(temps)
    result = {
        "avg_temp_c":    round(avg_t, 1),
        "total_precip_mm": round(sum(precip), 2),
        "avg_wind_kmh":  round(sum(wind) / len(wind), 1),
        "is_rain":  sum(precip) > 0.5,
        "is_hot":   avg_t > 35,
        "is_cold":  avg_t < 8,
    }
    _weather_cache[key] = result
    return result

def weather_severity(w):
    if not w:
        return 0.0
    t = w.get("avg_temp_c", 20)
    p = w.get("total_precip_mm", 0)
    n = w.get("avg_wind_kmh", 0)
    return round(p * 3 + max(0, t - 35) + max(0, 8 - t) + n / 10, 2)

# ─── kickoff / week helpers ───────────────────────────────────────────────────

NFL_STARTS = {2015:"2015-09-10",2016:"2016-09-08",2017:"2017-09-07",
              2018:"2018-09-06",2019:"2019-09-05",2021:"2021-09-09",
              2022:"2022-09-08",2023:"2023-09-07",2024:"2024-09-05"}

# MLB typical opening days (approximate — used to compute game_of_season)
MLB_STARTS = {2015:"2015-04-05",2016:"2016-04-03",2017:"2017-04-02",
              2018:"2018-03-29",2019:"2019-03-28",2021:"2021-04-01",
              2022:"2022-04-07",2023:"2023-03-30",2024:"2024-03-20"}

def mlb_game_of_season(date_str, season):
    """Approximate game number in the season (1–162) based on calendar position."""
    from datetime import datetime as dt
    start = dt.strptime(MLB_STARTS.get(season, f"{season}-04-01"), "%Y-%m-%d")
    game  = dt.strptime(date_str[:10], "%Y-%m-%d")
    return max(1, min(165, (game - start).days + 1))

def mlb_month(date_str):
    """Month number 4=April … 10=October for MLB season phase."""
    try:
        return int(date_str[5:7])
    except Exception:
        return 7

def mlb_weather_window(event_date_str, tz_offset):
    """MLB games typically start 7pm local; use 18:00-21:00 UTC window."""
    try:
        if "T" in event_date_str:
            from datetime import datetime as dt
            utc_h = dt.strptime(event_date_str[:16], "%Y-%m-%dT%H:%M").hour
            local_h = (utc_h + tz_offset) % 24
            return local_h, local_h >= 17  # (hour, is_night_game)
        return 19, True
    except Exception:
        return 19, True

def week_of_season(date_str, season):
    from datetime import datetime as dt
    start = dt.strptime(NFL_STARTS.get(season, f"{season}-09-05"), "%Y-%m-%d")
    game  = dt.strptime(date_str[:10], "%Y-%m-%d")
    return max(1, min(22, (game - start).days // 7 + 1))

def kickoff_local_hour(event_date_str, tz_offset):
    try:
        if "T" not in event_date_str:
            return 13
        from datetime import datetime as dt
        utc_h = dt.strptime(event_date_str[:16], "%Y-%m-%dT%H:%M").hour
        return (utc_h + tz_offset) % 24
    except Exception:
        return 13

def parse_record(s):
    try:
        parts = s.split("-")
        w, l = int(parts[0]), int(parts[1])
        return w, l, round(w / (w + l), 3) if (w + l) > 0 else 0.5
    except Exception:
        return 0, 0, 0.5

def ghost_risk(weather, is_losing, streak_len):
    base = 0.18
    if weather.get("is_rain"): base += 0.12
    if weather.get("is_hot"):  base += 0.08
    if weather.get("is_cold"): base += 0.06
    if is_losing: base += min(0.04 * streak_len, 0.20)
    return round(min(base, 0.65), 3)

def sentiment_score(headlines):
    pos = {"win","wins","victory","champion","best","great","extend","star","return","sign"}
    neg = {"loss","lose","injury","injured","suspend","fired","cut","struggle","worst","retire"}
    s = 0
    for h in headlines:
        hl = h.lower()
        for w in pos:
            if w in hl: s += 1
        for w in neg:
            if w in hl: s -= 1
    mx = len(headlines) * 2
    return round(50 + (s / mx) * 50) if mx else 50

# ─── scrape one team × one season ─────────────────────────────────────────────

def scrape_team_season(team_key, cfg, season):
    """Returns list of game dicts for one team-season."""
    eid = cfg["espn_id"]
    base = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
    is_covid_recovery = season in COVID_RECOVERY_YEARS

    sched = get(f"{base}/teams/{eid}/schedule?season={season}", quiet=True)
    if not sched or "events" not in sched:
        return []

    games = []
    streak, streak_dir = 0, None
    our_wins, our_games = 0, 0
    prev_margin = 0

    for ev in sched["events"]:
        comp = ev["competitions"][0]
        if comp["status"]["type"]["name"] != "STATUS_FINAL":
            continue

        comps   = comp["competitors"]
        home_c  = next((c for c in comps if c["homeAway"] == "home"), comps[0])
        away_c  = next((c for c in comps if c["homeAway"] == "away"), comps[1])
        is_home = home_c["team"]["id"] == eid

        hs = int(home_c.get("score", {}).get("value", 0) or 0)
        as_ = int(away_c.get("score", {}).get("value", 0) or 0)
        our  = hs if is_home else as_
        opp  = as_ if is_home else hs
        won  = our > opp

        opp_c    = away_c if is_home else home_c
        opp_abbr = opp_c["team"].get("abbreviation", "")
        opp_name = opp_c["team"].get("displayName", "")
        is_div   = opp_abbr in cfg.get("rivals", [])

        # Opponent record at game time
        opp_rec_str = "0-0"
        for rec in opp_c.get("records", []):
            if rec.get("type") == "total":
                opp_rec_str = rec.get("displayValue", "0-0")
                break
        _, _, opp_wp = parse_record(opp_rec_str)

        our_wp_then = round(our_wins / our_games, 3) if our_games else 0.5
        our_games += 1
        if won: our_wins += 1

        outcome = "W" if won else "L"
        streak = streak + 1 if outcome == streak_dir else 1
        streak_dir = outcome

        date_str   = ev["date"][:10]
        ko_hour    = kickoff_local_hour(ev["date"], cfg["tz"])
        wk         = week_of_season(date_str, season)
        from datetime import datetime as dt
        is_weekend = dt.strptime(date_str, "%Y-%m-%d").weekday() >= 5
        phase      = "early" if wk <= 6 else ("mid" if wk <= 12 else "late")
        hol        = holiday_signals(date_str)

        attendance = comp.get("attendance")

        game = {
            "season":   season,
            "date":     date_str,
            "event_id": ev["id"],
            "name":     ev.get("shortName", ev.get("name", "")),
            "is_home":  is_home,
            "opponent": opp_name,
            "opponent_abbr": opp_abbr,
            "is_divisional": is_div,
            "our_score": our,
            "opp_score": opp,
            "won":  won,
            "prev_game_margin": prev_margin,
            "attendance": attendance,
            "capacity":   cfg["cap"],
            "fill_pct":   round(attendance / cfg["cap"] * 100, 1) if attendance else None,
            "streak_going_in": streak - 1,
            "streak_dir": streak_dir,
            "home_streak": (streak - 1) * (1 if streak_dir == "W" else -1),
            "our_win_pct_at_time":  our_wp_then,
            "opponent_win_pct":     opp_wp,
            "opponent_record":      opp_rec_str,
            "matchup_strength":     round(opp_wp * our_wp_then, 3),
            "kickoff_hour_local":   ko_hour,
            "is_prime_time":  ko_hour >= 19,
            "is_morning_game": ko_hour <= 13,
            "week_of_season": wk,
            "is_weekend": is_weekend,
            "season_phase": phase,
            "covid_recovery": is_covid_recovery,
            **{f"holiday_{k}": v for k, v in hol.items()},
            "weather": {},
            "weather_severity": 0.0,
            "ghost_risk": None,
        }

        # Weather only for completed home games
        if is_home and isinstance(attendance, int) and attendance > 0:
            w = get_weather(cfg["lat"], cfg["lon"], date_str)
            game["weather"] = w
            game["weather_severity"] = weather_severity(w)
            game["ghost_risk"] = ghost_risk(
                w,
                is_losing=(streak_dir == "L"),
                streak_len=streak - 1,
            )
            time.sleep(0.12)

        prev_margin = our - opp
        games.append(game)

    home_with_att = [g for g in games if g["is_home"] and isinstance(g["attendance"], int) and g["attendance"] > 0]
    return games, len(home_with_att)

# ─── load / save real_data.json ───────────────────────────────────────────────

import pathlib as _pathlib
OUT = str(_pathlib.Path(__file__).parent / "data" / "real_data.json")

def load_existing():
    try:
        with open(OUT) as f:
            return json.load(f)
    except Exception:
        return {"scraped_at": "", "teams": {}, "nfl_news": [], "nfl_standings": [], "f1": []}

def save(data, quiet=False):
    with open(OUT, "w") as f:
        json.dump(data, f, indent=2, default=str)
    if not quiet:
        print(f"  💾 Saved {OUT} ({len(json.dumps(data)) // 1024} KB)")

# ─── helpers for news / F1 (quick, run once per session) ─────────────────────

def scrape_nfl_news():
    d = get("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=15", quiet=True)
    if not d: return []
    return [{"date": a.get("published","")[:10], "headline": a.get("headline",""),
             "teams": [t.get("displayName","") for t in a.get("categories",[]) if t.get("type")=="team"]}
            for a in d.get("articles",[])]

def scrape_f1():
    d = get("https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard", quiet=True)
    if not d: return []
    races = []
    for ev in d.get("events",[])[:10]:
        comp = ev.get("competitions",[{}])[0]
        top3 = [{"pos":c.get("order","?"),"driver":c.get("athlete",{}).get("displayName",""),
                 "team":c.get("team",{}).get("displayName","")} for c in comp.get("competitors",[])[:3]]
        races.append({"date":ev["date"][:10],"name":ev.get("name",""),
                      "short_name":ev.get("shortName",""),"top3":top3})
    return races

# ─── MLB scraper ──────────────────────────────────────────────────────────────

def scrape_mlb_season(team_key, cfg, season):
    """Scrape one MLB team-season. Returns (game_list, n_home_with_att)."""
    eid = cfg["espn_id"]
    base = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb"
    sched = get(f"{base}/teams/{eid}/schedule?season={season}", quiet=True)
    if not sched or "events" not in sched:
        return [], 0

    games = []
    n_home = 0
    our_wins, our_games = 0, 0
    streak, streak_dir = 0, None
    prev_margin = 0
    seen_dates = {}   # date → count (for doubleheader detection)
    covid_recovery = season in COVID_RECOVERY_YEARS

    for ev in sched["events"]:
        comp = ev["competitions"][0]
        if comp["status"]["type"]["name"] != "STATUS_FINAL":
            continue

        comps   = comp["competitors"]
        home_c  = next((c for c in comps if c["homeAway"] == "home"), comps[0])
        away_c  = next((c for c in comps if c["homeAway"] == "away"), comps[1])
        is_home = home_c["team"]["id"] == eid

        home_score = float(home_c.get("score", {}).get("value", 0) or 0)
        away_score = float(away_c.get("score", {}).get("value", 0) or 0)
        our_score  = home_score if is_home else away_score
        opp_score  = away_score if is_home else home_score
        won        = our_score > opp_score

        opp_c    = away_c if is_home else home_c
        opp_abbr = opp_c["team"].get("abbreviation", "")
        opp_name = opp_c["team"].get("displayName", "")
        is_div   = opp_abbr in cfg.get("rivals", [])

        # Opponent record
        opp_rec_str = next((r.get("displayValue","0-0") for r in opp_c.get("records",[]) if r.get("type")=="total"), "0-0")
        _, _, opp_win_pct = parse_record(opp_rec_str)

        # Our record before this game
        our_win_pct = round(our_wins / our_games, 3) if our_games > 0 else 0.5
        our_games += 1
        if won:
            our_wins += 1

        # Streak
        out = "W" if won else "L"
        streak = streak + 1 if out == streak_dir else 1
        streak_dir = out

        # Date / time signals
        date_str = ev["date"][:10]
        local_h, is_night = mlb_weather_window(ev["date"], cfg["tz"])
        from datetime import datetime as dt_cls
        weekday = dt_cls.strptime(date_str, "%Y-%m-%d").weekday()  # 0=Mon, 6=Sun
        is_weekend = weekday >= 4  # Fri/Sat/Sun — big for MLB

        # Doubleheader detection (two events same date same venue)
        seen_dates[date_str] = seen_dates.get(date_str, 0) + 1
        is_doubleheader = seen_dates[date_str] > 1

        month = mlb_month(date_str)
        game_num = mlb_game_of_season(date_str, season)
        # Season phase: Apr-May=early, Jun-Aug=peak, Sep-Oct=late (playoff race)
        if month <= 5:   phase = "early"
        elif month <= 8: phase = "peak"
        else:            phase = "late"
        phase_num = {"early": 0, "peak": 1, "late": 2}[phase]

        # Holiday signals (4th July, Labour Day weekend matter for baseball)
        hol = holiday_signals(date_str)

        attendance = comp.get("attendance")
        is_valid_att = isinstance(attendance, int) and attendance > 1000

        game = {
            "sport":            "baseball",
            "season":           season,
            "covid_recovery":   covid_recovery,
            "date":             date_str,
            "event_id":         ev["id"],
            "name":             ev.get("shortName", ev.get("name", "")),
            "is_home":          is_home,
            "opponent":         opp_name,
            "opponent_abbr":    opp_abbr,
            "is_divisional":    is_div,
            "our_score":        int(our_score),
            "opp_score":        int(opp_score),
            "won":              won,
            "prev_game_margin": prev_margin,
            "attendance":       attendance,
            "capacity":         cfg["cap"],
            "fill_pct":         round(attendance / cfg["cap"] * 100, 1) if is_valid_att else None,
            "streak_going_in":  streak - 1,
            "streak_dir":       streak_dir,
            "home_streak":      (streak - 1) * (1 if streak_dir == "W" else -1),
            "our_win_pct_at_time":  our_win_pct,
            "opponent_win_pct":     opp_win_pct,
            "matchup_strength":     round(opp_win_pct * our_win_pct, 3),
            "kickoff_hour_local":   local_h,
            "is_night_game":        is_night,
            "is_weekend":           is_weekend,
            "is_friday":            weekday == 4,
            "is_saturday":          weekday == 5,
            "is_sunday":            weekday == 6,
            "is_doubleheader":      is_doubleheader,
            "month":                month,
            "game_of_season":       game_num,
            "season_phase":         phase,
            "season_phase_num":     phase_num,
            **{f"holiday_{k}": v for k, v in hol.items()},
        }

        # Weather (home outdoor games only; skip domed stadiums)
        if is_home and is_valid_att and not cfg.get("dome", False):
            w = get_weather(cfg["lat"], cfg["lon"], date_str)
            game["weather"]          = w
            game["weather_severity"] = weather_severity(w)
            game["ghost_risk"]       = ghost_risk(w, streak_dir == "L", streak - 1)
            time.sleep(0.08)   # gentle rate limit for baseball's many games
        else:
            game["weather"]          = {}
            game["weather_severity"] = 0.0
            game["ghost_risk"]       = None

        if is_home and is_valid_att:
            n_home += 1
        prev_margin = int(our_score - opp_score)
        games.append(game)

    return games, n_home


# ─── main ─────────────────────────────────────────────────────────────────────

def main():
    print("╔══════════════════════════════════════════════════════╗")
    print(f"║  FanIQ NFL Scraper — {str(SEASONS):<33}║")
    print("║  All 32 teams · Merge mode · COVID-aware            ║")
    print("╚══════════════════════════════════════════════════════╝\n")

    data = load_existing()

    total_new_games = 0
    total_skipped   = 0

    for team_key, cfg in NFL_TEAMS.items():
        # Ensure team entry exists
        if team_key not in data["teams"]:
            data["teams"][team_key] = {
                "team_key": team_key,
                "scraped_at": "",
                "team_info": {
                    "name": cfg["name"], "abbreviation": cfg["abbr"],
                    "venue_capacity": cfg["cap"],
                },
                "games": [],
                "news": [], "sentiment_score": 50, "injuries": [], "star_injury_score": 0.0,
                "weather_forecast": [],
            }

        td = data["teams"][team_key]

        # Which seasons does this team already have?
        existing_seasons = set(g["season"] for g in td.get("games", []) if "season" in g)

        seasons_todo = []
        for s in SEASONS:
            if s in existing_seasons and not FORCE:
                total_skipped += 1
            else:
                seasons_todo.append(s)

        if not seasons_todo:
            print(f"  ⏭  {cfg['name']:<30} all seasons cached, skipping")
            continue

        print(f"\n  📡 {cfg['name']}")

        for season in seasons_todo:
            covid_tag = " ⚠️ COVID-recovery" if season in COVID_RECOVERY_YEARS else ""
            print(f"     Season {season}{covid_tag}...", end=" ", flush=True)

            # Remove existing games for this season if force-rescraping
            if FORCE and season in existing_seasons:
                td["games"] = [g for g in td["games"] if g.get("season") != season]

            result = scrape_team_season(team_key, cfg, season)
            if not result:
                print("no data")
                continue
            games, n_home = result
            td["games"].extend(games)
            total_new_games += n_home
            print(f"{n_home} home games")
            time.sleep(0.3)

        # Sort games by date
        td["games"].sort(key=lambda g: g.get("date", ""))
        td["scraped_at"] = datetime.now(timezone.utc).isoformat()

        # ── checkpoint save after every NFL team ──────────────────────────────
        data["scraped_at"] = datetime.now(timezone.utc).isoformat()
        save(data, quiet=True)

    # ── MLB ───────────────────────────────────────────────────────────────────
    print(f"\n⚾ MLB teams ({len(MLB_TEAMS)} teams)...")

    for team_key, cfg in MLB_TEAMS.items():
        if team_key not in data["teams"]:
            data["teams"][team_key] = {
                "team_key": team_key, "sport": "baseball",
                "scraped_at": "", "team_info": {
                    "name": cfg["name"], "abbreviation": cfg["abbr"],
                    "venue_capacity": cfg["cap"],
                },
                "games": [], "news": [], "sentiment_score": 50,
                "injuries": [], "star_injury_score": 0.0, "weather_forecast": [],
            }

        td = data["teams"][team_key]
        existing_seasons = set(g["season"] for g in td.get("games", []) if "season" in g)
        seasons_todo = [s for s in SEASONS if s not in existing_seasons or FORCE]

        if not seasons_todo:
            print(f"  ⏭  {cfg['name']:<30} all seasons cached")
            continue

        print(f"\n  📡 {cfg['name']}")
        for season in seasons_todo:
            covid_tag = " ⚠️ COVID-recovery" if season in COVID_RECOVERY_YEARS else ""
            print(f"     Season {season}{covid_tag}...", end=" ", flush=True)
            if FORCE and season in existing_seasons:
                td["games"] = [g for g in td["games"] if g.get("season") != season]
            result = scrape_mlb_season(team_key, cfg, season)
            if not result:
                print("no data")
                continue
            games, n_home = result
            td["games"].extend(games)
            total_new_games += n_home
            print(f"{n_home} home games w/ attendance")
            time.sleep(0.25)

        td["games"].sort(key=lambda g: g.get("date", ""))
        td["scraped_at"] = datetime.now(timezone.utc).isoformat()

        # ── checkpoint save after every MLB team ──────────────────────────────
        data["scraped_at"] = datetime.now(timezone.utc).isoformat()
        save(data)

    # Update league-level data once
    print("\n  📰 Refreshing NFL news & F1...")
    data["nfl_news"] = scrape_nfl_news()
    data["f1"]       = scrape_f1()
    data["scraped_at"] = datetime.now(timezone.utc).isoformat()

    save(data)

    # Summary
    print(f"\n{'═'*55}")
    print(f"BATCH COMPLETE  seasons={SEASONS}")
    all_home = sum(
        len([g for g in td.get("games",[]) if g.get("is_home") and isinstance(g.get("attendance"),int) and g["attendance"]>0])
        for td in data["teams"].values()
    )
    print(f"  New home games scraped : {total_new_games}")
    print(f"  Team-seasons skipped   : {total_skipped} (cached)")
    print(f"  Total home games in DB : {all_home}")
    print(f"  Teams in DB            : {len(data['teams'])}")
    seasons_in_db = sorted(set(g["season"] for td in data["teams"].values() for g in td.get("games",[])))
    print(f"  Seasons in DB          : {seasons_in_db}")
    print(f"{'═'*55}")
    print(f"\n  Next: python3 model.py")

if __name__ == "__main__":
    main()
