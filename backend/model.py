"""
FanIQ Multi-Sport Attendance Prediction Model — Scientific Edition
==================================================================
Runs separate models per sport (NFL, MLB). Same methodology for both:
  - 60/20/20 chronological split per team-season (never shuffle)
  - Validation: hyperparameter tuning only
  - Test: locked, evaluated once
  - Multicollinearity pruning at r > 0.75
  - Ridge (interpretable) + ElasticNet (regularised) + Random Forest
  - sqrt-transform + team-season normalisation on target
  - Lag features: excluded for NFL (autocorr≈1), INCLUDED for MLB (81 games/season)

References:
  Masini et al. (2024) Studia Sportiva doi:10.5817/SS2024-2-3
  MiQ Tech & Analytics (2022) Attendance Prediction for Professional Sports
  Forecastegy (2024) Time Series Cross-Validation in Python
"""

import json, math, warnings
import numpy as np
from datetime import datetime, timezone
warnings.filterwarnings("ignore")

TRAIN_PCT = 0.60
VAL_PCT   = 0.20
TEST_PCT  = 0.20

SKIP_SEASONS     = {2020}
COVID_RECOVERY   = {2021}

# ─── sport configs ────────────────────────────────────────────────────────────

SPORT_CONFIG = {
    "football": {
        "teams": {
            "cowboys","eagles","giants","commanders",
            "sf49ers","seahawks","rams","cardinals",
            "bears","lions","packers","vikings",
            "saints","falcons","buccaneers","panthers",
            "bills","patriots","dolphins","jets",
            "chiefs","raiders","chargers","broncos",
            "ravens","steelers","browns","bengals",
            "texans","colts","jaguars","titans",
        },
        "features": {
            "week_of_season":       "Week of Season",
            "is_weekend":           "Weekend Game",
            "is_prime_time":        "Prime-Time Kickoff",
            "weather_severity":     "Weather Severity",
            "avg_wind_kmh":         "Wind Speed (km/h)",
            "home_streak":          "Team Win Streak",
            "prev_game_margin":     "Prev Score Margin",
            "is_divisional":        "Divisional Rival",
            "opponent_win_pct":     "Opponent Win %",
            "matchup_strength":     "Matchup Strength Index",
            "is_holiday_week":      "Holiday Week",
            "is_thanksgiving_week": "Thanksgiving Week",
            "season_phase_num":     "Season Phase (0=early→2=late)",
            "covid_recovery":       "COVID-Recovery Season (2021)",
        },
        # Lag features excluded for NFL: autocorr≈1 at near-capacity causes Train R²→1, test collapse
        "lag_features": [],
        "attendance_floor": 5000,
    },
    "baseball": {
        "teams": {"rockies","yankees","cubs","cardinals","pirates","dodgers"},
        "features": {
            "game_of_season":       "Game # in Season",
            "month":                "Month (4=Apr … 10=Oct)",
            "season_phase_num":     "Season Phase (0=early,1=peak,2=late)",
            "is_weekend":           "Weekend (Fri/Sat/Sun)",
            "is_friday":            "Friday Game",
            "is_saturday":          "Saturday Game",
            "is_night_game":        "Night Game",
            "is_doubleheader":      "Doubleheader (Game 2)",
            "weather_severity":     "Weather Severity",
            "avg_temp_c":           "Temperature (°C)",
            "total_precip_mm":      "Rainfall (mm)",
            "home_streak":          "Team Win Streak",
            "prev_game_margin":     "Prev Game Run Differential",
            "our_win_pct_at_time":  "Our Win % at Game Time",
            "opponent_win_pct":     "Opponent Win %",
            "matchup_strength":     "Matchup Strength Index",
            "is_divisional":        "Divisional Rival",
            "holiday_is_holiday_week": "Holiday Week",
            "covid_recovery":       "COVID-Recovery Season (2021)",
        },
        # Lag features valid for MLB: 81 games/season → sufficient variance
        "lag_features": ["att_lag1_norm", "att_rolling5_norm"],
        "attendance_floor": 2000,
    },
}

# ─── load data ────────────────────────────────────────────────────────────────

import pathlib as _pathlib
_DATA_DIR = _pathlib.Path(__file__).parent / "data"

with open(_DATA_DIR / "real_data.json") as f:
    RAW = json.load(f)

# ─── helpers ──────────────────────────────────────────────────────────────────

