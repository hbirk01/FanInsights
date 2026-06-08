/* ── FanInsights · Game Day Mode ────────────────────────────────────────────
   Standalone mobile page: fetches /api/gameday/{team} and renders
   matchup banner, attendance hero, weather strip, model factors,
   and fan-action recommendation.
─────────────────────────────────────────────────────────────────────────── */

var NFL_TEAMS = [
  { key:'sf49ers',   name:'San Francisco 49ers' },
  { key:'chiefs',    name:'Kansas City Chiefs' },
  { key:'cowboys',   name:'Dallas Cowboys' },
  { key:'eagles',    name:'Philadelphia Eagles' },
  { key:'giants',    name:'New York Giants' },
  { key:'commanders',name:'Washington Commanders' },
  { key:'seahawks',  name:'Seattle Seahawks' },
  { key:'rams',      name:'Los Angeles Rams' },
  { key:'cardinals', name:'Arizona Cardinals' },
  { key:'bears',     name:'Chicago Bears' },
  { key:'lions',     name:'Detroit Lions' },
  { key:'packers',   name:'Green Bay Packers' },
  { key:'vikings',   name:'Minnesota Vikings' },
  { key:'saints',    name:'New Orleans Saints' },
  { key:'falcons',   name:'Atlanta Falcons' },
  { key:'buccaneers',name:'Tampa Bay Buccaneers' },
  { key:'panthers',  name:'Carolina Panthers' },
  { key:'bills',     name:'Buffalo Bills' },
  { key:'patriots',  name:'New England Patriots' },
  { key:'dolphins',  name:'Miami Dolphins' },
  { key:'jets',      name:'New York Jets' },
  { key:'raiders',   name:'Las Vegas Raiders' },
  { key:'chargers',  name:'Los Angeles Chargers' },
  { key:'broncos',   name:'Denver Broncos' },
  { key:'ravens',    name:'Baltimore Ravens' },
  { key:'steelers',  name:'Pittsburgh Steelers' },
  { key:'browns',    name:'Cleveland Browns' },
  { key:'bengals',   name:'Cincinnati Bengals' },
  { key:'texans',    name:'Houston Texans' },
  { key:'colts',     name:'Indianapolis Colts' },
  { key:'jaguars',   name:'Jacksonville Jaguars' },
  { key:'titans',    name:'Tennessee Titans' },
];

var MLB_TEAMS = [
  { key:'rockies', name:'Colorado Rockies' },
  { key:'dodgers', name:'Los Angeles Dodgers' },
  { key:'cubs',    name:'Chicago Cubs' },
  { key:'pirates', name:'Pittsburgh Pirates' },
  { key:'yankees', name:'New York Yankees' },
];

var ALL_TEAMS = NFL_TEAMS.concat(MLB_TEAMS);

/* ── URL param helpers ──────────────────────────────────────────────────── */
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function setParam(key, val) {
  var u = new URLSearchParams(window.location.search);
  u.set(key, val);
  history.replaceState({}, '', '?' + u.toString());
}

/* ── format helpers ─────────────────────────────────────────────────────── */
function fmt(n)  { return n != null ? Math.round(n).toLocaleString() : '—'; }
function fmtPct(n){ return n != null ? n.toFixed(1) + '%' : '—'; }

function kickoffLabel(hour) {
  if (hour == null) return '';
  var h = hour % 12 || 12;
  var ampm = hour >= 12 ? 'PM' : 'AM';
  return h + ':00 ' + ampm;
}

function dateLabel(dateStr) {
  if (!dateStr) return '—';
  var d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
}

function weatherIcon(wx) {
  if (!wx) return '🌡';
  var sev = wx.severity || 0;
  var rain = wx.is_rain;
  var cond = (wx.conditions || '').toLowerCase();
  var hasCond = cond.length > 0;
  // Only use severity-based icons if we also have condition text to confirm
  if (hasCond && (sev > 0.6 || cond.indexOf('storm') >= 0 || cond.indexOf('thunder') >= 0)) return '⛈';
  if (rain || cond.indexOf('rain') >= 0 || cond.indexOf('shower') >= 0)                      return '🌧';
  if (hasCond && (sev > 0.3 || cond.indexOf('cloud') >= 0 || cond.indexOf('overcast') >= 0)) return '⛅';
  if (cond.indexOf('snow') >= 0 || cond.indexOf('flurr') >= 0)                               return '❄️';
  if (cond.indexOf('fog') >= 0 || cond.indexOf('haze') >= 0)                                 return '🌫';
  if (!hasCond) return '🌡';  // no conditions scraped
  return '☀️';
}

function gaugeColor(pct) {
  if (pct == null) return '#22D3EE';
  if (pct >= 96)   return '#22D3EE';    // cyan  — near sellout
  if (pct >= 88)   return '#10D9A0';    // green — solid
  if (pct >= 78)   return '#F5A524';    // amber — soft
  return '#F05555';                     // red   — low fill
}

