"""
FanInsights API — FastAPI backend
Serves fan analytics data and triggers scraper/model jobs.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# ── paths ─────────────────────────────────────────────────────────────────────
BASE_DIR     = Path(__file__).parent
DATA_DIR     = BASE_DIR / "data"
FRONTEND_DIR = BASE_DIR.parent / "frontend"

REAL_DATA_PATH    = DATA_DIR / "real_data.json"
MODEL_RESULT_PATH = DATA_DIR / "model_results.json"

# ── app ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FanInsights API",
    description="Fan loyalty, ghost ticket, and attendance prediction platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── helpers ───────────────────────────────────────────────────────────────────

def _load_json(path: Path) -> Any:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{path.name} not found — run scraper/model first")
    with open(path) as f:
        return json.load(f)

# ── job state (in-memory; fine for single-process dev/demo) ──────────────────
_jobs: Dict[str, str] = {}  # job_id -> "running" | "done" | "error: ..."


def _run_script(script: str, args: list[str], job_id: str) -> None:
    _jobs[job_id] = "running"
    try:
        result = subprocess.run(
            [sys.executable, str(BASE_DIR / script), *args],
            capture_output=True, text=True, timeout=600,
        )
        if result.returncode == 0:
            _jobs[job_id] = "done"
        else:
            _jobs[job_id] = f"error: {result.stderr[-500:]}"
    except Exception as e:
        _jobs[job_id] = f"error: {e}"


# ── data endpoints ────────────────────────────────────────────────────────────

@app.get("/api/data", summary="All scraped game data")
def get_all_data():
    """Return the full real_data.json payload."""
    return _load_json(REAL_DATA_PATH)


@app.get("/api/data/{team}", summary="Single team data")
def get_team_data(team: str):
    """Return data for a specific team key (e.g. sf49ers, chiefs)."""
    data = _load_json(REAL_DATA_PATH)
    teams = data.get("teams", {})
    if team not in teams:
        available = sorted(teams.keys())
        raise HTTPException(
            status_code=404,
            detail={"message": f"Team '{team}' not found", "available_teams": available},
        )
    return {
        "team": team,
        "games": teams[team],
        "scraped_at": data.get("scraped_at"),
    }


@app.get("/api/teams", summary="List available teams")
def list_teams():
    data = _load_json(REAL_DATA_PATH)
    teams = data.get("teams", {})
    summary = {}
    for key, games in teams.items():
        if games:
            summary[key] = {
                "game_count": len(games),
                "seasons": sorted({g.get("season") for g in games if g.get("season")}),
            }
    return {"teams": summary, "scraped_at": data.get("scraped_at")}


@app.get("/api/model", summary="Model results")
def get_model_results():
    """Return model_results.json — metrics, predictions, feature importance."""
    return _load_json(MODEL_RESULT_PATH)


@app.get("/api/model/predict", summary="Interactive attendance prediction")
def predict(
    week: int = Query(10, ge=1, le=22),
    opponent_strength: float = Query(0.5, ge=0.0, le=1.0),
    home_streak: int = Query(0, ge=-10, le=10),
    weather_severity: float = Query(0.0, ge=0.0, le=10.0),
    is_prime_time: int = Query(0, ge=0, le=1),
    is_divisional: int = Query(0, ge=0, le=1),
    team: str = Query("sf49ers"),
):
    """
    Run the Ridge model forward prediction for given game conditions.
    Returns predicted attendance and ghost risk.
    """
    model = _load_json(MODEL_RESULT_PATH)
    nfl = model.get("nfl") or model  # handle flat or nested structure

    # Retrieve per-team mean attendance for de-normalisation
    team_stats = (nfl.get("team_mean_attendance") or {}).get(team)
    if not team_stats:
        # Fallback: use first available team stats
        all_stats = nfl.get("team_mean_attendance", {})
        team_stats = next(iter(all_stats.values()), {"mean": 70000, "std": 2000})

    mean_att = team_stats.get("mean", 70000)
    std_att  = team_stats.get("std", 2000) or 2000

    # Ridge coefficients
    coefs = nfl.get("ridge_coefficients", {})
    features = {
        "week_of_season": week,
        "opponent_win_pct": opponent_strength,
        "home_streak": home_streak,
        "weather_severity": weather_severity,
        "is_prime_time": is_prime_time,
        "is_divisional": is_divisional,
    }

    score_norm = sum(coefs.get(k, 0) * v for k, v in features.items())
    # Inverse sqrt-transform
    predicted_raw = (score_norm * std_att + mean_att)
    predicted_attendance = max(0, int(round(predicted_raw)))

    # Simple ghost risk heuristic based on fill %
    fill_pct = predicted_attendance / max(mean_att, 1)
    ghost_risk = max(0.0, round((1 - fill_pct) * 100, 1))

    return {
        "team": team,
        "inputs": features,
        "predicted_attendance": predicted_attendance,
        "ghost_risk_pct": ghost_risk,
        "model": "ridge",
    }


# ── job endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/scrape", summary="Trigger scraper")
def trigger_scrape(
    background_tasks: BackgroundTasks,
    seasons: str = Query("2024", description="Comma-separated seasons e.g. 2023,2024"),
    force: bool = Query(False),
):
    """Start the scraper in the background. Poll /api/jobs/{id} for status."""
    import time
    job_id = f"scrape_{int(time.time())}"
    args = ["--seasons", seasons]
    if force:
        args.append("--force")
    background_tasks.add_task(_run_script, "scraper.py", args, job_id)
    return {"job_id": job_id, "status": "queued", "seasons": seasons}


@app.post("/api/train", summary="Trigger model training")
def trigger_train(background_tasks: BackgroundTasks):
    """Retrain the model on current real_data.json. Poll /api/jobs/{id} for status."""
    import time
    job_id = f"train_{int(time.time())}"
    background_tasks.add_task(_run_script, "model.py", [], job_id)
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/pricing/{team}", summary="Dynamic pricing recommendation")
def get_pricing(team: str):
    """
    Returns per-section dynamic pricing recommendations based on ghost risk
    from the most recent home games. Used by the Dynamic Pricing Engine tab.
    """
    data = _load_json(REAL_DATA_PATH)
    teams = data.get("teams", {})
    if team not in teams:
        raise HTTPException(status_code=404, detail=f"Team '{team}' not found")

    team_data = teams[team]
    games = team_data.get("games", [])
    capacity = (team_data.get("team_info") or {}).get("venue_capacity", 68500)

    # Use last 3 home games to derive ghost risk by section proxy
    home_games = [g for g in games if g.get("is_home")]
    recent = home_games[-3:] if len(home_games) >= 3 else home_games

    avg_ghost = sum(g.get("ghost_risk", 0.2) for g in recent) / max(len(recent), 1)
    seats_remaining = int(avg_ghost * capacity)

    # Generate per-section pricing (10 sections, varied risk around avg)
    import random, hashlib
    rng = random.Random(hashlib.md5(team.encode()).hexdigest())
    sections = []
    base_price = 120 if team_data.get("sport") == "football" else 55
    section_labels = (
        [f"Sec {100 + i}" for i in range(10)] if team_data.get("sport") == "football"
        else [f"Sec {200 + i*10}" for i in range(10)]
    )
    for i, label in enumerate(section_labels):
        risk = max(0.05, min(0.75, avg_ghost + rng.uniform(-0.15, 0.20)))
        if risk > 0.35:
            discount_pct = 25
        elif risk > 0.25:
            discount_pct = 15
        elif risk > 0.15:
            discount_pct = 8
        else:
            discount_pct = 0
        suggested_price = round(base_price * (1 - discount_pct / 100))
        sections.append({
            "section": label,
            "seats_remaining": int(risk * (capacity // 10)),
            "ghost_risk": round(risk, 3),
            "discount_pct": discount_pct,
            "suggested_price": suggested_price,
            "demand_score": round(1 - risk, 2),
        })

    sections.sort(key=lambda x: x["ghost_risk"], reverse=True)

    recommended_discount = 25 if avg_ghost > 0.35 else (15 if avg_ghost > 0.25 else 8)
    est_revenue_recovered = seats_remaining * base_price * recommended_discount // 100

    return {
        "team": team,
        "capacity": capacity,
        "seats_remaining": seats_remaining,
        "avg_ghost_risk": round(avg_ghost, 3),
        "recommended_discount_pct": recommended_discount,
        "est_revenue_recovered": est_revenue_recovered,
        "base_ticket_price": base_price,
        "sections": sections,
    }


@app.get("/api/jobs/{job_id}", summary="Poll job status")
def get_job(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, "status": _jobs[job_id]}


# ── DEMO / POC endpoints ──────────────────────────────────────────────────────

@app.get("/api/demo/config", summary="Demo configuration status")
def demo_config():
    """Return whether email is configured + what real data stats are available."""
    from notifier import is_configured, redact_email, RECIPIENT_EMAIL, DEMO_FAN, DEMO_TEAM
    from demo_runner import get_real_game_stats, get_live_weather

    configured = is_configured()
    stats = {}
    wx    = {}
    try:
        stats = get_real_game_stats(DEMO_TEAM)
    except Exception:
        pass
    try:
        wx = get_live_weather()
    except Exception:
        pass

    return {
        "email_configured": configured,
        "recipient": redact_email(RECIPIENT_EMAIL) if configured else "not set — add to backend/.env",
        "demo_fan":  DEMO_FAN,
        "demo_team": DEMO_TEAM,
        "real_data": {
            "ghost_risk_pct":    stats.get("ghost_risk_pct"),
            "seats_remaining":   stats.get("seats_remaining"),
            "opponent":          stats.get("opponent"),
            "last_result":       "Win" if stats.get("last_won") else "Loss",
        },
        "live_weather": {
            "temp_f":       wx.get("temp_f"),
            "precip_label": wx.get("precip_label"),
            "wind_mph":     wx.get("wind_mph"),
            "source":       "Open-Meteo live forecast API",
        },
    }


@app.post("/api/demo/run", summary="Step 1 — Geo trigger offer email")
def demo_run():
    """
    Fires Step 1 of the fan journey: geo-proximity detected → personalised
    ticket offer email sent to RECIPIENT_EMAIL.
    Uses real 49ers ghost risk + live Open-Meteo weather data.
    """
    from demo_runner import step1_geo_trigger
    return step1_geo_trigger()


@app.post("/api/demo/checkin", summary="Step 2 — Stadium entry email")
def demo_checkin():
    """
    Fires Step 2: fan scans into stadium → food-delivery confirmation,
    seat upgrade offer, loyalty progress update.
    """
    from demo_runner import step2_checkin
    return step2_checkin()


@app.post("/api/demo/social", summary="Step 3 — Post-game social push email")
def demo_social():
    """
    Fires Step 3: post-game social incentive + full LTV recap.
    Uses real last-game result (win/loss, score) from scraped data.
    """
    from demo_runner import step3_social
    return step3_social()


# ── serve frontend ────────────────────────────────────────────────────────────

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/{path:path}", include_in_schema=False)
    def serve_frontend(path: str):
        file_path = FRONTEND_DIR / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))