def r2_score(y_true, y_pred):
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - y_true.mean()) ** 2)
    return round(float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0, 4)

def mae_score(y_true, y_pred):
    return round(float(np.mean(np.abs(y_true - y_pred))), 1)

def rmse_score(y_true, y_pred):
    return round(float(np.sqrt(np.mean((y_true - y_pred) ** 2))), 1)

def mape_score(y_true_raw, y_pred_raw):
    mask = y_true_raw > 0
    return round(float(np.mean(np.abs(y_true_raw[mask] - y_pred_raw[mask]) / y_true_raw[mask]) * 100), 2)

def ridge_fit(X, y, alpha=1.0):
    n = X.shape[1]
    Xa = np.vstack([X, np.sqrt(alpha) * np.eye(n)])
    ya = np.concatenate([y, np.zeros(n)])
    Xai = np.column_stack([Xa, np.concatenate([np.ones(len(X)), np.zeros(n)])])
    c, _, _, _ = np.linalg.lstsq(Xai, ya, rcond=None)
    return c

# ─── main model runner ────────────────────────────────────────────────────────

def run_model(sport):
    cfg        = SPORT_CONFIG[sport]
    team_set   = cfg["teams"]
    feat_map   = cfg["features"]
    lag_keys   = cfg["lag_features"]
    att_floor  = cfg["attendance_floor"]
    FKEYS      = list(feat_map.keys())  # base feature keys (before lag)

    print(f"\n{'═'*60}")
    print(f"  {sport.upper()} ATTENDANCE MODEL")
    print(f"{'═'*60}")

    # ── build raw records per team-season ──────────────────────────────────────
    raw_records = {}
    for team_key, td in RAW["teams"].items():
        team_sport = td.get("sport", "football")
        if team_sport != sport and sport == "baseball":
            continue
        if sport == "football" and team_key not in team_set:
            continue
        if sport == "baseball" and team_key not in team_set:
            continue

        by_season = {}
        for g in td.get("games", []):
            if not g.get("is_home"):
                continue
            att = g.get("attendance")
            if not isinstance(att, int) or att < att_floor:
                continue
            s = g.get("season", 2024)
            if s in SKIP_SEASONS:
                continue
            by_season.setdefault(s, []).append(g)

        for season, sg in by_season.items():
            sg.sort(key=lambda x: x["date"])
            raw_records[(team_key, season)] = sg

    if not raw_records:
        print(f"  ⚠️  No {sport} data found in real_data.json — run scraper first")
        return None

    team_seasons = sorted(raw_records.keys())
    total_games  = sum(len(v) for v in raw_records.values())
    print(f"  Loaded {total_games} home game records across {len(team_seasons)} team-seasons")
    for ts in team_seasons[:6]:
        print(f"    {ts[0]:<14} {ts[1]}  → {len(raw_records[ts])} games")
    if len(team_seasons) > 6:
        print(f"    ... and {len(team_seasons)-6} more team-seasons")

    # ── per-team-season normalisation + feature matrix ─────────────────────────
    all_records = []

    for (team_key, season), games in raw_records.items():
        atts    = [float(g["attendance"]) for g in games]
        ts_mean = float(np.mean(atts))
        ts_std  = float(np.std(atts)) if np.std(atts) > 0 else 1.0

        att_history_norm = []   # for lag feature construction

        for idx, g in enumerate(games):
            w = g.get("weather") or {}
            covid = float(g.get("covid_recovery", season in COVID_RECOVERY))

            # ── base features (sport-specific) ──────────────────────────────
            feat_vals = {}
            for fk in FKEYS:
                raw_val = g.get(fk, 0)
                # handle nested holiday keys
                if fk.startswith("holiday_"):
                    raw_val = g.get(fk, False)
                # weather sub-keys
                if fk in ("avg_temp_c", "total_precip_mm", "avg_wind_kmh"):
                    raw_val = w.get(fk, 0)
                feat_vals[fk] = float(raw_val) if raw_val is not None else 0.0

            # covid_recovery override if key not in game record
            feat_vals["covid_recovery"] = covid

            # ── lag features (only for sports where they're valid) ──────────
            att_raw  = float(g["attendance"])
            att_norm = (att_raw - ts_mean) / ts_std

            if "att_lag1_norm" in lag_keys:
                feat_vals["att_lag1_norm"]   = att_history_norm[-1]  if att_history_norm        else 0.0
                feat_vals["att_rolling5_norm"]= float(np.mean(att_history_norm[-5:])) if att_history_norm else 0.0

            # ── row ─────────────────────────────────────────────────────────
            row = {
                "team": team_key, "season": season,
                "date": g["date"], "opponent": g.get("opponent",""),
                "won": g.get("won", False),
                "attendance_raw": att_raw,
                "attendance_norm": att_norm,
                "ts_mean": ts_mean, "ts_std": ts_std,
                "capacity": float(g.get("capacity", 50000)),
            }
            row.update(feat_vals)
            all_records.append(row)
            att_history_norm.append(att_norm)   # append AFTER row built (no leakage)

    # All feature keys including lags
    ALL_FKEYS = FKEYS + [k for k in lag_keys if k not in FKEYS]

    X_raw = np.array([[r[k] for k in ALL_FKEYS] for r in all_records], dtype=float)
    y_raw = np.array([r["attendance_raw"] for r in all_records], dtype=float)
    teams = [r["team"] for r in all_records]

    # ── multicollinearity pruning (r > 0.75) ──────────────────────────────────
    print(f"\n  🔍 Multicollinearity check (|r| > 0.75)...")
    to_drop = set()
    corr_mat = np.corrcoef(X_raw.T)
    for i in range(len(ALL_FKEYS)):
        for j in range(i+1, len(ALL_FKEYS)):
            if abs(corr_mat[i,j]) > 0.75 and ALL_FKEYS[j] not in to_drop:
                print(f"     Drop '{ALL_FKEYS[j]}' (|r|={abs(corr_mat[i,j]):.2f} with '{ALL_FKEYS[i]}')")
                to_drop.add(ALL_FKEYS[j])
    ACTIVE_KEYS = [k for k in ALL_FKEYS if k not in to_drop]
    print(f"     Retained {len(ACTIVE_KEYS)} features: {ACTIVE_KEYS}")

    X_full = np.array([[r[k] for k in ACTIVE_KEYS] for r in all_records], dtype=float)

    # ── 60/20/20 chronological split per team-season ──────────────────────────
    print(f"\n  📐 Split: {int(TRAIN_PCT*100)}/{int(VAL_PCT*100)}/{int(TEST_PCT*100)} per team-season (chronological)")
    train_idx, val_idx, test_idx = [], [], []
    cursor = 0
    for (tk, ss), games in raw_records.items():
        n = len(games)
        n_tr = max(1, math.floor(n * TRAIN_PCT))
        n_va = max(1, math.floor(n * VAL_PCT))
        n_te = n - n_tr - n_va
        if n_te < 1:
            n_va = max(1, n - n_tr - 1)
            n_te = n - n_tr - n_va
        train_idx.extend(range(cursor, cursor + n_tr))
        val_idx.extend(range(cursor + n_tr, cursor + n_tr + n_va))
        test_idx.extend(range(cursor + n_tr + n_va, cursor + n))
        cursor += n
    print(f"     {len(train_idx)} train / {len(val_idx)} val / {len(test_idx)} test")

    # ── sqrt-normalised target ─────────────────────────────────────────────────
    y_sqrt = np.sqrt(y_raw)
    sqrt_stats = {}
    cursor2 = 0
    for (tk, ss), games in raw_records.items():
        n = len(games)
        blk = y_sqrt[cursor2:cursor2+n]
        sqrt_stats[(tk,ss)] = (float(blk.mean()), float(blk.std()) if blk.std()>0 else 1.0)
        cursor2 += n

    y_sqrt_norm = np.array([
        (y_sqrt[i] - sqrt_stats[(all_records[i]["team"], all_records[i]["season"])][0]) /
         sqrt_stats[(all_records[i]["team"], all_records[i]["season"])][1]
        for i in range(len(all_records))
    ], dtype=float)

    def inv_transform(y_scaled, indices):
        out = []
        for pos, i in enumerate(indices):
            r = all_records[i]
            mu, sig = sqrt_stats[(r["team"], r["season"])]
            v = float(y_scaled[pos]) * sig + mu
            out.append(max(0.0, v**2))
        return np.array(out)

    # ── feature standardisation (train stats only — no leakage) ───────────────
    X_tr = X_full[train_idx]
    feat_mean = X_tr.mean(axis=0)
    feat_std  = X_tr.std(axis=0)
    feat_std[feat_std < 1e-9] = 1.0
    X_std = (X_full - feat_mean) / feat_std

    X_tr_s = X_std[train_idx];  y_tr = y_sqrt_norm[train_idx]
    X_va_s = X_std[val_idx];    y_va = y_sqrt_norm[val_idx]
    X_te_s = X_std[test_idx];   y_te = y_sqrt_norm[test_idx]

    def eval_split(name, y_true_scaled, y_pred_scaled, indices, label):
        pred_raw = inv_transform(y_pred_scaled, indices)
        true_raw = y_raw[indices]
        r2  = r2_score(y_true_scaled, y_pred_scaled)
        mae = round(float(np.mean(np.abs(true_raw - pred_raw))), 0)
        mape= mape_score(true_raw, pred_raw)
        rmse= rmse_score(true_raw, pred_raw)
        print(f"     {name:<18} {label:<6} R²={r2:+.3f}  MAE={mae:>6,.0f}  MAPE={mape:.1f}%")
        return {"r2": r2, "mae": mae, "rmse": rmse, "mape": mape}

    # ── naive baseline ─────────────────────────────────────────────────────────
    print(f"\n  📊 Naive baseline (team-season mean):")
    base_te_raw = np.array([all_records[i]["ts_mean"] for i in test_idx])
    base_te_m = {
        "r2":   r2_score(y_te, np.zeros(len(y_te))),
        "mae":  round(float(np.mean(np.abs(y_raw[test_idx] - base_te_raw))), 0),
        "mape": mape_score(y_raw[test_idx], base_te_raw),
    }
    print(f"     Test: MAE={base_te_m['mae']:,.0f}  MAPE={base_te_m['mape']:.1f}%")

    # ── Ridge ──────────────────────────────────────────────────────────────────
    print(f"\n  📐 Ridge Regression:")
    best_a_r, best_r2_r = 1.0, -999
    for a in [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0]:
        c = ridge_fit(X_tr_s, y_tr, a)
        Xv = np.column_stack([X_va_s, np.ones(len(X_va_s))])
        vr2 = r2_score(y_va, Xv @ c)
        if vr2 > best_r2_r:
            best_r2_r, best_a_r = vr2, a
    ridge_c = ridge_fit(X_tr_s, y_tr, best_a_r)
    print(f"     Best alpha={best_a_r} (val R²={best_r2_r:.3f})")
    Xaug = lambda Xs: np.column_stack([Xs, np.ones(len(Xs))])
    ridge_tr = eval_split("Ridge", y_tr, Xaug(X_tr_s) @ ridge_c, train_idx, "train")
    ridge_va = eval_split("Ridge", y_va, Xaug(X_va_s) @ ridge_c, val_idx,   "val")
    ridge_te = eval_split("Ridge", y_te, Xaug(X_te_s) @ ridge_c, test_idx,  "test")

    coeffs_raw = {ACTIVE_KEYS[i]: round(float(ridge_c[i]) / feat_std[i], 1)
                  for i in range(len(ACTIVE_KEYS))}

    # ── ElasticNet ─────────────────────────────────────────────────────────────
    print(f"\n  🔗 ElasticNet (grid search on val):")
    from sklearn.linear_model import ElasticNet
    from sklearn.metrics import r2_score as sk_r2
    best_en, best_en_val, best_a_en, best_l1 = None, -999, 0.1, 0.5
    for a in [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]:
        for l1 in [0.1, 0.3, 0.5, 0.7, 0.9]:
            en = ElasticNet(alpha=a, l1_ratio=l1, max_iter=5000, random_state=42)
            en.fit(X_tr_s, y_tr)
            vr2 = float(sk_r2(y_va, en.predict(X_va_s)))
            if vr2 > best_en_val:
                best_en_val, best_en = vr2, en
                best_a_en, best_l1 = a, l1
    print(f"     Best alpha={best_a_en}, l1_ratio={best_l1} (val R²={best_en_val:.3f})")
    en_tr = eval_split("ElasticNet", y_tr, best_en.predict(X_tr_s), train_idx, "train")
    en_va = eval_split("ElasticNet", y_va, best_en.predict(X_va_s), val_idx,   "val")
    en_te = eval_split("ElasticNet", y_te, best_en.predict(X_te_s), test_idx,  "test")

    # ── Random Forest ──────────────────────────────────────────────────────────
    print(f"\n  🌲 Random Forest (val-tuned):")
    from sklearn.ensemble import RandomForestRegressor
    best_rf, best_rf_val = None, -999
    for ne in [100, 200]:
        for md in [2, 3, 4]:
            for ml in [2, 3, 5]:
                rf = RandomForestRegressor(n_estimators=ne, max_depth=md,
                                           min_samples_leaf=ml, random_state=42)
                rf.fit(X_tr_s, y_tr)
                vr2 = float(sk_r2(y_va, rf.predict(X_va_s)))
                if vr2 > best_rf_val:
                    best_rf_val, best_rf = vr2, rf
    print(f"     Best (val R²={best_rf_val:.3f})")
    rf_tr = eval_split("RandomForest", y_tr, best_rf.predict(X_tr_s), train_idx, "train")
    rf_va = eval_split("RandomForest", y_va, best_rf.predict(X_va_s), val_idx,   "val")
    rf_te = eval_split("RandomForest", y_te, best_rf.predict(X_te_s), test_idx,  "test")
    rf_importance = {ACTIVE_KEYS[i]: round(float(best_rf.feature_importances_[i]),4)
                     for i in range(len(ACTIVE_KEYS))}

    # ── model comparison ───────────────────────────────────────────────────────
    print(f"\n  {'═'*56}")
    print(f"  MODEL COMPARISON  (test set — locked)")
    print(f"  {'─'*56}")
    print(f"  {'Model':<18} {'Tr R²':>7} {'Va R²':>7} {'Te R²':>7} {'Te MAE':>8} {'MAPE':>7}")
    print(f"  {'Naive baseline':<18} {'—':>7} {'—':>7} {base_te_m['r2']:>+7.3f} {base_te_m['mae']:>8,.0f} {base_te_m['mape']:>6.1f}%")
    best_model_name = "ElasticNet"
    best_val_r2 = max(ridge_va["r2"], best_en_val, best_rf_val)
    for name, tr_m, va_m, te_m in [("Ridge",ridge_tr,ridge_va,ridge_te),
                                    ("ElasticNet",en_tr,en_va,en_te),
                                    ("RandomForest",rf_tr,rf_va,rf_te)]:
        beats = "✅" if te_m["mape"] < base_te_m["mape"] else "❌"
        print(f"  {name:<18} {tr_m['r2']:>+7.3f} {va_m['r2']:>+7.3f} {te_m['r2']:>+7.3f} {te_m['mae']:>8,.0f} {te_m['mape']:>6.1f}% {beats}")
        if va_m["r2"] == best_val_r2:
            best_model_name = name
    print(f"  Best by val R²: {best_model_name}")
    print(f"  ℹ️  Negative R² = tiny variance target (near-capacity). Use MAPE.")

    # ── correlations (training set only) ──────────────────────────────────────
    X_tr_raw = np.array([[all_records[i][k] for k in ACTIVE_KEYS] for i in train_idx], dtype=float)
    correlations = {}
    for j, fk in enumerate(ACTIVE_KEYS):
        col = X_tr_raw[:,j]
        correlations[fk] = round(float(np.corrcoef(col, y_sqrt_norm[train_idx])[0,1]), 4) if col.std()>1e-9 else 0.0
    sorted_corr = sorted(correlations.items(), key=lambda x: -abs(x[1]))
    print(f"\n  Top correlations:")
    for fk, c in sorted_corr[:8]:
        lbl = feat_map.get(fk, fk)
        print(f"    {lbl:<38} r={c:+.3f}")

    # ── insights (training data only) ─────────────────────────────────────────
    team_mean_map = {}
    for r in all_records:
        team_mean_map.setdefault(r["team"], []).append(r["attendance_raw"])
    team_mean_map = {k: float(np.mean(v)) for k,v in team_mean_map.items()}

    def grp_diff(split_fn):
        grp_a = [all_records[i]["attendance_raw"] - team_mean_map[all_records[i]["team"]]
                 for i in train_idx if split_fn(all_records[i])]
        grp_b = [all_records[i]["attendance_raw"] - team_mean_map[all_records[i]["team"]]
                 for i in train_idx if not split_fn(all_records[i])]
        if len(grp_a)<2 or len(grp_b)<2: return None
        d = round(float(np.mean(grp_a) - np.mean(grp_b)))
        return {"diff": d, "n_a": len(grp_a), "n_b": len(grp_b)}

    insight_checks = [
        (lambda r: r.get("total_precip_mm",0)>1 or r.get("weather",{}).get("is_rain",False),
         "🌧","Rain games","vs clear-weather","total_precip_mm"),
        (lambda r: r.get("is_weekend",False)>0.5,
         "📅","Weekend games","vs weekday","is_weekend"),
        (lambda r: r.get("is_saturday",False)>0.5 if sport=="baseball" else False,
         "⚾","Saturday games (MLB)","vs other days","is_saturday"),
        (lambda r: r.get("is_divisional",False)>0.5,
         "⚔️","Divisional rivals","vs non-division","is_divisional"),
        (lambda r: r.get("opponent_win_pct",0.5)>=0.6,
         "🏆","vs winning opponents (60%+)","vs losing opponents","opponent_win_pct"),
        (lambda r: r.get("home_streak",0)>=3,
         "🔥","3+ game win streak","vs neutral/losing","home_streak"),
        (lambda r: r.get("season_phase_num",1)>=2,
         "🏟","Late season","vs early/mid season","season_phase_num"),
        (lambda r: r.get("holiday_is_holiday_week",False) or r.get("is_holiday_week",False),
         "🎆","Holiday week","vs regular weeks","is_holiday_week"),
        (lambda r: r.get("att_lag1_norm",0)>0.3 if sport=="baseball" else False,
         "📈","Hot att. run (MLB)","vs cold att. run","att_lag1_norm"),
    ]

    insights_raw = []
    for fn, icon, label_a, label_b, feat in insight_checks:
        d = grp_diff(fn)
        if not d: continue
        sign = "more" if d["diff"]>0 else "fewer"
        txt = f"{icon} {label_a} draw {abs(d['diff']):,} {sign} fans — {label_b} ({d['n_a']} vs {d['n_b']} games)"
        insights_raw.append({"icon":icon,"text":txt,"diff":d["diff"],"feature":feat})
    insights_raw.sort(key=lambda x: -abs(x["diff"]))
    print(f"\n  Insights ({len(insights_raw)}):")
    for ins in insights_raw: print(f"    {ins['text']}")

    # ── final model on all data → forward predictions ─────────────────────────
    print(f"\n  🏆 Final Ridge retrained on ALL data for forward predictions...")
    ridge_final = ridge_fit(X_std, y_sqrt_norm, best_a_r)
    X_aug_all   = np.column_stack([X_std, np.ones(len(X_std))])
    pred_all_sc = X_aug_all @ ridge_final
    pred_all_raw = inv_transform(pred_all_sc, list(range(len(all_records))))
    in_sample_mape = mape_score(y_raw, pred_all_raw)
    print(f"     In-sample MAPE: {in_sample_mape:.1f}%")

    # per-game predictions output
    split_set_tr = set(train_idx); split_set_va = set(val_idx)
    game_preds = []
    for i, r in enumerate(all_records):
        split = "train" if i in split_set_tr else ("val" if i in split_set_va else "test")
        pred_raw = int(inv_transform([X_aug_all[i] @ ridge_final], [i])[0])
        game_preds.append({
            "team": r["team"], "season": r["season"], "date": r["date"],
            "opponent": r["opponent"], "won": r["won"], "split": split,
            "actual": int(r["attendance_raw"]), "predicted": pred_raw,
            "residual": int(r["attendance_raw"]) - pred_raw,
        })

    test_rmse = ridge_te["rmse"]
    ci_half   = round(test_rmse * 1.96)

    # ── assemble results ───────────────────────────────────────────────────────
    return {
        "sport": sport,
        "methodology": {
            "sport": sport,
            "n_teams": len(set(r["team"] for r in all_records)),
            "seasons": sorted(set(r["season"] for r in all_records)),
            "n_training_samples": len(train_idx),
            "n_val_samples": len(val_idx),
            "n_test_samples": len(test_idx),
            "total_home_games": total_games,
            "split_method": "Chronological 60/20/20 per team-season",
            "target_transform": "sqrt(attendance) normalised per team-season",
            "multicollinearity_threshold": 0.75,
            "dropped_features": list(to_drop),
            "active_features": ACTIVE_KEYS,
            "lag_features": lag_keys,
            "primary_metric": "MAPE — R² misleading for near-capacity venues",
            "naive_baseline_test_mape": base_te_m["mape"],
            "naive_baseline_test_mae":  base_te_m["mae"],
        },
        "features_used":   ACTIVE_KEYS,
        "feature_labels":  {**feat_map, "att_lag1_norm":"Prev Home Att (norm)","att_rolling5_norm":"5-Game Rolling Avg (norm)"},
        "team_mean_attendance": {k: round(v) for k,v in team_mean_map.items()},
        "correlations":    dict(sorted(correlations.items(), key=lambda x: -abs(x[1]))),
        "model_comparison": {
            "ridge":        {"train_r2":ridge_tr["r2"],"val_r2":ridge_va["r2"],"test_r2":ridge_te["r2"],"test_mae":ridge_te["mae"],"test_mape":ridge_te["mape"]},
            "elasticnet":   {"train_r2":en_tr["r2"],   "val_r2":en_va["r2"],   "test_r2":en_te["r2"],   "test_mae":en_te["mae"],   "test_mape":en_te["mape"],"alpha":best_a_en,"l1_ratio":best_l1},
            "randomforest": {"train_r2":rf_tr["r2"],   "val_r2":rf_va["r2"],   "test_r2":rf_te["r2"],   "test_mae":rf_te["mae"],   "test_mape":rf_te["mape"]},
            "best_by_val":  best_model_name,
        },
        "linear_model": {
            "r2": ridge_te["r2"], "mae": ridge_te["mae"],
            "rmse": ridge_te["rmse"], "mape": ridge_te["mape"],
            "coefficients": dict(sorted(coeffs_raw.items(), key=lambda x: -abs(x[1]))),
            "intercept": 0,
        },
        "rf_model": {
            "model_name":       "RandomForest",
            "r2":               rf_te["r2"], "mae": rf_te["mae"],
            "rmse":             rf_te["rmse"], "mape": rf_te["mape"],
            "feature_importance": dict(sorted(rf_importance.items(), key=lambda x: -x[1])),
        },
        "predictions":         game_preds,
        "insights":            [i["text"] for i in insights_raw],
        "insights_detail":     insights_raw,
        "ci_halfwidth":        ci_half,
        "ridge_final_coeffs":  ridge_final.tolist(),
        "feat_mean":           feat_mean.tolist(),
        "feat_std":            feat_std.tolist(),
        "active_keys":         ACTIVE_KEYS,
    }


