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


@app.get("/api/jobs/{job_id}", summary="Poll job status")
def get_job(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, "status": _jobs[job_id]}


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
