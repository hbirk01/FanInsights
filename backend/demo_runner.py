"""
FanInsights Demo Runner — Fan Journey Orchestration

Pulls real data (49ers ghost risk, live weather from Open-Meteo),
renders HTML email templates, and sends via notifier.py.

Three steps mirror the email chain described in the PwC pitch:
  step1_geo_trigger  — fan detected near stadium → personalized ticket offer
  step2_checkin      — fan enters stadium → food/upgrade/loyalty notification
  step3_social       — post-game → social incentive + LTV summary
"""
from __future__ import annotations

import json
import math
import random
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from string import Template
from typing import Any

from notifier import send_email, RECIPIENT_EMAIL, DEMO_FAN, DEMO_TEAM

# ── paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
DATA_PATH  = BASE_DIR / "data" / "real_data.json"
TMPL_DIR   = BASE_DIR / "templates"

# ── fan profile (Marcus Thompson — maps to dashboard mock data) ───────────────
FAN_PROFILE = {
    "name":           DEMO_FAN or "Marcus Thompson",
    "section":        "Sec 120",
    "row":            "Row 3",
    "seat_count":     2,
    "party":          3,
    "party_desc":     "Family (2 adults, 1 child)",
    "preferred_zone": "Lower Bowl · Sideline",
    "price_point":    142,
    "loyalty":        91,
    "ltv":            8240,
    "tier":           "Gold",
    "next_tier":      "Platinum",
    "attend_games":   16,
    "food_order":     "3x Tacos + 2x Modelo + 1 lemonade",
    "food_total":     58,
    "uber_est":       24,
    "jersey_price":   85,
    "gate":           "C",
    "upgrade_section":"Sec 108",
    "upgrade_price":  12,
    "friends":        [
        {"name": "Sarah Chen",    "distance": "1.8 mi", "status": "Link sent"},
        {"name": "James Williams","distance": "3.4 mi", "status": "Pending"},
    ],
}

# ── load real 49ers data ───────────────────────────────────────────────────────

def _load_real_data() -> dict:
    if not DATA_PATH.exists():
        return {}
    with open(DATA_PATH) as f:
        return json.load(f)


def get_real_game_stats(team: str = "sf49ers") -> dict:
    """Return avg ghost risk + last game info from real scraped data."""
    data = _load_real_data()
    teams = data.get("teams", {})
    td = teams.get(team, {})
    games = td.get("games", [])

    home_games = [g for g in games if g.get("is_home") and g.get("attendance")]
    recent = home_games[-3:] if len(home_games) >= 3 else home_games

    avg_ghost = sum(g.get("ghost_risk", 0.20) for g in recent) / max(len(recent), 1)
    seats_remaining = int(avg_ghost * (td.get("team_info", {}).get("venue_capacity", 68500)))

    # Last completed home game for context
    last = home_games[-1] if home_games else {}
    last_won  = last.get("won", True)
    our_score = last.get("our_score", 27)
    opp_score = last.get("opp_score", 17)
    opponent  = last.get("opponent", "Los Angeles Rams")

    # Derive "next game" date — next Sunday after last game
    last_date = last.get("date", "2024-12-31")
    try:
        dt = datetime.strptime(last_date, "%Y-%m-%d")
        days_ahead = (6 - dt.weekday()) % 7 or 7
        next_dt = dt + timedelta(days=days_ahead + 7)
        next_date_str = next_dt.strftime("%A, %B %-d, %Y")
    except Exception:
        next_date_str = "Sunday, January 12, 2025"

    return {
        "avg_ghost_risk": round(avg_ghost, 3),
        "ghost_risk_pct": round(avg_ghost * 100, 1),
        "seats_remaining": seats_remaining,
        "last_won":        last_won,
        "our_score":       our_score,
        "opp_score":       opp_score,
        "opponent":        opponent,
        "next_game_date":  next_date_str,
        "team_name":       td.get("team_info", {}).get("name", "SF 49ers"),
        "sentiment_score": td.get("sentiment_score", 72),
        "season_record":   td.get("team_info", {}).get("record", "10-7"),
    }


# ── live weather from Open-Meteo ───────────────────────────────────────────────
LEVIS_LAT = 37.4032
LEVIS_LON = -121.9698