# ─── run both sports ──────────────────────────────────────────────────────────

print("╔══════════════════════════════════════════════════════╗")
print("║   FanIQ Multi-Sport Attendance Model                ║")
print("║   NFL + MLB  ·  Scientific 60/20/20 split           ║")
print("╚══════════════════════════════════════════════════════╝")

results = {"generated_at": datetime.now(timezone.utc).isoformat()}

nfl_result = run_model("football")
if nfl_result:
    results["nfl"] = nfl_result

mlb_result = run_model("baseball")
if mlb_result:
    results["mlb"] = mlb_result

# Backwards-compat keys the dashboard JS reads
if nfl_result:
    results["methodology"]     = nfl_result["methodology"]
    results["linear_model"]    = nfl_result["linear_model"]
    results["rf_model"]        = nfl_result["rf_model"]
    results["correlations"]    = nfl_result["correlations"]
    results["feature_labels"]  = nfl_result["feature_labels"]
    results["features_used"]   = nfl_result["features_used"]
    results["predictions"]     = nfl_result["predictions"]
    results["insights"]        = nfl_result["insights"]
    results["ci_halfwidth"]    = nfl_result["ci_halfwidth"]
    results["model_comparison"]= nfl_result["model_comparison"]
    results["team_mean_attendance"] = nfl_result["team_mean_attendance"]

with open(_DATA_DIR / "model_results.json", "w") as f:
    json.dump(results, f, indent=2, default=str)

size_kb = len(json.dumps(results)) // 1024
print(f"\n✅ Saved model_results.json ({size_kb} KB)")
print(f"   NFL: {nfl_result['methodology']['total_home_games'] if nfl_result else 0} home games | MLB: {mlb_result['methodology']['total_home_games'] if mlb_result else 'no data yet'} home games")
print(f"   Run scraper batches then retrain: python3.13 model.py")
