# FanInsights

Fan loyalty, ghost ticket prediction, and attendance analytics platform — built as a PwC sports analytics proof-of-concept.

## Stack

| Layer | Tech |
|-------|------|
| Backend API | FastAPI + Uvicorn |
| ML | scikit-learn (Ridge, ElasticNet, Random Forest) |
| Data | ESPN undocumented API, Open-Meteo weather, Nager holidays |
| Frontend | Vanilla JS + Chart.js (single-file dashboard) |

## Quick start

```bash
# 1. install deps
cd backend
pip install -r requirements.txt

# 2. scrape data (first time — batched to avoid rate limits)
python scraper.py --seasons 2022,2023
python scraper.py --seasons 2024

# 3. train model
python model.py

# 4. start API + serve frontend
uvicorn main:app --reload --port 8000
```

Then open **http://localhost:8000** — the dashboard loads automatically.

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data` | Full scraped game dataset |
| GET | `/api/data/{team}` | Single team (e.g. `sf49ers`) |
| GET | `/api/teams` | List teams with season counts |
| GET | `/api/model` | Model results (metrics, predictions, feature importance) |
| GET | `/api/model/predict` | Interactive prediction (query params: week, opponent_strength, …) |
| POST | `/api/scrape?seasons=2024` | Trigger scraper in background |
| POST | `/api/train` | Retrain model in background |
| GET | `/api/jobs/{id}` | Poll background job status |

Interactive docs: **http://localhost:8000/docs**

## Project structure

```
FanInsights/
├── backend/
│   ├── main.py           # FastAPI app
│   ├── scraper.py        # ESPN + weather data pipeline
│   ├── model.py          # Ridge / ElasticNet / RF training
│   ├── data/             # Generated data (gitignored)
│   │   ├── real_data.json
│   │   └── model_results.json
│   └── requirements.txt
├── frontend/
│   ├── index.html        # Dashboard UI
│   └── faniq.js          # Chart rendering + API calls
└── README.md
```

## Dashboard tabs

1. **Overview** — KPI cards, tier distribution, revenue by segment, loyalty trend
2. **Live Data** — Real game-by-game attendance, weather, injury report, news feed
3. **Fan Profiles** — 360° fan detail: loyalty score, LTV, churn risk, AI recommendations
4. **Ghost Tickets** — Stadium heat map, no-show risk by section, recovery playbook
5. **Game Day AI** — Fan journey timeline, live offer performance, personalisation stream
6. **Lifetime Value** — LTV waterfall, segment migration, churn ROI, referral network
7. **Predictions** — Model performance vs naive baseline, feature importance, forecast
8. **Model** — R² cards, actual vs predicted scatter, coefficients, interactive predictor

## Extending to other sports

See the replication guide in the memory docs. Key changes per sport:
- **NBA**: replace `week_of_season` with `days_since_last_home`; indoor → drop weather
- **MLB**: 81 home games enables lag features; weather matters more
- **F1**: circuit-level (not team-level); replace stadium SVG