function phaseLabel(phase) {
  return { early: 'Early', mid: 'Mid', late: 'Late' }[phase] || (phase || '—');
}

/* ── team selector ──────────────────────────────────────────────────────── */
function populateTeamSelect(activeKey) {
  var sel = document.getElementById('team-select');
  if (!sel) return;
  sel.innerHTML = ALL_TEAMS.map(function(t) {
    return '<option value="' + t.key + '"' + (t.key === activeKey ? ' selected' : '') + '>' + t.name + '</option>';
  }).join('');
}

function switchTeam(teamKey) {
  setParam('team', teamKey);
  loadGameDay(teamKey);
}

/* ── render ─────────────────────────────────────────────────────────────── */
function render(d) {
  var game = d.game || {};
  var att  = d.attendance || {};
  var wx   = d.weather || {};
  var rec  = d.recommendation || {};

  // sport label
  var sportEl = document.getElementById('sport-label');
  if (sportEl) sportEl.textContent = d.sport === 'baseball' ? 'MLB' : 'NFL';

  // opponent
  setText('opponent-name', game.opponent || '—');

  // game meta line
  var metaParts = [];
  if (game.date)   metaParts.push(dateLabel(game.date));
  if (game.week)   metaParts.push('Wk ' + game.week);
  if (game.kickoff_hour != null) metaParts.push(kickoffLabel(game.kickoff_hour));
  if (d.venue)     metaParts.push(d.venue);
  setText('game-meta-line', metaParts.join(' · '));

  // tags
  var tags = [];
  if (game.is_divisional)  tags.push({ label: 'Divisional', hi: true });
  if (game.is_prime_time)  tags.push({ label: 'Prime Time', hi: true });
  if (game.is_holiday_week && game.nearest_holiday) tags.push({ label: game.nearest_holiday + ' Week', hi: false });
  if (game.is_weekend)     tags.push({ label: 'Weekend',    hi: false });
  var streak = game.streak_going_in;
  if (streak && Math.abs(streak) >= 2) {
    var sd = (game.streak_dir === 'W' ? 'W' : 'L') + Math.abs(streak) + ' Streak';
    tags.push({ label: sd, hi: game.streak_dir === 'W' });
  }
  var tagsEl = document.getElementById('game-tags');
  if (tagsEl) tagsEl.innerHTML = tags.map(function(t) {
    return '<span class="tag' + (t.hi ? ' highlight' : '') + '">' + t.label + '</span>';
  }).join('');

  // stat strip
  setText('strip-record',     d.home_record_l5 || '—');
  setText('strip-opp-record', game.opponent_record || '—');
  setText('strip-phase',      phaseLabel(game.season_phase));

  // attendance hero
  setText('att-number',  fmt(att.predicted));
  setText('att-ci',      '±' + fmt(att.ci));
  setText('att-cap-pct', fmtPct(att.capacity_pct) + ' capacity');

  // gauge
  var pct  = att.capacity_pct || 0;
  var fill = document.getElementById('gauge-fill');
  if (fill) {
    fill.style.background = gaugeColor(pct);
    setTimeout(function() { fill.style.width = Math.min(pct, 100) + '%'; }, 80);
  }
  setText('gauge-mid', fmtPct(pct));

  // actual result (game already played)
  if (att.actual) {
    var arEl = document.getElementById('actual-result');
    if (arEl) arEl.style.display = 'flex';
    setText('actual-val', fmt(att.actual));
    var err = att.actual - att.predicted;
    var errPct = att.predicted ? (Math.abs(err) / att.actual * 100).toFixed(1) : '—';
    setText('model-err', (err >= 0 ? '+' : '') + fmt(err) + ' (' + errPct + '%)');
    var scoreEl = document.getElementById('score-line');
    if (scoreEl && game.our_score != null) {
      var won = game.won;
      scoreEl.innerHTML = '<span class="' + (won ? 'won' : 'lost') + '">'
        + (won ? 'W' : 'L') + ' ' + game.our_score + '–' + game.opp_score + '</span>';
    }
  }

  // weather
  var wxIcon = weatherIcon(wx);
  setText('wx-icon', wxIcon);
  var wxMain = [];
  if (wx.temp_c != null) wxMain.push(Math.round(wx.temp_c * 9/5 + 32) + '°F');
  if (wx.conditions)     wxMain.push(wx.conditions);
  setText('wx-main', wxMain.join(' · ') || 'No weather data');
  var wind = wx.wind_kmh ? Math.round(wx.wind_kmh * 0.621) + ' mph wind' : '';
  setText('wx-sub', wind || 'Wind data unavailable');

  var sev = wx.severity || 0;
  var hasWxData = !!(wx.conditions || wx.temp_c != null || wx.wind_kmh);
  var sevEl = document.getElementById('wx-sev-badge');
  if (sevEl) {
    if (!hasWxData) {
      sevEl.className = 'weather-sev sev-low'; sevEl.textContent = 'No Data';
    } else if (sev > 0.5) {
      sevEl.className = 'weather-sev sev-high'; sevEl.textContent = 'High Impact';
    } else if (sev > 0.2) {
      sevEl.className = 'weather-sev sev-mid';  sevEl.textContent = 'Moderate';
    } else {
      sevEl.className = 'weather-sev sev-low';  sevEl.textContent = 'Low Impact';
    }
  }

  // key factors
  var facEl = document.getElementById('factors-list');
  if (facEl) {
    if (d.factors && d.factors.length) {
      facEl.innerHTML = d.factors.map(function(f) {
        var up = f.direction === 'up';
        return '<div class="factor-row">'
          + '<div class="factor-arrow">' + (up ? '↑' : '↓') + '</div>'
          + '<div class="factor-label">' + f.label + '</div>'
          + '<div class="factor-impact ' + (up ? 'impact-up' : 'impact-down') + '">'
          + (up ? '+' : '') + fmt(f.impact) + ' fans</div>'
          + '</div>';
      }).join('');
    } else {
      facEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">Factor breakdown unavailable — run model to generate.</div>';
    }
  }

  // recommendation
  var recCard = document.getElementById('rec-card');
  if (recCard) {
    recCard.style.background = 'rgba(0,0,0,0)'; // reset
    recCard.style.borderColor = hexAlpha(rec.color || '#22D3EE', 0.3);
    recCard.style.background  = hexAlpha(rec.color || '#22D3EE', 0.04);
  }
  var recDot = document.getElementById('rec-dot');
  if (recDot) recDot.style.background = rec.color || '#22D3EE';
  var capTitle = { upsell:'Upsell — Premium Upgrade Drive', winback:'Win-Back — Re-engagement Push',
    retention:'Retention — Loyalty Reinforcement', reacquisition:'Re-acquisition — High-Risk Churners' };
  setText('rec-strategy-name', capTitle[rec.strategy] || rec.strategy || '—');
  setText('rec-action', rec.action || '');

  var recBtn = document.getElementById('rec-btn');
  if (recBtn) {
    recBtn.style.background = rec.color || '#22D3EE';
    recBtn.style.color = isLight(rec.color) ? '#050B18' : '#EBF3FF';
    recBtn.href = '/?tab=fan&fan=' + (rec.fan || 'marcus');
    recBtn.textContent = 'View ' + (rec.tier || 'Fan') + ' Strategy in Dashboard →';
  }

  setText('rec-tier', 'RECOMMENDED FOR ' + (rec.tier || '').toUpperCase() + ' SEGMENT');
}