def get_live_weather() -> dict:
    """Fetch today/tomorrow weather for Levi's Stadium from Open-Meteo forecast API."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={LEVIS_LAT}&longitude={LEVIS_LON}"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max"
        f"&temperature_unit=celsius"
        f"&windspeed_unit=kmh"
        f"&timezone=America%2FLos_Angeles"
        f"&forecast_days=3"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "FanIQ-POC/1.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            w = json.loads(r.read())["daily"]
        temp_c   = w["temperature_2m_max"][0]
        temp_f   = round(temp_c * 9/5 + 32)
        precip   = w["precipitation_sum"][0]
        wind_kmh = w["windspeed_10m_max"][0]
        wind_mph = round(wind_kmh * 0.621)
        is_rain  = precip > 1.0
        is_cold  = temp_c < 8
        is_hot   = temp_c > 32
        return {
            "temp_c": temp_c, "temp_f": temp_f,
            "precip_mm": precip, "wind_kmh": wind_kmh, "wind_mph": wind_mph,
            "is_rain": is_rain, "is_cold": is_cold, "is_hot": is_hot,
            "weather_icon":  "🌧" if is_rain else ("❄️" if is_cold else ("☀️" if is_hot else "⛅")),
            "precip_icon":   "🌧" if is_rain else "☀️",
            "precip_label":  f"{precip:.1f}mm rain" if is_rain else "No rain",
            "weather_class": "rain" if is_rain else ("cold" if is_cold else ""),
            "precip_class":  "rain" if is_rain else "",
        }
    except Exception as e:
        # Fallback if API unreachable
        return {
            "temp_c": 18, "temp_f": 64, "precip_mm": 0.0,
            "wind_kmh": 14, "wind_mph": 9,
            "is_rain": False, "is_cold": False, "is_hot": False,
            "weather_icon": "⛅", "precip_icon": "☀️",
            "precip_label": "Clear", "weather_class": "", "precip_class": "",
            "api_error": str(e),
        }


# ── pricing helper ────────────────────────────────────────────────────────────

def calc_discount(ghost_risk: float) -> tuple[int, int, int]:
    """Return (discount_pct, sale_price, orig_price) based on ghost risk."""
    orig   = FAN_PROFILE["price_point"]
    disc   = 25 if ghost_risk > 0.35 else (15 if ghost_risk > 0.25 else 8)
    sale   = round(orig * (1 - disc / 100))
    return disc, sale, orig


# ── template rendering ────────────────────────────────────────────────────────

def _render(template_name: str, ctx: dict[str, Any]) -> str:
    tmpl = (TMPL_DIR / template_name).read_text(encoding="utf-8")
    # Replace {{key}} placeholders
    for k, v in ctx.items():
        tmpl = tmpl.replace("{{" + k + "}}", str(v))
    return tmpl


def _short_id() -> str:
    return hex(random.randint(0x10000, 0xFFFFF))[2:].upper()


# ── STEP 1 — Geo Trigger ──────────────────────────────────────────────────────

def step1_geo_trigger() -> dict:
    """Build + send the geo-proximity ticket offer email."""
    fan    = FAN_PROFILE
    stats  = get_real_game_stats(DEMO_TEAM)
    wx     = get_live_weather()
    disc, sale, orig = calc_discount(stats["avg_ghost_risk"])
    seat_count = fan["seat_count"]
    savings    = (orig - sale) * seat_count
    total_cost = sale * seat_count + fan["food_total"] + 45  # parking

    friends_count = len(fan["friends"])
    friend_names  = " and ".join(f["name"] for f in fan["friends"])
    friend_distances = fan["friends"][0]["distance"] if fan["friends"] else "nearby"

    offer_id = _short_id()
    share_id = _short_id()

    ctx = {
        # Fan
        "fan_name":       fan["name"],
        "section":        fan["section"],
        "row":            fan["row"],
        "seat_count":     seat_count,
        "party_desc":     fan["party_desc"],
        "preferred_zone": fan["preferred_zone"],
        "fan_ltv":        f"{fan['ltv']:,}",
        "loyalty_score":  fan["loyalty"],
        "loyalty_pct":    "8",
        "attend_games":   fan["attend_games"],
        # Offer
        "orig_price":     orig,
        "sale_price":     sale,
        "discount_pct":   disc,
        "savings":        savings,
        "total_cost":     total_cost,
        "food_order":     fan["food_order"],
        "food_total":     fan["food_total"],
        "uber_est":       fan["uber_est"],
        "jersey_price":   fan["jersey_price"],
        "offer_id":       offer_id,
        "share_id":       share_id,
        # Game / stats
        "opponent":       stats["opponent"],
        "game_date":      stats["next_game_date"],
        "kickoff_time":   "5:20 PM",
        "seats_remaining": f"{stats['seats_remaining']:,}",
        "ghost_risk_pct": stats["ghost_risk_pct"],
        # Weather (live)
        "temp_f":         wx["temp_f"],
        "wind_mph":       wx["wind_mph"],
        "weather_icon":   wx["weather_icon"],
        "precip_icon":    wx["precip_icon"],
        "precip_label":   wx["precip_label"],
        "weather_class":  wx["weather_class"],
        "precip_class":   wx["precip_class"],
        # Proximity / friends
        "distance":       "3.2 miles",
        "friends_count":  friends_count,
        "friend_names":   friend_names,
        "friends_distance": f"{friends_count} within 5 mi",
    }

    html = _render("email_offer.html", ctx)
    subject = f"🏈 {fan['name']} — you're 3.2mi from Levi's. {seat_count} seats at ${sale}/ea ({disc}% off)"
    result = send_email(RECIPIENT_EMAIL, subject, html)

    return {
        "step": 1,
        "name": "Geo Trigger",
        "email_sent": result["sent"],
        "email_error": result.get("error"),
        "recipient": RECIPIENT_EMAIL,
        "subject": subject,
        "data_used": {
            "ghost_risk_pct": stats["ghost_risk_pct"],
            "seats_remaining": stats["seats_remaining"],
            "temp_f": wx["temp_f"],
            "precip_label": wx["precip_label"],
            "discount_pct": disc,
            "total_cost": total_cost,
            "weather_source": "Open-Meteo live forecast API",
            "attendance_source": "ESPN scraper — last 3 49ers home games",
        },
    }


# ── STEP 2 — Stadium Check-in ──────────────────────────────────────────────────

def step2_checkin() -> dict:
    """Send the stadium entry confirmation email."""
    fan   = FAN_PROFILE
    stats = get_real_game_stats(DEMO_TEAM)
    now   = datetime.now().strftime("%-I:%M %p")

    # LTV progress bar
    games_played = fan["attend_games"]
    games_to_plat = max(0, 20 - games_played)
    ltv_pct = min(95, int(games_played / 20 * 100))

    ctx = {
        "fan_name":         fan["name"],
        "gate":             fan["gate"],
        "checkin_time":     now,
        "section":          fan["section"],
        "row":              fan["row"],
        "food_order":       fan["food_order"],
        "food_eta":         12,
        "upgrade_section":  fan["upgrade_section"],
        "upgrade_price":    fan["upgrade_price"],
        "friends_joined":   1,
        "friend_pts":       200,
        "tier_label":       fan["tier"],
        "next_tier":        fan["next_tier"],
        "games_to_next":    games_to_plat,
        "ltv_progress_pct": ltv_pct,
        "fan_ltv":          f"{fan['ltv']:,}",
        "game_ltv_contribution": 285,
    }

    html = _render("email_checkin.html", ctx)
    subject = f"✅ You're in, {fan['name']}! Food on its way · Seat upgrade available"
    result  = send_email(RECIPIENT_EMAIL, subject, html)

    return {
        "step": 2,
        "name": "Stadium Check-in",
        "email_sent": result["sent"],
        "email_error": result.get("error"),
        "recipient": RECIPIENT_EMAIL,
        "subject": subject,
    }


# ── STEP 3 — Post-Game Social Push ────────────────────────────────────────────

def step3_social() -> dict:
    """Send post-game social incentive + LTV recap email."""
    fan   = FAN_PROFILE
    stats = get_real_game_stats(DEMO_TEAM)

    result_class   = "win" if stats["last_won"] else "loss"
    result_emoji   = "🏆" if stats["last_won"] else "💪"
    result_headline = (
        f"49ers WIN! Share the moment!" if stats["last_won"]
        else f"Tough game. Show your loyalty, {fan['name']}."
    )

    opp_clean = stats["opponent"].replace("Los Angeles ", "LA ").replace("New England ", "NE ")
    opp_hashtag = stats["opponent"].replace(" ", "").replace(".", "")

    if stats["last_won"]:
        caption = (
            f"What a night at Levi's! 🏈 49ers {stats['our_score']}–{stats['opp_score']} "
            f"vs {opp_clean}. Nothing beats it with the family. #GoNiners"
        )
    else:
        caption = (
            f"Tough loss tonight but these fans never quit. "
            f"Niners faithful to the end. #GoNiners #FTTB"
        )

    friend_rows_html = "".join(
        f'<div class="referral-row">'
        f'<span class="referral-fan">👤 {f["name"]} — {f["distance"]}</span>'
        f'<span class="referral-status" style="color:#22C55E;">{f["status"]}</span>'
        f'</div>'
        for f in fan["friends"]
    )

    share_id = _short_id()

    # LTV components for tonight
    ticket_val     = fan["price_point"] * fan["seat_count"]
    food_val       = fan["food_total"]
    transport_val  = 45 + fan["uber_est"]
    merch_val      = fan["jersey_price"]
    referral_val   = len(fan["friends"]) * 820 * 0.05  # 5% of referred fan LTV
    tonight_ltv    = round(ticket_val + food_val + transport_val + merch_val + referral_val)
    season_ltv_m   = round(72441 * 4820 / 1_000_000, 1)

    ctx = {
        "fan_name":              fan["name"],
        "section":               fan["section"],
        "result_class":          result_class,
        "result_emoji":          result_emoji,
        "result_headline":       result_headline,
        "our_score":             stats["our_score"],
        "opp_score":             stats["opp_score"],
        "opponent":              stats["opponent"],
        "game_date":             stats["next_game_date"],
        "suggested_caption":     caption,
        "opponent_hashtag":      opp_hashtag,
        "friend_rows":           friend_rows_html,
        "share_id":              share_id,
        # LTV breakdown
        "ticket_contribution":   ticket_val,
        "food_contribution":     food_val,
        "transport_contribution":transport_val,
        "merch_contribution":    merch_val,
        "referral_contribution": round(referral_val),
        "referrals":             len(fan["friends"]),
        "tonight_ltv":           tonight_ltv,
        "total_ltv":             f"{fan['ltv']:,}",
        "games_to_platinum":     max(0, 20 - fan["attend_games"]),
        "total_spend":           tonight_ltv,
        "season_ltv_m":          season_ltv_m,
    }

    html = _render("email_social.html", ctx)
    subject = (
        f"🏆 49ers win! Share your photo → 500 FanIQ pts · Tonight's LTV recap"
        if stats["last_won"] else
        f"49ers · Share the loyalty · 500 FanIQ pts waiting, {fan['name']}"
    )
    result = send_email(RECIPIENT_EMAIL, subject, html)

    return {
        "step": 3,
        "name": "Post-Game Social",
        "email_sent": result["sent"],
        "email_error": result.get("error"),
        "recipient": RECIPIENT_EMAIL,
        "subject": subject,
        "data_used": {
            "last_game_result": "Win" if stats["last_won"] else "Loss",
            "score": f"{stats['our_score']}-{stats['opp_score']}",
            "tonight_ltv": tonight_ltv,
        },
    }


# ── CLI runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    step = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    runners = {1: step1_geo_trigger, 2: step2_checkin, 3: step3_social}
    fn = runners.get(step)
    if not fn:
        print("Usage: python demo_runner.py [1|2|3]")
        sys.exit(1)
    print(f"\n🚀 Running Step {step}...")
    result = fn()
    print(json.dumps(result, indent=2))
    if result.get("email_sent"):
        print(f"\n✅ Email sent to {result['recipient']}")
    else:
        print(f"\n❌ Email not sent: {result.get('email_error')}")
        print("   → Set SENDER_EMAIL and SENDER_PASSWORD in backend/.env")