/* ── color helpers ──────────────────────────────────────────────────────── */
function hexAlpha(hex, a) {
  var r = parseInt(hex.slice(1,3),16);
  var g = parseInt(hex.slice(3,5),16);
  var b = parseInt(hex.slice(5,7),16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function isLight(hex) {
  if (!hex) return false;
  var r = parseInt(hex.slice(1,3),16);
  var g = parseInt(hex.slice(3,5),16);
  var b = parseInt(hex.slice(5,7),16);
  return (0.299*r + 0.587*g + 0.114*b) > 128;
}

/* ── DOM helper ─────────────────────────────────────────────────────────── */
function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val != null ? val : '—';
}

/* ── fetch & load ───────────────────────────────────────────────────────── */
function loadGameDay(team) {
  var loadEl  = document.getElementById('loading');
  var appEl   = document.getElementById('app');
  var errEl   = document.getElementById('error-state');

  if (loadEl)  loadEl.style.display = 'flex';
  if (appEl)   appEl.style.display  = 'none';
  if (errEl)   errEl.style.display  = 'none';

  var base = window.location.origin;
  fetch(base + '/api/gameday/' + team)
    .then(function(r) {
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.detail || r.statusText); });
      return r.json();
    })
    .then(function(data) {
      if (loadEl) loadEl.style.display = 'none';
      if (appEl)  appEl.style.display  = 'block';
      render(data);
    })
    .catch(function(err) {
      if (loadEl) loadEl.style.display = 'none';
      if (errEl)  errEl.style.display  = 'block';
      var msgEl = document.getElementById('err-msg');
      var detEl = document.getElementById('err-detail');
      if (msgEl) msgEl.textContent = 'Failed to load game data';
      if (detEl) detEl.textContent = err.message;
    });
}

/* ── init ───────────────────────────────────────────────────────────────── */
(function init() {
  var team = getParam('team') || 'sf49ers';
  populateTeamSelect(team);
  loadGameDay(team);
})();
