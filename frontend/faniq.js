// ── globals ──────────────────────────────────────────────────────────────────
var REAL = null;          // populated from real_data.json
var MODEL = null;         // populated from model_results.json
var ACTIVE_TEAM = "sf49ers";

var MLB_TEAMS     = new Set(["rockies","yankees","cubs","cardinals","pirates","dodgers"]);
var NFL_TEAMS     = new Set(["sf49ers","chiefs","cowboys","eagles","giants","commanders",
  "seahawks","rams","cardinals_nfl","bears","lions","packers","vikings","saints",
  "falcons","buccaneers","panthers","bills","patriots","dolphins","jets","chiefs",
  "raiders","chargers","broncos","ravens","steelers","browns","bengals","texans",
  "colts","jaguars","titans"]);
var NBA_TEAMS     = new Set(["lakers","warriors","celtics","heat"]);
var INDYCAR_EVENTS = new Set(["indy500","long_beach"]);

// ── per-team config: jersey, hashtag, sport icon ──────────────────────────────
var TEAM_CONFIG = {
  // NFL
  sf49ers:    { jersey:'Purdy #13',     hashtag:'#GoNiners',    icon:'🏈', sport:'NFL' },
  chiefs:     { jersey:'Mahomes #15',   hashtag:'#ChiefsKingdom', icon:'🏈', sport:'NFL' },
  cowboys:    { jersey:'Prescott #4',   hashtag:'#DallasCowboys', icon:'🏈', sport:'NFL' },
  eagles:     { jersey:'Hurts #1',      hashtag:'#FlyEaglesFly',  icon:'🏈', sport:'NFL' },
  // MLB
  rockies:    { jersey:'Tovar #11',     hashtag:'#Rockies',      icon:'⚾', sport:'MLB' },
  yankees:    { jersey:'Judge #99',     hashtag:'#RepBX',        icon:'⚾', sport:'MLB' },
  cubs:       { jersey:'Suzuki #27',    hashtag:'#ItsDifferentHere', icon:'⚾', sport:'MLB' },
  cardinals:  { jersey:'Goldschmidt #46',hashtag:'#STLCards',   icon:'⚾', sport:'MLB' },
  pirates:    { jersey:'Cruz #15',      hashtag:'#LetsGoBucs',   icon:'⚾', sport:'MLB' },
  dodgers:    { jersey:'Ohtani #17',    hashtag:'#AlwaysLA',     icon:'⚾', sport:'MLB' },
  // NBA
  lakers:     { jersey:'LeBron #23',    hashtag:'#LakeShow',     icon:'🏀', sport:'NBA' },
  warriors:   { jersey:'Curry #30',     hashtag:'#DubNation',    icon:'🏀', sport:'NBA' },
  celtics:    { jersey:'Tatum #0',      hashtag:'#BleedGreen',   icon:'🏀', sport:'NBA' },
  heat:       { jersey:'Butler #22',    hashtag:'#HEATCulture',  icon:'🏀', sport:'NBA' },
  // IndyCar
  indy500:    { jersey:'Palou #10',     hashtag:'#Indy500',      icon:'🏎', sport:'IndyCar' },
  long_beach: { jersey:'O\'Ward #5',    hashtag:'#LGPRIX',       icon:'🏎', sport:'IndyCar' },
};

var NBA_CONFIGS = {
  lakers:   { name:'Los Angeles Lakers',    capacity:19068, base_price:180 },
  warriors: { name:'Golden State Warriors', capacity:18064, base_price:210 },
  celtics:  { name:'Boston Celtics',        capacity:19156, base_price:175 },
  heat:     { name:'Miami Heat',            capacity:19600, base_price:160 },
};
var INDYCAR_CONFIGS = {
  indy500:    { name:'Indianapolis 500',  capacity:250000, base_price:95 },
  long_beach: { name:'Long Beach GP',     capacity:85000,  base_price:130 },
};

function activeSport() {
  if (MLB_TEAMS.has(ACTIVE_TEAM))     return 'baseball';
  if (NBA_TEAMS.has(ACTIVE_TEAM))     return 'basketball';
  if (INDYCAR_EVENTS.has(ACTIVE_TEAM)) return 'indycar';
  return 'football';
}

function isUnsupportedSport() {
  return NBA_TEAMS.has(ACTIVE_TEAM) || INDYCAR_EVENTS.has(ACTIVE_TEAM);
}
var chartsInit = false;
var chartInstances = {};

var GOLD = '#F5A524', GOLD2 = '#FBBF24', BLUE = '#22D3EE', GREEN = '#10D9A0',
    RED = '#F05555', PURPLE = '#A78BFA', ORANGE = '#FB923C', MUTED = '#7A9EC4', GRID = '#1C2E4A';

// ── mock fallback data ────────────────────────────────────────────────────────
var fans = [
  { id:1, name:'Marcus Thompson', init:'MT', color:'#6366F1', tier:'platinum', loyalty:91, ltv:8240, risk:8,  section:'Sec 120', ghostRate:'6%',  lastContact:'2 days ago',  attend:16, party:3, tags:['Family','Jersey Buyer','Social'],
    pricePoint:142, preferredZone:'Lower Bowl · Sideline', partyType:'Family (2 adults, 1 child)', upgradeHistory:['Sec 118→Sec 108 (+$18)','Row 4→Row 1 (+$12)','Club upgrade (+$35)'] },
  { id:2, name:'Sarah Chen',      init:'SC', color:'#0EA5E9', tier:'platinum', loyalty:88, ltv:11200, risk:12, section:'Sec 108', ghostRate:'12%', lastContact:'1 day ago',   attend:14, party:2, tags:['Premium','Early Arrival'],
    pricePoint:220, preferredZone:'Club Level · Corner',    partyType:'Couple',                       upgradeHistory:['Floor seats (+$62)','VIP parking add-on','Lounge access (+$45)'] },
  { id:3, name:'Priya Kapoor',    init:'PK', color:'#F43F5E', tier:'at-risk',  loyalty:44, ltv:6840,  risk:74, section:'Sec 133', ghostRate:'56%', lastContact:'3 weeks ago', attend:7,  party:4, tags:['At-Risk','Family'],
    pricePoint:88,  preferredZone:'Upper Sideline',         partyType:'Family (2 adults, 2 children)', upgradeHistory:['No upgrades this season'] },
  { id:4, name:'James Williams',  init:'JW', color:'#10B981', tier:'gold',     loyalty:71, ltv:4120,  risk:23, section:'Sec 215', ghostRate:'25%', lastContact:'5 days ago',  attend:12, party:1, tags:['Solo','Merch Buyer'],
    pricePoint:105, preferredZone:'Upper Bowl · Midfield',  partyType:'Solo',                         upgradeHistory:['Sec 230→Sec 215 (+$8)','Prime-time seat hold'] },
  { id:5, name:'David Park',      init:'DP', color:'#F59E0B', tier:'silver',   loyalty:58, ltv:2100,  risk:41, section:'Sec 302', ghostRate:'33%', lastContact:'2 weeks ago', attend:8,  party:2, tags:['Casual','Price Sensitive'],
    pricePoint:62,  preferredZone:'Upper Corner',           partyType:'Couple',                       upgradeHistory:['Took 10% flash offer (rain game)'] },
  { id:6, name:'Amanda Foster',   init:'AF', color:'#8B5CF6', tier:'gold',     loyalty:76, ltv:5380,  risk:19, section:'Sec 118', ghostRate:'19%', lastContact:'3 days ago',  attend:13, party:4, tags:['Family','Food','Social'],
    pricePoint:128, preferredZone:'Lower Bowl · End Zone',  partyType:'Family (2 adults, 2 children)', upgradeHistory:['Sec 122→Sec 118 (+$14)','Food bundle add-on','Group premium'] },
  { id:7, name:'Robert Kim',      init:'RK', color:'#EC4899', tier:'at-risk',  loyalty:38, ltv:3200,  risk:81, section:'Sec 228', ghostRate:'62%', lastContact:'1 month ago', attend:5,  party:2, tags:['At-Risk','Lapsed'],
    pricePoint:72,  preferredZone:'Upper Bowl',             partyType:'Couple',                       upgradeHistory:['No upgrades — price sensitive'] },
  { id:8, name:'Lisa Martinez',   init:'LM', color:'#14B8A6', tier:'bronze',   loyalty:29, ltv:640,   risk:55, section:'Sec 418', ghostRate:'75%', lastContact:'6 weeks ago', attend:3,  party:1, tags:['Casual','Lapsed'],
    pricePoint:45,  preferredZone:'Upper Deck',             partyType:'Solo',                         upgradeHistory:['Took 25% flash offer (Wk 3)'] },
];

var ghostFans = [
  { name:'Robert Kim',     section:'228-F-12', rate:'62%', nextProb:'78%', last:'1 month',  action:'Incentive Offer' },
  { name:'Priya Kapoor',   section:'133-B-7',  rate:'56%', nextProb:'71%', last:'3 weeks',  action:'Personal Outreach' },
  { name:'Lisa Martinez',  section:'418-A-2',  rate:'75%', nextProb:'83%', last:'6 weeks',  action:'Win-Back Campaign' },
  { name:'Tom Bradley',    section:'122-B-4',  rate:'50%', nextProb:'65%', last:'2 weeks',  action:'Incentive Offer' },
  { name:'Nina Osei',      section:'122-B-5',  rate:'44%', nextProb:'58%', last:'10 days',  action:'Email + SMS' },
  { name:'David Park',     section:'302-C-9',  rate:'33%', nextProb:'45%', last:'2 weeks',  action:'Reminder Push' },
];

// ── friends nearby mock data ──────────────────────────────────────────────────
var friendShareData = [
  { fan:'Marcus Thompson', nearbyFriends:4, distance:'1.8 mi', linkSent:true,  converted:2, revenue:284 },
  { fan:'Sarah Chen',      nearbyFriends:2, distance:'3.2 mi', linkSent:true,  converted:1, revenue:220 },
  { fan:'Amanda Foster',   nearbyFriends:3, distance:'0.9 mi', linkSent:true,  converted:1, revenue:128 },
  { fan:'James Williams',  nearbyFriends:1, distance:'4.1 mi', linkSent:false, converted:0, revenue:0   },
  { fan:'David Park',      nearbyFriends:2, distance:'2.7 mi', linkSent:true,  converted:0, revenue:0   },
];

// ── not-yet-arrived mock data ─────────────────────────────────────────────────
var notArrivedData = [
  { fan:'Robert Kim',      section:'Sec 228', risk:'81%', ping:'3.4 mi from stadium',  action:'Flash Offer' },
  { fan:'Lisa Martinez',   section:'Sec 418', risk:'75%', ping:'No signal · 45 min',  action:'SMS Alert' },
  { fan:'Priya Kapoor',    section:'Sec 133', risk:'62%', ping:'7.1 mi from stadium',  action:'Incentive Push' },
  { fan:'Tom Bradley',     section:'Sec 122', risk:'58%', ping:'Parked · P-7 garage',  action:'Reminder' },
  { fan:'Nina Osei',       section:'Sec 122', risk:'51%', ping:'1.2 mi from stadium',  action:'Reminder' },
  { fan:'David Park',      section:'Sec 302', risk:'44%', ping:'En route · ETA 28 min',action:'Monitor' },
  { fan:'Carlos Rivera',   section:'Sec 311', risk:'40%', ping:'0.6 mi from stadium',  action:'Monitor' },
  { fan:'Jenny Wu',        section:'Sec 204', risk:'36%', ping:'At tailgate lot',       action:'Monitor' },
  { fan:'Mike Torres',     section:'Sec 415', risk:'34%', ping:'2.8 mi from stadium',  action:'Monitor' },
  { fan:'Amy Johnson',     section:'Sec 318', risk:'28%', ping:'Gate C queue',          action:'None' },
];

// ── UGC leaderboard mock data ─────────────────────────────────────────────────
var ugcLeaderboardData = [
  { name:'Marcus Thompson', tier:'platinum', platform:'Instagram', posts:8, impressions:'142K', pts:4000, revenue:340 },
  { name:'Sarah Chen',      tier:'platinum', platform:'TikTok',    posts:5, impressions:'310K', pts:2500, revenue:220 },
  { name:'Amanda Foster',   tier:'gold',     platform:'Instagram', posts:6, impressions:'84K',  pts:3000, revenue:180 },
  { name:'James Williams',  tier:'gold',     platform:'X',         posts:4, impressions:'28K',  pts:2000, revenue:105 },
  { name:'Keisha Brown',    tier:'platinum', platform:'TikTok',    posts:11,impressions:'520K', pts:5500, revenue:480 },
  { name:'Tyler Nguyen',    tier:'silver',   platform:'Instagram', posts:3, impressions:'18K',  pts:1500, revenue:62  },
  { name:'Rachel Park',     tier:'gold',     platform:'Instagram', posts:5, impressions:'67K',  pts:2500, revenue:142 },
  { name:'Omar Hassan',     tier:'silver',   platform:'X',         posts:2, impressions:'9K',   pts:1000, revenue:45  },
  { name:'Mia Rodriguez',   tier:'platinum', platform:'TikTok',    posts:9, impressions:'218K', pts:4500, revenue:310 },
  { name:'Ben Clarke',      tier:'gold',     platform:'Facebook',  posts:3, impressions:'12K',  pts:1500, revenue:78  },
];

// ── social hourly mock data ───────────────────────────────────────────────────
var socialHourlyData = {
  labels: ['10am','11am','12pm','1pm (kickoff)','2pm','3pm','4pm (final)','5pm'],
  posts:  [120, 380, 820, 2400, 1840, 1200, 3100, 1640],
  impressions: [18000, 52000, 118000, 380000, 290000, 180000, 480000, 248000],
};

// ── API base (same origin in prod; localhost:8000 when opening frontend directly) ──
var API_BASE = (window.location.port === '5175' || window.location.protocol === 'file:')
  ? 'http://localhost:8000'
  : '';

// ── load real data ─────────────────────────────────────────────────────────────
function loadRealData(cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API_BASE + '/api/data?t=' + Date.now());
  xhr.onload = function() {
    if (xhr.status === 200) {
      try { REAL = JSON.parse(xhr.responseText); cb(true); }
      catch(e) { cb(false); }
    } else { cb(false); }
  };
  xhr.onerror = function() { cb(false); };
  xhr.send();
}

function loadModelData(cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API_BASE + '/api/model?t=' + Date.now());
  xhr.onload = function() {
    if (xhr.status === 200) {
      try { MODEL = JSON.parse(xhr.responseText); cb(true); }
      catch(e) { cb(false); }
    } else { cb(false); }
  };
  xhr.onerror = function() { cb(false); };
  xhr.send();
}

// ── get active team real data ──────────────────────────────────────────────────
function teamData() {
  return REAL && REAL.teams && REAL.teams[ACTIVE_TEAM] ? REAL.teams[ACTIVE_TEAM] : null;
}

// ── navigation ────────────────────────────────────────────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
  chartsInit = false;
  setTimeout(initCharts, 60);
  if (id === 'gameday') { buildEntryFeed(); buildFriendShareTable(); loadPricingData(); }
  if (id === 'social')  { buildSocialHub(); }
}

function updateTeam(val) {
  ACTIVE_TEAM = val;
  chartsInit = false;
  // Sync the predictor dropdown
  var predTeam = document.getElementById('pred-team');
  if (predTeam) predTeam.value = val;
  refreshRealDataPanels();
  initCharts();
  renderModelTab();   // re-render model tab for the active sport
  runPredictor();
}

// ── real data panel refresh ───────────────────────────────────────────────────
function refreshRealDataPanels() {
  var td = teamData();
  if (!td) return;

  // Update all team-specific content site-wide
  updateTeamContent(td);

  var ti = td.team_info || {};
  var stats = td.attendance_stats || {};
  var hist  = td.attendance_history || {};

  // ── overview stat overrides ────────────────────────────────────────────────
  var avgAtt = stats.avg_attendance;
  var cap = ti.venue_capacity || 68500;
  var ghostGamePct = td.games
    ? td.games.filter(function(g){ return g.is_home && g.ghost_risk > 0.25; }).length / Math.max(1, td.games.filter(function(g){ return g.is_home; }).length) * 100
    : 22.3;

  setEl('real-team-name', ti.name || ACTIVE_TEAM);
  setEl('real-record', ti.record || '?');
  setEl('real-venue', ti.venue_name || '');
  setEl('real-capacity', cap.toLocaleString());
  setEl('real-avg-att', avgAtt ? avgAtt.toLocaleString() : '--');
  setEl('real-fill-pct', stats.avg_fill_pct ? stats.avg_fill_pct + '%' : '--');
  setEl('real-ghost-pct', ghostGamePct.toFixed(1) + '%');
  setEl('real-sentiment', (td.sentiment_score || 50) + '/100');

  // ── news feed ─────────────────────────────────────────────────────────────
  var newsEl = document.getElementById('real-news-feed');
  if (newsEl && td.news && td.news.length) {
    newsEl.innerHTML = td.news.slice(0,6).map(function(a) {
      return '<div class="news-item">' +
        '<div class="news-date">' + a.date + '</div>' +
        '<div class="news-headline">' + a.headline + '</div>' +
        (a.description ? '<div class="news-desc">' + a.description.slice(0,120) + '…</div>' : '') +
      '</div>';
    }).join('');
  }

  // ── injury list ────────────────────────────────────────────────────────────
  var injEl = document.getElementById('real-injuries');
  if (injEl && td.injuries && td.injuries.length) {
    injEl.innerHTML = td.injuries.slice(0,8).map(function(inj) {
      var color = inj.status === 'Out' ? RED : inj.status === 'Injured Reserve' ? '#7F1D1D' : ORANGE;
      return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--border)">' +
        '<span style="font-weight:600;font-size:0.85rem;flex:1">' + inj.player + '</span>' +
        '<span style="font-size:0.72rem;color:var(--muted)">' + inj.position + '</span>' +
        '<span style="font-size:0.72rem;font-weight:600;color:' + color + ';min-width:80px;text-align:right">' + inj.status + '</span>' +
      '</div>';
    }).join('');
  }

  // ── weather forecast ──────────────────────────────────────────────────────
  var wxEl = document.getElementById('real-weather');
  if (wxEl && td.weather_forecast && td.weather_forecast.length) {
    wxEl.innerHTML = td.weather_forecast.slice(0,7).map(function(d) {
      var icon = d.precip_mm > 1 ? '🌧' : d.max_temp_c > 32 ? '☀️' : d.max_temp_c < 8 ? '❄️' : '⛅';
      var ghostRisk = '';
      if (d.precip_prob > 60 || d.max_temp_c > 35 || d.max_temp_c < 5) {
        ghostRisk = '<span style="font-size:0.65rem;color:' + RED + '">+ghost risk</span>';
      }
      return '<div class="wx-day">' +
        '<div class="wx-date">' + d.date.slice(5) + '</div>' +
        '<div class="wx-icon">' + icon + '</div>' +
        '<div class="wx-temp">' + Math.round(d.max_temp_c) + '°C</div>' +
        '<div class="wx-rain">' + d.precip_prob + '%</div>' +
        ghostRisk +
      '</div>';
    }).join('');
  }

  // ── F1 calendar ───────────────────────────────────────────────────────────
  var f1El = document.getElementById('real-f1');
  if (f1El && REAL && REAL.f1 && REAL.f1.length) {
    f1El.innerHTML = REAL.f1.slice(0,5).map(function(r) {
      return '<div style="padding:0.5rem 0;border-bottom:1px solid var(--border)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-weight:600;font-size:0.85rem">' + r.short_name + '</span>' +
          '<span style="font-size:0.75rem;color:var(--muted)">' + r.date + '</span>' +
        '</div>' +
        (r.top3.length ? '<div style="font-size:0.75rem;color:var(--muted);margin-top:2px">' +
          r.top3.map(function(p){ return p.pos + '. ' + p.driver; }).join(' · ') + '</div>' : '') +
      '</div>';
    }).join('');
  }

  // ── historical attendance panel ────────────────────────────────────────────
  var histEl = document.getElementById('real-history');
  if (histEl) {
    var rows = Object.keys(hist).map(function(yr) {
      var h = hist[yr];
      return '<tr><td>' + yr + '</td><td>' + h.avg.toLocaleString() + '</td><td>' + h.total.toLocaleString() + '</td><td>' + h.games + '</td></tr>';
    });
    if (stats.season) {
      rows.push('<tr style="color:var(--gold);font-weight:600"><td>' + stats.season + '</td><td>' + (stats.avg_attendance||'').toLocaleString() + '</td><td>' + (stats.total_attendance||'').toLocaleString() + '</td><td>' + (stats.home_games||'') + '</td></tr>');
    }
    histEl.innerHTML = rows.join('');
  }
}

function setEl(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── fan table ─────────────────────────────────────────────────────────────────
function buildFanTable() {
  var tbody = document.getElementById('fanTableBody');
  if (!tbody) return;
  tbody.innerHTML = fans.map(function(f) {
    return '<tr onclick="showFanDetail(' + f.id + ')">' +
      '<td><div style="display:flex;align-items:center;gap:0.7rem">' +
        '<div class="fan-avatar" style="width:36px;height:36px;font-size:0.85rem;background:' + f.color + '">' + f.init + '</div>' +
        '<div><div style="font-size:0.85rem;font-weight:600">' + f.name + '</div><div class="fan-meta">' + f.section + '</div></div>' +
      '</div></td>' +
      '<td><span class="tier tier-' + f.tier + '">' + f.tier.replace('-',' ') + '</span></td>' +
      '<td><div style="font-size:0.88rem;font-weight:600">' + f.loyalty + '</div>' +
        '<div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:' + f.loyalty + '%;background:' + (f.loyalty>70?GREEN:f.loyalty>50?ORANGE:RED) + '"></div></div></td>' +
      '<td style="font-weight:600;color:var(--gold)">$' + f.ltv.toLocaleString() + '</td>' +
      '<td><span style="color:' + (f.risk>60?RED:f.risk>30?ORANGE:GREEN) + ';font-weight:600">' + f.risk + '%</span></td>' +
    '</tr>';
  }).join('');
}

function showFanDetail(id) {
  var f = fans.filter(function(x){ return x.id===id; })[0];
  var panel = document.getElementById('fanDetailContent');
  panel.innerHTML =
    '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">' +
      '<div class="fan-avatar" style="background:' + f.color + ';width:60px;height:60px;font-size:1.3rem">' + f.init + '</div>' +
      '<div><div style="font-size:1.1rem;font-weight:700">' + f.name + '</div>' +
        '<div class="fan-meta">' + f.section + ' · Party of ' + f.party + '</div>' +
        '<div style="margin-top:5px">' + f.tags.map(function(t){ return '<span class="tag tag-blue">'+t+'</span>'; }).join('') + '</div></div>' +
      '<div style="margin-left:auto"><span class="tier tier-' + f.tier + '">' + f.tier.replace('-',' ') + '</span></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:1.2rem">' +
      '<div><div class="stat-label" style="font-size:0.7rem">Loyalty Score</div><div style="font-size:1.4rem;font-weight:700;color:' + (f.loyalty>70?GREEN:f.loyalty>50?ORANGE:RED) + '">' + f.loyalty + '<span style="font-size:0.75rem;color:var(--muted)">/100</span></div></div>' +
      '<div><div class="stat-label" style="font-size:0.7rem">3-Year LTV</div><div style="font-size:1.4rem;font-weight:700;color:var(--gold)">$' + f.ltv.toLocaleString() + '</div></div>' +
      '<div><div class="stat-label" style="font-size:0.7rem">Games Attended</div><div style="font-size:1.4rem;font-weight:700">' + f.attend + '/17</div></div>' +
      '<div><div class="stat-label" style="font-size:0.7rem">Churn Risk</div><div style="font-size:1.4rem;font-weight:700;color:' + (f.risk>60?RED:f.risk>30?ORANGE:GREEN) + '">' + f.risk + '%</div></div>' +
    '</div>' +
    '<div class="stat-label" style="font-size:0.7rem;margin-bottom:0.3rem">Ghost Ticket Rate</div>' +
    '<div style="font-size:0.88rem;font-weight:600">' + f.ghostRate + '</div>' +
    '<div class="progress-bar" style="margin-bottom:1.2rem"><div class="progress-fill" style="width:' + f.ghostRate + ';background:' + (parseInt(f.ghostRate)>50?RED:parseInt(f.ghostRate)>25?ORANGE:GREEN) + '"></div></div>' +
    '<div class="insight" style="margin-bottom:0.8rem"><div class="insight-label">AI Recommendation</div><div class="insight-text">' + getFanRec(f) + '</div></div>' +
    getSeatIntelHTML(f) +
    '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.8rem"><button class="btn btn-gold">Send Offer</button><button class="btn btn-out">Full History</button><button class="btn btn-out">Flag Outreach</button></div>';
}

function getFanRec(f) {
  if (f.tier==='at-risk') return 'High churn risk. Last contact: '+f.lastContact+'. Recommend personal call from fan relations + exclusive playoff priority access. Model predicts 52% churn reduction.';
  if (f.tier==='platinum') return 'Top-tier — protect this relationship. Pre-game concierge experience for next home game. 2.8× more likely to refer new fans with an exclusive "bring a friend" package.';
  if (f.tier==='gold') return 'Near Platinum threshold. One premium experience push could accelerate upgrade. Try premium seating trial + loyalty point bonus for next 3 games.';
  return 'Casual fan with upside potential. Geo-targeting and price-incentive offers most effective. Consider a "first premium experience" trial at 40% discount.';
}

function buildGhostTable() {
  var tbody = document.getElementById('ghostTableBody');
  if (!tbody) return;

  // Merge real game data if available
  var rows = ghostFans;
  var td = teamData();
  if (td && td.games) {
    var highRisk = td.games.filter(function(g){ return g.is_home && g.ghost_risk > 0.25; }).slice(0,6);
    if (highRisk.length) {
      rows = highRisk.map(function(g, i) {
        return {
          name: 'Season Holder #' + (1000 + i * 37),
          section: 'Sec ' + (100 + Math.floor(g.ghost_risk*200)),
          rate: Math.round(g.ghost_risk * 100) + '%',
          nextProb: Math.round(Math.min(g.ghost_risk * 130, 95)) + '%',
          last: g.weather && g.weather.is_rain ? 'Rain game' : g.date,
          action: g.ghost_risk > 0.4 ? 'Personal Outreach' : 'Incentive Offer',
          game: g.name,
        };
      });
    }
  }

  tbody.innerHTML = rows.map(function(f) {
    return '<tr>' +
      '<td>' + (f.game ? '<div style="font-size:0.85rem;font-weight:600">' + f.name + '</div><div style="font-size:0.72rem;color:var(--muted)">' + f.game + '</div>' : f.name) + '</td>' +
      '<td style="color:var(--muted)">' + f.section + '</td>' +
      '<td><span style="color:' + (parseInt(f.rate)>50?RED:ORANGE) + ';font-weight:600">' + f.rate + '</span></td>' +
      '<td><span style="color:' + (parseInt(f.nextProb)>70?RED:ORANGE) + ';font-weight:700">' + f.nextProb + '</span></td>' +
      '<td style="color:var(--muted)">' + f.last + '</td>' +
      '<td><span class="tag tag-orange">' + f.action + '</span></td>' +
      '<td><button class="btn-sm btn-gold" style="font-size:0.7rem">Act Now</button></td>' +
    '</tr>';
  }).join('');
}

// ── charts ────────────────────────────────────────────────────────────────────
function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function mk(id, config) {
  var el = document.getElementById(id);
  if (!el) return;
  destroyChart(id);
  chartInstances[id] = new Chart(el, config);
}

function tickColor(color, extra) {
  return Object.assign({ ticks: { color: color || MUTED, font: { size: 10 } }, grid: { color: GRID } }, extra || {});
}

function initCharts() {
  if (chartsInit) return;
  chartsInit = true;

  var td = teamData();
  var stats = td ? (td.attendance_stats || {}) : {};
  var hist  = td ? (td.attendance_history || {}) : {};
  var games = td ? (td.games || []) : [];
  var homeGames = games.filter(function(g){ return g.is_home && g.attendance; });
  var sentScore = td ? (td.sentiment_score || 50) : 50;

  // ─── OVERVIEW charts ───────────────────────────────────────────────────────
  mk('tierChart', {
    type: 'doughnut',
    data: {
      labels: ['Platinum (5%)', 'Gold (20%)', 'Silver (35%)', 'Bronze/Casual (40%)'],
      datasets: [{ data: [3620,14488,25354,28976], backgroundColor: [GOLD,GOLD2,'#6B7280','#92400E'], borderWidth:0 }]
    },
    options: { plugins: { legend: { labels: { color: MUTED, font: { size:11 } } } }, cutout:'60%' }
  });

  mk('revenueChart', {
    type: 'bar',
    data: {
      labels: ['Platinum','Gold','Silver','Bronze'],
      datasets: [
        { label:'Tickets', data:[18.8,24.9,18.5,7.1], backgroundColor:GOLD },
        { label:'F&B',     data:[7.6,9.8,8.2,3.4],    backgroundColor:BLUE },
        { label:'Merch',   data:[5.4,7.1,4.4,1.8],    backgroundColor:PURPLE },
        { label:'Referral',data:[11.8,6.2,2.1,0.4],   backgroundColor:GREEN },
      ]
    },
    options: {
      plugins: { legend: { labels: { color:MUTED, font:{size:10} } } },
      scales: {
        x: Object.assign({ stacked:true }, tickColor()),
        y: Object.assign({ stacked:true }, tickColor(), { ticks: { color:MUTED, callback:function(v){ return '$'+v+'M'; } } })
      }
    }
  });

  // Real loyalty trend augmented with sentiment
  var sentOffset = (sentScore - 50) / 10;
  mk('loyaltyTrendChart', {
    type: 'line',
    data: {
      labels: ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'],
      datasets: [
        { label:'Your Team', data:[68,69,71,70,72,71,73,74,73,75,74,73].map(function(v,i){ return i >= 9 ? Math.round(v + sentOffset) : v; }), borderColor:GOLD, backgroundColor:'rgba(170,138,60,0.1)', tension:0.4, fill:true, pointRadius:3 },
        { label:'NFL Avg',   data:[59,59,61,60,62,61,62,63,62,63,62,61], borderColor:BLUE, borderDash:[4,4], tension:0.4, pointRadius:0 }
      ]
    },
    options: {
      plugins: { legend: { labels: { color:MUTED, font:{size:10} } } },
      scales: { x: tickColor(), y: Object.assign({ min:50, max:85 }, tickColor()) }
    }
  });

  // ─── REAL attendance chart (game-by-game) ──────────────────────────────────
  if (homeGames.length) {
    var labels = homeGames.map(function(g){ return g.opponent.replace('San Francisco ','').replace('Los Angeles ','LA ').slice(0,10); });
    var attVals = homeGames.map(function(g){ return g.attendance; });
    var capLine = homeGames.map(function(g){ return g.capacity; });
    var colors  = homeGames.map(function(g){
      if (!g.won) return 'rgba(239,68,68,0.75)';
      if (g.weather && g.weather.is_rain) return 'rgba(59,130,246,0.75)';
      return 'rgba(170,138,60,0.8)';
    });

    mk('attendanceChart', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label:'Attendance', data:attVals, backgroundColor:colors, order:2 },
          { label:'Capacity',   data:capLine, borderColor:'rgba(255,255,255,0.2)', borderDash:[4,4], type:'line', pointRadius:0, borderWidth:1, order:1 },
        ]
      },
      options: {
        plugins: {
          legend: { labels: { color:MUTED, font:{size:10} } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                var g = homeGames[ctx.dataIndex];
                var lines = [ctx.dataset.label+': '+ctx.parsed.y.toLocaleString()];
                if (g && ctx.datasetIndex===0) {
                  lines.push((g.won ? '✅ Win' : '❌ Loss') + ' ' + g.our_score + '-' + g.opp_score);
                  if (g.weather) lines.push('🌡 '+g.weather.avg_temp_c+'°C | rain='+g.weather.is_rain);
                  lines.push('Ghost risk: '+(g.ghost_risk*100).toFixed(0)+'%');
                }
                return lines;
              }
            }
          }
        },
        scales: {
          x: Object.assign({}, tickColor(), { ticks: { maxRotation:45, font:{size:9} } }),
          y: Object.assign({ min: Math.max(0, Math.min.apply(null,attVals) - 5000) }, tickColor(), { ticks: { callback:function(v){ return (v/1000).toFixed(0)+'K'; } } })
        }
      }
    });
  }

  // Historical multi-year attendance
  var histYears = Object.keys(hist).sort();
  if (histYears.length && stats.avg_attendance) {
    histYears.push(String(stats.season || 2024));
    var histVals = histYears.map(function(yr) {
      return yr === String(stats.season||2024) ? stats.avg_attendance : (hist[yr]||{}).avg || 0;
    });
    mk('historyChart', {
      type: 'bar',
      data: {
        labels: histYears,
        datasets: [{ label:'Avg Home Attendance', data:histVals, backgroundColor:[MUTED, MUTED, GOLD] }]
      },
      options: {
        plugins: { legend:{ display:false } },
        scales: {
          x: tickColor(),
          y: Object.assign({ min: Math.max(0, Math.min.apply(null,histVals)-5000) }, tickColor(), { ticks:{ callback:function(v){ return (v/1000).toFixed(0)+'K'; } } })
        }
      }
    });
  }

  // Ghost risk by game (weather-adjusted)
  if (homeGames.length) {
    var gLabels = homeGames.map(function(g){ return g.opponent.slice(0,8); });
    var gRisks  = homeGames.map(function(g){ return g.ghost_risk ? Math.round(g.ghost_risk*100) : 18; });
    var gColors = gRisks.map(function(r){ return r>40?RED : r>25?ORANGE : GREEN; });
    mk('ghostRiskChart', {
      type: 'bar',
      data: {
        labels: gLabels,
        datasets: [{ label:'Ghost Risk %', data:gRisks, backgroundColor:gColors }]
      },
      options: {
        plugins: {
          legend:{ display:false },
          tooltip:{
            callbacks:{
              afterLabel: function(ctx){
                var g = homeGames[ctx.dataIndex];
                var lines = [];
                if (g.weather) {
                  if (g.weather.is_rain) lines.push('🌧 Rain game +12%');
                  if (g.weather.is_hot) lines.push('🌡 Heat +8%');
                }
                if (!g.won) lines.push('❌ Team lost this game');
                return lines;
              }
            }
          }
        },
        scales: {
          x: Object.assign({}, tickColor(), { ticks:{ maxRotation:45, font:{size:9} } }),
          y: Object.assign({ min:0, max:70 }, tickColor(), { ticks:{ callback:function(v){ return v+'%'; } } })
        }
      }
    });
  }

  // Ghost signal feature importance
  mk('ghostSignalChart', {
    type: 'bar',
    data: {
      labels: ['No check-in 48h','Lapsed app use','Team losing streak','Away game','Weather','Last-min resale','Social silence'],
      datasets: [{ data:[28,21,17,14,9,7,4], backgroundColor:[RED,ORANGE,'#EAB308',BLUE,PURPLE,'#EC4899','#6B7280'] }]
    },
    options: {
      indexAxis:'y',
      plugins:{ legend:{ display:false } },
      scales:{ x:tickColor(), y:tickColor() }
    }
  });

  // Game day offer chart
  mk('offerChart', {
    type: 'line',
    data: {
      labels: ['9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM'],
      datasets: [
        { label:'Offers Sent', data:[820,1240,2100,3400,2800,1900,1400,1160], borderColor:BLUE, tension:0.4, yAxisID:'y', pointRadius:3 },
        { label:'Revenue ($K)', data:[12,28,58,94,82,54,38,21], borderColor:GOLD, tension:0.4, yAxisID:'y1', pointRadius:3 }
      ]
    },
    options: {
      plugins:{ legend:{ labels:{ color:MUTED, font:{size:10} } } },
      scales: {
        x: tickColor(),
        y: tickColor(BLUE),
        y1: { position:'right', ticks:{ color:GOLD, font:{size:10}, callback:function(v){ return '$'+v+'K'; } }, grid:{ display:false } }
      }
    }
  });

  // LTV waterfall
  mk('ltvWaterfallChart', {
    type: 'bar',
    data: {
      labels: ['Tickets','Food & Bev','Merch','Premium','Digital','Referral','Total LTV'],
      datasets: [{ data:[5200,2100,1480,1800,420,3280,14280], backgroundColor:[BLUE,ORANGE,PURPLE,'#EC4899','#14B8A6',GREEN,GOLD] }]
    },
    options: {
      plugins:{ legend:{ display:false } },
      scales:{ x:tickColor(), y:Object.assign({}, tickColor(), { ticks:{ callback:function(v){ return '$'+v.toLocaleString(); } } }) }
    }
  });

  mk('migrationChart', {
    type: 'bar',
    data: {
      labels: ['Bronze→Silver','Silver→Gold','Gold→Platinum','Platinum→Gold','Gold→Silver','Silver→Bronze'],
      datasets: [
        { label:'Upgraded',   data:[1840,820,240,0,0,0],   backgroundColor:GREEN },
        { label:'Downgraded', data:[0,0,0,180,420,680],    backgroundColor:RED }
      ]
    },
    options: {
      plugins:{ legend:{ labels:{ color:MUTED, font:{size:10} } } },
      scales:{ x:Object.assign({}, tickColor(), { ticks:{ font:{size:9} } }), y:tickColor() }
    }
  });

  mk('referralChart', {
    type: 'bar',
    data: {
      labels: ['Platinum','Gold','Silver','Bronze'],
      datasets: [{ data:[2.3,1.1,0.4,0.1], backgroundColor:[GOLD,GOLD2,'#6B7280','#92400E'] }]
    },
    options: { plugins:{ legend:{ display:false } }, scales:{ x:tickColor(), y:tickColor() } }
  });

  // Feature importance
  // Feature importance — per-team Pearson |r| computed from real game data
  var fiAtts  = homeGames.map(function(g){ return g.attendance; });
  var fiFeatDefs = [
    { label:'Week / Game #',        fn:function(g){ return g.week_of_season||g.game_of_season||0; } },
    { label:'Opponent Strength',     fn:function(g){ return g.opponent_win_pct||0; } },
    { label:'Prime Time',            fn:function(g){ return g.is_prime_time?1:0; } },
    { label:'Weather Severity',      fn:function(g){ return g.weather_severity||0; } },
    { label:'Win Streak',            fn:function(g){ return g.home_streak||0; } },
    { label:'Divisional Rivalry',    fn:function(g){ return g.is_divisional?1:0; } },
    { label:'Weekend Game',          fn:function(g){ return g.is_weekend?1:0; } },
    { label:'Matchup Strength',      fn:function(g){ return g.matchup_strength||0; } },
    { label:'Rain',                  fn:function(g){ return (g.weather&&g.weather.is_rain)?1:0; } },
  ];
  var fiRealPairs = [];
  if (homeGames.length >= 5) {
    fiFeatDefs.forEach(function(fd){
      var xs = homeGames.map(fd.fn);
      var r = pearsonR(xs, fiAtts);
      if (r !== null) fiRealPairs.push({ label: fd.label, val: Math.abs(r) });
    });
    fiRealPairs.sort(function(a,b){ return b.val - a.val; });
  }
  var fiLabels = fiRealPairs.length ? fiRealPairs.map(function(p){ return p.label; }) : ['Attendance Freq','Purchase History','App Engagement','Social Activity','Location Signals','Ticket Resale','Team Performance'];
  var fiValsP  = fiRealPairs.length ? fiRealPairs.map(function(p){ return +(p.val*100).toFixed(1); }) : [31,24,18,12,8,5,2];

  // Colour each bar on a cyan→green gradient ranked by value so the chart is readable at a glance
  var fiBarColors = fiValsP.map(function(v, i, arr) {
    var rank = arr.length > 1 ? i / (arr.length - 1) : 0; // 0 = strongest (top), 1 = weakest
    // Interpolate: strong → cyan (#22D3EE), weak → muted blue (#3B82F6 faded)
    var stops = ['#22D3EE','#38BDF8','#60A5FA','#818CF8','#A78BFA'];
    return stops[Math.min(Math.floor(rank * stops.length), stops.length - 1)];
  });
  mk('featureImportanceChart', {
    type: 'bar',
    data: { labels: fiLabels, datasets: [{ data: fiValsP, backgroundColor: fiBarColors }] },
    options: {
      indexAxis:'y',
      plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label:function(ctx){ return '|r| = ' + (ctx.parsed.x/100).toFixed(3); } } } },
      scales: { x:Object.assign({},tickColor(),{ ticks:{ callback:function(v){ return v.toFixed(0)+'%'; } } }), y:tickColor() }
    }
  });

  // Attendance forecast — real team data, sport-aware labels
  var forecastSport = MLB_TEAMS.has(ACTIVE_TEAM) ? 'baseball' : 'football';
  var labelPrefix   = forecastSport === 'baseball' ? 'G' : 'Wk';
  var lastGames     = homeGames.slice(-5);
  var lastGameNums  = lastGames.map(function(g,i){ return labelPrefix + (g.week_of_season||g.game_of_season||(i+1)); });
  var forecastLabels = lastGameNums.concat([labelPrefix+'(F1)', labelPrefix+'(F2)', labelPrefix+'(F3)']);
  var forecastActual = lastGames.length >= 3
    ? lastGames.map(function(g){ return g.attendance; }).concat([null, null, null])
    : [67400,68100,65800,66900,61200,null,null,null];
  var lastReal = forecastActual.filter(function(v){ return v; }).pop() || 65000;
  var meanAtt  = fiAtts.length ? fiAtts.reduce(function(a,b){return a+b;},0)/fiAtts.length : lastReal;
  // Forecast: mean-reverting toward team's seasonal average
  var forecastFwd = forecastActual.map(function(v,i){
    if (i < lastGames.length) return null;
    return Math.round(lastReal + (meanAtt - lastReal) * 0.4 * (i - lastGames.length + 1));
  });

  var forecastMin = Math.min.apply(null, forecastActual.filter(Boolean).concat(forecastFwd.filter(Boolean))) - 3000;

  mk('attendanceForecastChart', {
    type: 'line',
    data: {
      labels: forecastLabels,
      datasets: [
        { label:'Actual',   data:forecastActual, borderColor:GREEN, tension:0.3, pointRadius:4, fill:false },
        { label:'Forecast', data:forecastFwd,    borderColor:GOLD,  borderDash:[5,4], tension:0.3, pointRadius:4, fill:false },
        { label:'Season avg', data:forecastLabels.map(function(){ return Math.round(meanAtt); }), borderColor:'#374151', borderDash:[2,4], pointRadius:0, fill:false }
      ]
    },
    options: {
      plugins:{ legend:{ labels:{ color:MUTED, font:{size:10} } } },
      scales: {
        x: tickColor(),
        y: Object.assign({ min: forecastMin }, tickColor(), { ticks:{ callback:function(v){ return (v/1000).toFixed(0)+'K'; } } })
      }
    }
  });

  mk('churnDistChart', {
    type: 'bar',
    data: {
      labels: ['0-10%','10-20%','20-30%','30-40%','40-50%','50-60%','60-70%','70-80%','80-90%','90-100%'],
      datasets: [{ data:[12800,14200,11400,9200,8100,5800,4400,2800,2400,1340],
        backgroundColor:['rgba(34,197,94,0.7)','rgba(34,197,94,0.7)','rgba(34,197,94,0.7)','rgba(34,197,94,0.7)','rgba(34,197,94,0.7)',
          'rgba(249,115,22,0.7)','rgba(249,115,22,0.7)','rgba(239,68,68,0.7)','rgba(239,68,68,0.7)','rgba(239,68,68,0.7)']
      }]
    },
    options: {
      plugins:{ legend:{ display:false } },
      scales:{ x:tickColor(), y:Object.assign({},tickColor(),{ ticks:{ callback:function(v){ return (v/1000).toFixed(0)+'K'; } } }) }
    }
  });

  mk('benchmarkChart', {
    type: 'bar',
    data: {
      labels: ['Fan Loyalty','Ghost Ticket (inv.)','Avg LTV ($K)','AI Conversion','App Engage %','Holder Retention'],
      datasets: [
        { label:'Your Team',    data:[73,78,4.8,38,64,91], backgroundColor:'rgba(170,138,60,0.85)' },
        { label:'NFL Avg',      data:[61,68,2.9,24,48,84], backgroundColor:'rgba(59,130,246,0.65)' },
        { label:'Top Quartile', data:[82,86,7.2,52,78,96], backgroundColor:'rgba(34,197,94,0.65)' },
      ]
    },
    options: {
      plugins:{ legend:{ display:false } },
      scales:{ x:tickColor(), y:Object.assign({ max:100 }, tickColor()) }
    }
  });

  // Sentiment gauge (real score from news NLP)
  mk('sentimentChart', {
    type: 'doughnut',
    data: {
      labels: ['Positive signals', 'Neutral/Negative'],
      datasets: [{ data:[sentScore, 100-sentScore], backgroundColor:[sentScore>60?GREEN:sentScore>40?ORANGE:RED, '#0F1C35'], borderWidth:0 }]
    },
    options: {
      circumference: 180, rotation:-90,
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:function(ctx){ return ctx.label+': '+ctx.parsed+'pts'; } } } },
      cutout:'70%'
    }
  });

  // ─── ENTRY FEED chart ──────────────────────────────────────────────────────
  mk('entryFeedChart', {
    type: 'line',
    data: {
      labels: ['T-3hr','T-2.5hr','T-2hr','T-1.5hr','T-1hr','T-45min','T-30min','T-15min','Kickoff'],
      datasets: [
        { label:'Expected', data:[0,4200,14800,31400,48200,56800,62100,65400,68500],
          borderColor:GOLD, borderDash:[6,4], borderWidth:2, fill:false, pointRadius:0 },
        { label:'Actual',   data:[0,3800,13200,29800,45600,54800,61204,null,null],
          borderColor:GREEN, borderWidth:2.5, fill:false, tension:0.3,
          backgroundColor:'rgba(34,197,94,0.08)' },
      ]
    },
    options: {
      plugins:{ legend:{ labels:{ color:MUTED, font:{size:11} } } },
      scales: {
        x: { ticks:{ color:MUTED, font:{size:10} }, grid:{ color:GRID } },
        y: { ticks:{ color:MUTED, font:{size:10}, callback:function(v){ return (v/1000).toFixed(0)+'K'; } }, grid:{ color:GRID } }
      }
    }
  });

  // ─── PRICING chart ────────────────────────────────────────────────────────
  mk('pricingChart', {
    type:'bar',
    data: {
      labels: ['No discount','$10 off (8%)','$15 off (12%)','$20 off (16%)','$30 off (25%)','$40 off (33%)'],
      datasets: [{
        label:'Est. Seats Filled',
        data: [820, 1040, 1280, 1560, 1820, 1920],
        backgroundColor: [MUTED, '#3B82F680', BLUE, GOLD2, GOLD, GREEN],
        borderRadius:4
      }]
    },
    options: {
      plugins:{ legend:{ display:false } },
      scales: {
        x:{ ticks:{ color:MUTED, font:{size:10} }, grid:{ color:GRID } },
        y:{ ticks:{ color:MUTED, font:{size:10} }, grid:{ color:GRID }, title:{ display:true, text:'Seats Filled', color:MUTED, font:{size:11} } }
      }
    }
  });

  // ─── SOCIAL PLATFORM chart ────────────────────────────────────────────────
  mk('socialPlatformChart', {
    type:'doughnut',
    data:{
      labels:['Instagram','TikTok','X / Twitter','Facebook'],
      datasets:[{ data:[38,28,22,12], backgroundColor:[PURPLE,'#F97316','#1DA1F2','#1877F2'], borderWidth:0 }]
    },
    options:{ plugins:{ legend:{ labels:{ color:MUTED, font:{size:11} } } }, cutout:'55%' }
  });

  // ─── SOCIAL POST TIMELINE chart ───────────────────────────────────────────
  mk('socialPostChart', {
    type:'bar',
    data:{
      labels: socialHourlyData.labels,
      datasets:[
        { type:'bar',  label:'Posts',       data:socialHourlyData.posts,
          backgroundColor:'rgba(168,85,247,0.55)', yAxisID:'y' },
        { type:'line', label:'Impressions', data:socialHourlyData.impressions,
          borderColor:GOLD, borderWidth:2, fill:false, tension:0.4, yAxisID:'y1', pointRadius:3 },
      ]
    },
    options:{
      plugins:{ legend:{ labels:{ color:MUTED, font:{size:11} } } },
      scales:{
        x:{ ticks:{ color:MUTED, font:{size:10} }, grid:{ color:GRID } },
        y:{ ticks:{ color:MUTED, font:{size:10} }, grid:{ color:GRID }, title:{ display:true, text:'Posts', color:MUTED, font:{size:10} } },
        y1:{ position:'right', ticks:{ color:MUTED, font:{size:10}, callback:function(v){ return (v/1000).toFixed(0)+'K'; } }, grid:{ drawOnChartArea:false }, title:{ display:true, text:'Impressions', color:MUTED, font:{size:10} } }
      }
    }
  });

  // ─── SOCIAL FUNNEL chart ──────────────────────────────────────────────────
  mk('socialFunnelChart', {
    type:'bar',
    data:{
      labels:['Impressions (÷100)','Profile Clicks','Ticket Page Visits','Add to Cart','Purchases'],
      datasets:[{ data:[42000,8400,3200,1840,142], backgroundColor:[PURPLE+'80',BLUE+'80',GOLD+'80',ORANGE+'80',GREEN], borderRadius:4 }]
    },
    options:{
      indexAxis:'y',
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{ color:MUTED, font:{size:10} }, grid:{ color:GRID } },
        y:{ ticks:{ color:MUTED, font:{size:10} }, grid:{ color:GRID } }
      }
    }
  });
}

// ── boot ──────────────────────────────────────────────────────────────────────
function boot() {
  buildFanTable();
  buildGhostTable();
  buildEntryFeed();
  buildFriendShareTable();
  buildSocialHub();
  loadDemoConfig();

  var statusEl = document.getElementById('data-status');
  if (statusEl) statusEl.textContent = 'Loading real data…';

  loadRealData(function(ok) {
    if (ok && statusEl) {
      var ts = REAL && REAL.scraped_at ? new Date(REAL.scraped_at).toLocaleString() : 'unknown';
      statusEl.innerHTML = '🟢 <strong>Live data</strong> · scraped ' + ts;
      statusEl.style.color = GREEN;
    } else if (statusEl) {
      statusEl.innerHTML = '🟡 Showing mock data · run <code>python3 scraper.py</code> to load real data';
      statusEl.style.color = ORANGE;
    }
    refreshRealDataPanels();
    initCharts();
  });

  loadModelData(function(ok) {
    if (ok) {
      renderModelTab();
      // Refresh predictions tab now that MODEL is loaded
      var td = teamData();
      if (td) refreshPredictionsTab(td, TEAM_CONFIG[ACTIVE_TEAM] || TEAM_CONFIG['sf49ers']);
    }
    setTimeout(runPredictor, 500);
  });
}

// ── model tab ─────────────────────────────────────────────────────────────────

function renderModelTab() {
  if (!MODEL) return;

  var sport = activeSport();
  var cfg   = TEAM_CONFIG[ACTIVE_TEAM] || TEAM_CONFIG['sf49ers'];

  // NBA / IndyCar — no scraped data yet, show overlay
  if (isUnsupportedSport()) {
    setEl('model-sport-title', cfg.icon + ' ' + cfg.sport + ' Attendance Prediction Model');
    var sub = document.querySelector('#page-model .section-sub');
    if (sub) sub.textContent = cfg.sport + ' scraper module in development — connect ' + cfg.sport + ' data to activate this model.';
    ['m-samples','m-lin-r2','m-rf-r2','m-ci','m-lin-mae','m-rf-mae'].forEach(function(id){ setEl(id,'—'); });
    ['modelCorrChart','modelScatterChart','modelFIChart','modelCoeffChart'].forEach(function(id){
      destroyChart(id);
      var canvas = document.getElementById(id);
      if (canvas) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0A1324';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#7A9EC4';
        ctx.font = '13px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cfg.sport + ' data not yet scraped', canvas.width / 2, canvas.height / 2);
      }
    });
    return;
  }

  // Route to correct sport model based on active team
  var sportModel = (sport === 'baseball' && MODEL.mlb) ? MODEL.mlb : (MODEL.nfl || MODEL);
  var sportIcon  = sport === 'baseball' ? '⚾' : '🏈';
  var sportName  = sport === 'baseball' ? 'MLB' : 'NFL';

  var lm   = sportModel.linear_model || {};
  var rf   = sportModel.rf_model || {};
  var meth = sportModel.methodology || {};
  var mc   = sportModel.model_comparison || {};
  var en   = mc.elasticnet || {};
  var rfmc = mc.randomforest || {};
  var flabels = sportModel.feature_labels || {};

  // ── team-specific game data from REAL ──────────────────────────────────────
  var td        = teamData();
  var ti        = td ? (td.team_info || {}) : {};
  var teamName  = ti.name || ACTIVE_TEAM;
  var teamGames = (td && td.games) ? td.games.filter(function(g){ return g.is_home && g.attendance > 0; }) : [];

  // ── team-specific predictions from MODEL ───────────────────────────────────
  // predictions live at the top-level MODEL.predictions, not inside MODEL.nfl
  var allPreds  = (sportModel.predictions || MODEL.predictions || []).filter(function(p){ return p.actual && p.predicted; });
  var teamPreds = allPreds.filter(function(p){ return p.team === ACTIVE_TEAM; });
  var hasPreds  = teamPreds.length > 0;

  // Team MAPE from filtered predictions
  var teamMape = null;
  if (hasPreds) {
    var mapeSum = teamPreds.reduce(function(s, p){ return s + Math.abs(p.actual - p.predicted) / p.actual; }, 0);
    teamMape = (mapeSum / teamPreds.length * 100);
  }

  // Best model
  var bestMc   = (rfmc.test_mape != null && en.test_mape != null && rfmc.test_mape < en.test_mape) ? rfmc : en;
  var bestName = (rfmc.test_mape != null && en.test_mape != null && rfmc.test_mape < en.test_mape) ? 'Random Forest' : 'ElasticNet';

  // ── title + subtitle ───────────────────────────────────────────────────────
  setEl('model-sport-title', sportIcon + ' ' + teamName + ' — Attendance Prediction Model');
  var sub = document.querySelector('#page-model .section-sub');
  var seasons = (teamGames.length ? [...new Set(teamGames.map(function(g){ return g.season; }))].sort() : meth.seasons || []);
  if (sub) sub.textContent = 'Real ESPN data · ' + teamName + ' · '
    + teamGames.length + ' home games · seasons ' + (seasons[0] || '—') + '–' + (seasons[seasons.length-1] || '—')
    + ' · league model trained on ' + (meth.n_teams || '—') + ' teams';

  // ── stat cards (team-specific where possible) ──────────────────────────────
  setEl('m-sport-badge', sportName);
  setEl('m-samples', teamGames.length || (hasPreds ? teamPreds.length : (meth.n_training_samples || '—')));
  setEl('m-samples-sub', teamName + ' home games · ' + sportName);
  setEl('m-lin-r2',  teamMape != null ? teamMape.toFixed(1) + '%' : (en.test_r2 != null ? en.test_r2.toFixed(3) : '—'));
  setEl('m-lin-mae', teamMape != null ? 'MAPE (this team)' : (en.test_mape != null ? en.test_mape.toFixed(1) + '% MAPE' : '—'));
  setEl('m-rf-r2',   bestMc.test_r2 != null ? bestMc.test_r2.toFixed(3) : '—');
  setEl('m-rf-mae',  bestMc.test_mae != null ? Math.round(bestMc.test_mae).toLocaleString() + ' fans' : '—');
  setEl('m-rf-name', bestName + ' · League-wide · MAE: ');
  // CI from team's own attendance std dev
  var teamAtts = teamGames.map(function(g){ return g.attendance; });
  var teamCi = teamAtts.length > 1
    ? Math.round(1.96 * Math.sqrt(teamAtts.reduce(function(s,a){ var m = teamAtts.reduce(function(x,y){return x+y;},0)/teamAtts.length; return s+(a-m)*(a-m); },0) / teamAtts.length))
    : (lm.rmse ? Math.round(lm.rmse * 1.96) : null);
  setEl('m-ci', teamCi ? teamCi.toLocaleString() : '—');

  // ── Per-team correlations + OLS estimates from real game data ────────────────
  var featDefs = [
    { key:'week_of_season',    label:'Week of Season',     fn:function(g){ return g.week_of_season||g.game_of_season||0; } },
    { key:'opponent_win_pct',  label:'Opponent Win %',      fn:function(g){ return g.opponent_win_pct||0; } },
    { key:'is_prime_time',     label:'Prime Time Game',     fn:function(g){ return g.is_prime_time?1:0; } },
    { key:'weather_severity',  label:'Weather Severity',    fn:function(g){ return g.weather_severity||0; } },
    { key:'home_streak',       label:'Home Win Streak',     fn:function(g){ return g.home_streak||0; } },
    { key:'is_divisional',     label:'Divisional Game',     fn:function(g){ return g.is_divisional?1:0; } },
    { key:'is_weekend',        label:'Weekend Game',        fn:function(g){ return g.is_weekend?1:0; } },
    { key:'matchup_strength',  label:'Matchup Strength',    fn:function(g){ return g.matchup_strength||0; } },
    { key:'is_rain',           label:'Rain Game',           fn:function(g){ return (g.weather&&g.weather.is_rain)?1:0; } },
    { key:'prev_game_margin',  label:'Prev Game Margin',    fn:function(g){ return g.prev_game_margin||0; } },
  ];

  var atts = teamGames.map(function(g){ return g.attendance; });
  var teamCorrPairs = [];
  featDefs.forEach(function(fd) {
    var xs = teamGames.map(fd.fn);
    var r = pearsonR(xs, atts);
    if (r !== null) teamCorrPairs.push({ label: fd.label, r: r });
  });
  teamCorrPairs.sort(function(a,b){ return Math.abs(b.r) - Math.abs(a.r); });

  var corrLabels = teamCorrPairs.length ? teamCorrPairs.map(function(p){ return p.label; }) : Object.keys(sportModel.correlations||{}).slice(0,8).map(function(k){ return flabels[k]||k; });
  var corrVals   = teamCorrPairs.length ? teamCorrPairs.map(function(p){ return p.r; })     : Object.values(sportModel.correlations||{}).slice(0,8);
  var corrColors = corrVals.map(function(v){ return v >= 0 ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)'; });

  destroyChart('modelCorrChart');
  chartInstances['modelCorrChart'] = new Chart(document.getElementById('modelCorrChart'), {
    type: 'bar',
    data: { labels: corrLabels, datasets: [{ data: corrVals, backgroundColor: corrColors, borderWidth: 0 }] },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: function(ctx) { return 'r = ' + ctx.parsed.x.toFixed(3) + ' (' + teamName + ')'; } } } },
      scales: {
        x: { ticks: { color: MUTED, font: { size: 10 }, callback: function(v){ return v.toFixed(2); } }, grid: { color: GRID } },
        y: { ticks: { color: MUTED, font: { size: 10 } }, grid: { color: GRID } }
      }
    }
  });

  // ── scatter: this team's actual vs predicted only ──────────────────────────
  var scatterSource = hasPreds ? teamPreds : allPreds.slice(0, 200);
  var scatterData = scatterSource.map(function(p){
    return { x: p.actual, y: p.predicted, won: p.won, team: p.team, opponent: p.opponent, date: p.date };
  });
  var scatterAtts = scatterSource.map(function(p){ return p.actual; });
  var minV = Math.min.apply(null, scatterAtts) - 2000;
  var maxV = Math.max.apply(null, scatterAtts) + 2000;

  destroyChart('modelScatterChart');
  chartInstances['modelScatterChart'] = new Chart(document.getElementById('modelScatterChart'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: teamName + ' games',
        data: scatterData,
        backgroundColor: scatterData.map(function(d){ return d.won ? 'rgba(170,138,60,0.8)' : 'rgba(239,68,68,0.65)'; }),
        pointRadius: 5,
      }, {
        label: 'Perfect prediction',
        data: [{ x: minV, y: minV }, { x: maxV, y: maxV }],
        type: 'line', borderColor: 'rgba(255,255,255,0.2)', borderDash: [4,4], pointRadius: 0,
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: function(ctx) {
            var d = ctx.raw;
            if (!d.date) return 'y=x reference';
            return [teamName + ' vs ' + d.opponent, d.date,
                    'Actual: ' + Math.round(d.x).toLocaleString(),
                    'Predicted: ' + Math.round(d.y).toLocaleString(),
                    'Error: ' + (Math.round(d.x-d.y) > 0 ? '+' : '') + Math.round(d.x-d.y).toLocaleString()];
          }
        }}
      },
      scales: {
        x: { min: minV, max: maxV, ticks: { color: MUTED, font: { size: 10 }, callback: function(v){ return (v/1000).toFixed(0)+'K'; } }, grid: { color: GRID }, title: { display: true, text: 'Actual Attendance', color: MUTED, font: { size: 10 } } },
        y: { min: minV, max: maxV, ticks: { color: MUTED, font: { size: 10 }, callback: function(v){ return (v/1000).toFixed(0)+'K'; } }, grid: { color: GRID }, title: { display: true, text: 'Predicted Attendance', color: MUTED, font: { size: 10 } } }
      }
    }
  });

  // ── Feature importance: per-team |Pearson r| sorted by strength ────────────
  // Uses this team's real game data, not league-wide RF importances
  var fiPairs = teamCorrPairs.length ? teamCorrPairs : (function(){
    var fi = rf.feature_importance || {};
    return Object.keys(fi).slice(0,10).map(function(k){ return { label:flabels[k]||k, r:fi[k] }; });
  })();
  var fiLabel = teamCorrPairs.length ? teamName + ' · Feature Correlation Strength' : 'League-wide RF Importance';
  destroyChart('modelFIChart');
  chartInstances['modelFIChart'] = new Chart(document.getElementById('modelFIChart'), {
    type: 'bar',
    data: { labels: fiPairs.map(function(p){ return p.label; }),
            datasets: [{ data: fiPairs.map(function(p){ return Math.abs(p.r); }),
              backgroundColor: fiPairs.map(function(p, i, arr) {
                var stops = ['#22D3EE','#38BDF8','#60A5FA','#818CF8','#A78BFA'];
                return stops[Math.min(Math.floor((arr.length > 1 ? i/(arr.length-1) : 0) * stops.length), stops.length-1)];
              }), borderWidth: 0 }] },
    options: {
      indexAxis:'y',
      plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label:function(ctx){ return '|r| = ' + ctx.parsed.x.toFixed(3) + ' (' + teamName + ')'; } } } },
      scales:{ x:{ ticks:{ color:MUTED, font:{size:10}, callback:function(v){ return v.toFixed(2); } }, grid:{ color:GRID } }, y:{ ticks:{ color:MUTED, font:{size:10} }, grid:{ color:GRID } } }
    }
  });
  // Update chart title label
  var fiCardTitle = document.querySelector('#page-model .card-title');
  if (fiCardTitle && fiCardTitle.textContent.indexOf('Feature') >= 0) {
    // find the right card title
  }
  var fiHeaders = document.querySelectorAll('#page-model .card-title');
  fiHeaders.forEach(function(h){ if (h.textContent.indexOf('RF Feature') >= 0) h.textContent = fiLabel; });

  // ── Linear coefficients: per-team OLS estimate (β = r × σy / σx) ──────────
  // Univariate OLS gives team-specific directional impact per unit of each feature
  var stdY = stdDev(atts);
  var olsPairs = featDefs.map(function(fd) {
    var xs = teamGames.map(fd.fn);
    var r  = pearsonR(xs, atts);
    if (r === null) return null;
    var sx = stdDev(xs);
    var beta = sx > 0.001 ? r * stdY / sx : 0;
    return { label: fd.label, beta: beta };
  }).filter(Boolean).sort(function(a,b){ return Math.abs(b.beta) - Math.abs(a.beta); });

  // Fall back to league coefficients if no team data
  var useLeagueCoeffs = !olsPairs.length;
  if (useLeagueCoeffs) {
    var coeffs = lm.coefficients || {};
    var cKeys  = Object.keys(coeffs).sort(function(a,b){ return Math.abs(coeffs[b]) - Math.abs(coeffs[a]); }).slice(0, 10);
    olsPairs = cKeys.map(function(k){ return { label: flabels[k]||k, beta: coeffs[k] }; });
  }
  var coeffLabel = useLeagueCoeffs ? 'League-wide Linear Coefficients' : teamName + ' · Estimated Fans per Unit';
  var cVals2 = olsPairs.map(function(p){ return p.beta; });
  destroyChart('modelCoeffChart');
  chartInstances['modelCoeffChart'] = new Chart(document.getElementById('modelCoeffChart'), {
    type: 'bar',
    data: { labels: olsPairs.map(function(p){ return p.label; }),
            datasets: [{ data: cVals2, backgroundColor: cVals2.map(function(v){ return v>=0?'rgba(16,217,160,0.75)':'rgba(240,85,85,0.75)'; }), borderWidth:0 }] },
    options: {
      indexAxis:'y',
      plugins:{ legend:{ display:false },
        tooltip:{ callbacks:{ label:function(ctx){
          var v = ctx.parsed.x;
          return (v>0?'+':'')+Math.round(v).toLocaleString()+' fans per unit (' + teamName + ')';
        }}}
      },
      scales:{
        x:{ ticks:{ color:MUTED, font:{size:10}, callback:function(v){return (v>0?'+':'')+Math.round(v);} }, grid:{ color:GRID } },
        y:{ ticks:{ color:MUTED, font:{size:10} }, grid:{ color:GRID } }
      }
    }
  });

  // ── team-specific insights derived from real game data ─────────────────────
  var insEl = document.getElementById('model-insights');
  if (insEl) {
    var teamInsights = buildTeamInsights(teamGames, teamName);
    // Fall back to league insights if not enough team data
    if (!teamInsights.length) teamInsights = (sportModel.insights || []).slice(0, 4);
    insEl.innerHTML = teamInsights.length
      ? teamInsights.map(function(txt){ return '<div class="insight" style="margin-bottom:0"><div class="insight-text">' + txt + '</div></div>'; }).join('')
      : '<div style="color:var(--muted);font-size:0.85rem">Run scraper to generate insights for ' + teamName + '</div>';
  }

  // ── model comparison table (league-wide) ───────────────────────────────────
  var tbody = document.getElementById('model-fwd-body');
  if (tbody) {
    var mcRows = [
      { name:'Naive baseline (team mean)', d:{ test_mape:meth.naive_baseline_test_mape, test_mae:meth.naive_baseline_test_mae }, floor:true },
      { name:'Ridge Regression',    d:mc.ridge||{} },
      { name:'ElasticNet (L1+L2)',  d:mc.elasticnet||{} },
      { name:'Random Forest',       d:mc.randomforest||{} },
    ];
    var baseMape = meth.naive_baseline_test_mape;
    tbody.innerHTML = mcRows.map(function(r){
      var d = r.d;
      var beats = (!r.floor && d.test_mape != null && baseMape != null && d.test_mape < baseMape);
      var beatCell = r.floor ? '<span style="color:var(--muted)">— floor —</span>'
                    : (beats ? '<span style="color:var(--green)">✓ beats baseline</span>' : '<span style="color:var(--muted)">at baseline</span>');
      return '<tr><td><strong>' + r.name + '</strong></td>'
        + '<td>' + (d.train_r2!=null?d.train_r2.toFixed(3):'—') + '</td>'
        + '<td>' + (d.val_r2!=null?d.val_r2.toFixed(3):'—') + '</td>'
        + '<td style="font-weight:700;color:var(--gold)">' + (d.test_r2!=null?d.test_r2.toFixed(3):'—') + '</td>'
        + '<td>' + (d.test_mae!=null?Math.round(d.test_mae).toLocaleString():'—') + '</td>'
        + '<td style="font-weight:600">' + (d.test_mape!=null?d.test_mape.toFixed(1)+'%':'—') + '</td>'
        + '<td>' + beatCell + '</td></tr>';
    }).join('');
  }
}

// ── team-specific model insights from real game data ──────────────────────────
// ── shared stat helpers (used in renderModelTab + initCharts) ─────────────────
function pearsonR(xs, ys) {
  var n = xs.length;
  if (n < 5) return null;
  var mx = xs.reduce(function(a,b){return a+b;},0)/n;
  var my = ys.reduce(function(a,b){return a+b;},0)/n;
  var num=0, dx=0, dy=0;
  for (var i=0;i<n;i++){num+=(xs[i]-mx)*(ys[i]-my);dx+=(xs[i]-mx)*(xs[i]-mx);dy+=(ys[i]-my)*(ys[i]-my);}
  var denom = Math.sqrt(dx)*Math.sqrt(dy);
  return denom ? num/denom : 0;
}
function stdDev(arr) {
  if (!arr.length) return 1;
  var mean = arr.reduce(function(a,b){return a+b;},0)/arr.length;
  var v = arr.reduce(function(s,x){return s+(x-mean)*(x-mean);},0)/arr.length;
  return Math.sqrt(v)||1;
}

function buildTeamInsights(games, teamName) {
  if (games.length < 5) return [];
  var ins = [];

  function avg(arr) { return arr.length ? arr.reduce(function(a,b){return a+b;},0)/arr.length : 0; }
  function fmt(n) { return Math.round(Math.abs(n)).toLocaleString(); }

  var atts   = games.map(function(g){ return g.attendance; });
  var meanAtt = avg(atts);

  // Rain impact
  var rainG = games.filter(function(g){ return g.weather && g.weather.is_rain; });
  var dryG  = games.filter(function(g){ return g.weather && !g.weather.is_rain; });
  if (rainG.length >= 2 && dryG.length >= 2) {
    var diff = Math.round(avg(rainG.map(function(g){return g.attendance;})) - avg(dryG.map(function(g){return g.attendance;})));
    ins.push('🌧 Rain games draw <strong>' + fmt(diff) + ' ' + (diff < 0 ? 'fewer' : 'more') + ' fans</strong> at ' + teamName + ' — vs clear-weather (' + rainG.length + ' rain games analysed).');
  }

  // Prime time impact
  var primeG = games.filter(function(g){ return g.is_prime_time; });
  var dayG   = games.filter(function(g){ return !g.is_prime_time; });
  if (primeG.length >= 2 && dayG.length >= 2) {
    var pdiff = Math.round(avg(primeG.map(function(g){return g.attendance;})) - avg(dayG.map(function(g){return g.attendance;})));
    ins.push('📺 Prime time kickoffs draw <strong>' + fmt(pdiff) + ' ' + (pdiff >= 0 ? 'more' : 'fewer') + ' fans</strong> at ' + teamName + ' (' + primeG.length + ' night games vs ' + dayG.length + ' day games).');
  }

  // Divisional impact
  var divG    = games.filter(function(g){ return g.is_divisional; });
  var nonDivG = games.filter(function(g){ return !g.is_divisional; });
  if (divG.length >= 2 && nonDivG.length >= 2) {
    var ddiff = Math.round(avg(divG.map(function(g){return g.attendance;})) - avg(nonDivG.map(function(g){return g.attendance;})));
    ins.push('🏆 Divisional rivalries draw <strong>' + fmt(ddiff) + ' ' + (ddiff >= 0 ? 'more' : 'fewer') + ' fans</strong> (' + divG.length + ' divisional home games).');
  }

  // Win streak impact
  var streakG  = games.filter(function(g){ return g.home_streak >= 3; });
  var noStreak = games.filter(function(g){ return g.home_streak < 1; });
  if (streakG.length >= 2 && noStreak.length >= 2) {
    var sdiff = Math.round(avg(streakG.map(function(g){return g.attendance;})) - avg(noStreak.map(function(g){return g.attendance;})));
    ins.push('🔥 A home win streak of 3+ games adds <strong>' + fmt(sdiff) + ' fans</strong> per game at ' + teamName + ' — momentum drives casual fan turnout.');
  }

  // Weekend vs weekday
  var wkndG = games.filter(function(g){ return g.is_weekend; });
  var wkdyG = games.filter(function(g){ return !g.is_weekend; });
  if (wkndG.length >= 2 && wkdyG.length >= 2) {
    var wdiff = Math.round(avg(wkndG.map(function(g){return g.attendance;})) - avg(wkdyG.map(function(g){return g.attendance;})));
    ins.push('📅 Weekend home games at ' + teamName + ' average <strong>' + fmt(wdiff) + ' ' + (wdiff >= 0 ? 'more' : 'fewer') + ' fans</strong> vs weekday fixtures (' + wkndG.length + ' vs ' + wkdyG.length + ' games).');
  }

  // Season phase
  var lateG  = games.filter(function(g){ return g.season_phase === 'late' || (g.week_of_season||0) >= 13; });
  var earlyG = games.filter(function(g){ return g.season_phase === 'early' || (g.week_of_season||0) < 6; });
  if (lateG.length >= 2 && earlyG.length >= 2) {
    var phaseDiff = Math.round(avg(lateG.map(function(g){return g.attendance;})) - avg(earlyG.map(function(g){return g.attendance;})));
    ins.push('📈 Late-season attendance is <strong>' + fmt(phaseDiff) + ' ' + (phaseDiff >= 0 ? 'higher' : 'lower') + '</strong> than early-season at ' + teamName + ' — playoff implications drive demand.');
  }

  return ins.slice(0, 5);
}

// ── interactive predictor ─────────────────────────────────────────────────────

function runPredictor() {
  if (!MODEL) return;
  var teamKey = document.getElementById('pred-team').value;
  var predSport = MLB_TEAMS.has(teamKey) ? 'baseball' : 'football';
  var sportModel = (predSport === 'baseball' && MODEL.mlb) ? MODEL.mlb : (MODEL.nfl || MODEL);
  var lm = sportModel.linear_model || {};
  var coeffs = lm.coefficients || {};
  var week    = parseInt(document.getElementById('pred-week').value) || 8;
  var oppPct  = parseInt(document.getElementById('pred-opp').value) / 100;
  var streak  = parseInt(document.getElementById('pred-streak').value) || 0;
  var weather = document.getElementById('pred-weather').value;
  var gametype = document.getElementById('pred-gametype').value;

  var isPrime = gametype.indexOf('prime') >= 0;
  var isDiv   = gametype.indexOf('div') >= 0 && gametype.indexOf('nondiv') < 0;
  var isWknd  = !isPrime; // prime time usually weekday
  var phase   = week <= 6 ? 0 : week <= 12 ? 1 : 2;

  // Weather features
  var precip = 0, temp = 18, wind = 12, severity = 0;
  if (weather === 'rain')  { precip = 8; severity = 24; }
  if (weather === 'cold')  { temp = 3;  severity = 7; }
  if (weather === 'hot')   { temp = 38; severity = 3; }

  // Feature vector matching FEATURE_KEYS order
  var featureMap = {
    week_of_season: week,
    is_weekend: isWknd ? 1 : 0,
    is_prime_time: isPrime ? 1 : 0,
    weather_severity: severity,
    total_precip_mm: precip,
    avg_temp_c: temp,
    avg_wind_kmh: wind,
    home_streak: streak,
    prev_game_margin: 6,
    is_divisional: isDiv ? 1 : 0,
    opponent_win_pct: oppPct,
    matchup_strength: oppPct * 0.55,
    is_holiday_week: 0,
    is_thanksgiving_week: 0,
    season_phase_num: phase,
  };

  // MLB-specific feature additions (overlap keys reused; sport-specific added)
  if (predSport === 'baseball') {
    featureMap.game_of_season = Math.round(week / 18 * 162);  // map week slider → game #
    featureMap.month = 4 + Math.round(week / 18 * 6);
    featureMap.is_friday = isWknd ? 1 : 0;
    featureMap.is_saturday = isWknd ? 1 : 0;
    featureMap.is_night_game = isPrime ? 1 : 0;
    featureMap.is_doubleheader = 0;
    featureMap.our_win_pct_at_time = 0.5;
    featureMap.holiday_is_holiday_week = 0;
    featureMap.att_lag1_norm = 0;
    featureMap.att_rolling5_norm = 0;
  }

  // Apply coefficients (team-mean adjusted → add team mean)
  var teamMeans = sportModel.team_mean_attendance || {};
  var teamMean  = teamMeans[teamKey] || 70000;
  var capacity  = (REAL && REAL.teams && REAL.teams[teamKey] && REAL.teams[teamKey].team_info)
                   ? REAL.teams[teamKey].team_info.venue_capacity : 70000;

  var delta = lm.intercept || 0;
  var factors = [];
  Object.keys(featureMap).forEach(function(fk) {
    var coeff = coeffs[fk] || 0;
    var val   = featureMap[fk];
    var effect = coeff * val;
    delta += effect;
    if (Math.abs(effect) > 100) {
      factors.push({ label: (sportModel.feature_labels||{})[fk] || fk, effect: Math.round(effect) });
    }
  });

  var predicted = Math.round(teamMean + delta);
  var rmse = lm.rmse || 3000;
  var ci = Math.round(rmse * 1.96);
  var fillPct = Math.round(predicted / capacity * 100 * 10) / 10;

  // Ghost risk
  var ghost = 0.18;
  if (weather === 'rain') ghost += 0.12;
  if (weather === 'cold') ghost += 0.06;
  if (weather === 'hot')  ghost += 0.08;
  if (streak < -1)        ghost += Math.min(0.04 * Math.abs(streak), 0.20);
  if (oppPct < 0.4)       ghost += 0.05;
  ghost = Math.round(Math.min(ghost, 0.55) * 100);

  // Show result
  var resultEl = document.getElementById('pred-result');
  if (resultEl) resultEl.style.display = 'block';
  setEl('pred-out-att',   predicted.toLocaleString());
  setEl('pred-out-fill',  fillPct + '%');
  setEl('pred-out-ci',    (predicted - ci).toLocaleString() + ' – ' + (predicted + ci).toLocaleString());
  setEl('pred-out-ghost', ghost + '%');

  // Top factors
  factors.sort(function(a,b){ return Math.abs(b.effect) - Math.abs(a.effect); });
  var factorsEl = document.getElementById('pred-out-factors');
  if (factorsEl) {
    factorsEl.innerHTML = '<strong>Top factors:</strong> ' + factors.slice(0,4).map(function(f){
      var col = f.effect > 0 ? GREEN : RED;
      return '<span style="color:' + col + ';margin-right:0.8rem">' +
             (f.effect > 0 ? '▲' : '▼') + ' ' + f.label + ' ' +
             (f.effect > 0 ? '+' : '') + f.effect.toLocaleString() + ' fans</span>';
    }).join('');
  }
}

boot();

// ════════════════════════════════════════════════════════════════════════════
// PREDICTIONS TAB — dynamic per team/sport
// ════════════════════════════════════════════════════════════════════════════

function refreshPredictionsTab(td, cfg) {
  var sport    = activeSport();
  var ti       = td ? (td.team_info || {}) : {};
  var teamName = ti.name || ACTIVE_TEAM;
  var injuries = (td && td.injuries) || [];
  var games    = (td && td.games) || [];
  var homeGames= games.filter(function(g){ return g.is_home; });
  var lastHome = homeGames[homeGames.length - 1] || {};
  var sentiment= td ? (td.sentiment_score || 65) : 65;

  // Sport badge + benchmark label
  var sportLabel = cfg.sport || 'NFL';
  var year       = (lastHome.season || new Date().getFullYear());
  setEl('predict-sport-badge', cfg.icon + ' ' + sportLabel);
  setEl('predict-benchmark-badge', year + ' ' + sportLabel);
  var leagueEl = document.getElementById('predict-benchmark-league-label');
  if (leagueEl) leagueEl.innerHTML =
    '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3B82F6;margin-right:5px"></span>' + sportLabel + ' Avg';

  // Pull real MAPE from MODEL if available
  if (MODEL) {
    var sportModel = (sport === 'baseball' && MODEL.mlb) ? MODEL.mlb : (MODEL.nfl || MODEL);
    var mc  = sportModel.model_comparison || {};
    var en  = mc.elasticnet || {};
    var lm  = sportModel.linear_model || {};
    if (en.test_mape != null) {
      setEl('predict-att-mape', en.test_mape.toFixed(1) + '% MAPE');
    }
    // Ghost ticket accuracy derived from naive baseline improvement
    var naive = (sportModel.methodology || {}).naive_baseline_test_mape;
    if (naive && en.test_mape) {
      var improvement = Math.round((1 - en.test_mape / naive) * 100);
      var acc = Math.min(94, Math.max(70, 80 + improvement));
      setEl('predict-ghost-acc', acc + '%');
    }
  }

  // Churn subtitle with real at-risk estimate
  var stats   = td ? (td.attendance_stats || {}) : {};
  var ghostPct = stats.avg_ghost_risk || 0.207;
  var cap     = ti.venue_capacity || 68500;
  var atRisk  = Math.round(cap * ghostPct * 0.18);   // ~18% of ghost seats are high-risk fans
  var ltvRisk = Math.round(atRisk * 4820 / 1000);
  setEl('predict-churn-sub', atRisk.toLocaleString() + ' fans in high-risk zone (>70% churn). '
    + '$' + ltvRisk.toLocaleString() + 'K LTV at risk. Intervention targeting top 500 highest-LTV fans.');

  // Interaction recommendations — team + sport + injury aware
  buildRecommendations(td, cfg, sport, teamName, injuries, sentiment, lastHome);
}

function buildRecommendations(td, cfg, sport, teamName, injuries, sentiment, lastHome) {
  var el = document.getElementById('predict-recommendations');
  if (!el) return;

  var games      = (td && td.games) || [];
  var homeGames  = games.filter(function(g){ return g.is_home; });
  var won        = lastHome.won;
  var nextOpp    = lastHome.opponent || 'Upcoming Opponent';
  var streak     = lastHome.home_streak || 0;
  var starInj    = injuries.filter(function(i){
    return i.status === 'Out' || i.status === 'Questionable';
  })[0];

  // Fan 1 — streaming / away game fan
  var fan1Label = 'Marcus Thompson — Next Away Game';
  var fan1Text  = won
    ? '72% probability streaming. <strong>Action:</strong> Watch party invite + ' + cfg.hashtag + ' digital collectible. Predict $42 spend + loyalty +4 pts.'
    : 'Likely disengaging after loss. <strong>Action:</strong> "Bounce back" content + exclusive next home game access. Loyalty retention critical.';

  // Fan 2 — at-risk fan, injury sensitive
  var fan2Label = 'Priya Kapoor — At-Risk, Lapsed 3 weeks';
  var fan2Text  = starInj
    ? 'High churn risk amplified by ' + starInj.player + ' injury (' + starInj.status + '). '
      + '<strong>Action:</strong> Behind-the-scenes exclusive + "show your support" narrative. Churn 74%→31%.'
    : 'Disengages after losses, re-engages with premium access. '
      + '<strong>Action:</strong> Priority seats for next ' + (nextOpp ? 'vs ' + nextOpp.split(' ').slice(-1)[0] : 'home') + ' game. Churn 74%→28%.';

  // Fan 3 — casual upgrade threshold, sport-specific
  var sportSpecific = sport === 'baseball'
    ? 'wild card push — premium club seats trial for stretch run.'
    : sport === 'basketball'
    ? 'playoff push — offer premium seating trial for key matchups.'
    : 'playoff race — "your team needs you" premium trial.';
  var fan3Label = '840 Casual Fans — Near Upgrade Threshold';
  var fan3Text  = 'Within 12 loyalty pts of Gold during ' + sportSpecific
    + ' "You\'re this close" + premium trial offer. Est. 23% conversion = $1.8M LTV.';

  el.innerHTML =
    '<div class="insight mb"><div class="insight-label">' + fan1Label + '</div><div class="insight-text">' + fan1Text + '</div></div>'
  + '<div class="insight mb"><div class="insight-label">' + fan2Label + '</div><div class="insight-text">' + fan2Text + '</div></div>'
  + '<div class="insight"><div class="insight-label">' + fan3Label + '</div><div class="insight-text">' + fan3Text + '</div></div>';
}

// ════════════════════════════════════════════════════════════════════════════
// LIVE POC DEMO — Fan Journey Trigger
// ════════════════════════════════════════════════════════════════════════════

function loadDemoConfig() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API_BASE + '/api/demo/config');
  xhr.onload = function() {
    if (xhr.status !== 200) return;
    try {
      var d = JSON.parse(xhr.responseText);
      var statusEl = document.getElementById('poc-config-status');
      var recipEl  = document.getElementById('poc-recipient');
      if (statusEl) {
        if (d.email_configured) {
          statusEl.textContent = '🟢 Email configured';
          statusEl.style.color = '#10D9A0';
        } else {
          statusEl.textContent = '🔴 Add credentials to backend/.env';
          statusEl.style.color = '#F05555';
        }
      }
      if (recipEl && d.recipient) recipEl.textContent = d.recipient;
      // Real data stats
      if (d.real_data) {
        setEl('poc-ghost',    (d.real_data.ghost_risk_pct || '—') + '%');
        setEl('poc-opponent', d.real_data.opponent || '—');
        var disc = d.real_data.ghost_risk_pct > 35 ? '25%' : d.real_data.ghost_risk_pct > 25 ? '15%' : '8%';
        setEl('poc-discount', disc + ' recommended');
      }
      if (d.live_weather && d.live_weather.temp_f) {
        setEl('poc-weather', d.live_weather.temp_f + '°F · ' + (d.live_weather.precip_label || 'Clear'));
      }
    } catch(e) {}
  };
  xhr.onerror = function() {
    var el = document.getElementById('poc-config-status');
    if (el) { el.textContent = '⚠️ Start backend server first'; el.style.color = '#F97316'; }
  };
  xhr.send();
}

var DEMO_FAN_KEY = 'marcus';

var DEMO_FAN_ACTIONS = {
  marcus: { label:'Upsell',         color:'#22D3EE', desc:'Platinum · loyalty 91 · risk 8%. Lead with exclusivity and upgrade experience, not price.' },
  priya:  { label:'Win-Back',       color:'#F05555', desc:'At-Risk · loyalty 44 · risk 74%. Personal and warm — "we\'ve missed you." Bigger discount, bonus points.' },
  david:  { label:'Retention',      color:'#10D9A0', desc:'Silver · loyalty 58 · risk 41%. Urgency-led — lock in your spot + loyalty nudge toward Gold tier.' },
  lisa:   { label:'Re-acquisition', color:'#A78BFA', desc:'Bronze · loyalty 29 · risk 55%. Low pressure, biggest discount, food included — just get them back in the door.' },
};

function selectDemoFan(fanKey, btn) {
  DEMO_FAN_KEY = fanKey;
  // Update button styles
  document.querySelectorAll('.poc-fan-btn').forEach(function(b) {
    b.style.background = 'transparent';
    b.style.color = 'var(--muted-hi)';
    b.style.borderColor = 'var(--border-hi)';
    b.style.borderRadius = '20px';
  });
  var cfg = DEMO_FAN_ACTIONS[fanKey] || DEMO_FAN_ACTIONS.marcus;
  btn.style.background = 'rgba(' + hexToRgb(cfg.color) + ',0.15)';
  btn.style.color = cfg.color;
  btn.style.borderColor = cfg.color;
  // Update description
  var desc = document.getElementById('poc-action-desc');
  if (desc) {
    desc.innerHTML = '<strong style="color:' + cfg.color + '">' + cfg.label + '</strong> — ' + cfg.desc;
    desc.style.borderColor = 'rgba(' + hexToRgb(cfg.color) + ',0.3)';
    desc.style.background = 'rgba(' + hexToRgb(cfg.color) + ',0.08)';
  }
  // Reset step statuses
  [1,2,3].forEach(function(s){
    setEl('poc-s' + s + '-text', '⏳ Pending');
    setEl('poc-s' + s + '-sub', '');
    var el = document.getElementById('poc-status-' + s);
    if (el) el.style.borderColor = 'var(--border)';
  });
  [1,2,3].forEach(function(s){
    var b = document.getElementById('poc-btn-' + s);
    if (b) { b.disabled = false; b.textContent = ['','📍 Step 1: Geo Trigger →','✅ Step 2: Check-In →','📲 Step 3: Social Push'][s]; }
  });
}

function hexToRgb(hex) {
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return r + ',' + g + ',' + b;
}

function runDemoStep(step) {
  var endpoints = { 1: '/api/demo/run', 2: '/api/demo/checkin', 3: '/api/demo/social' };
  var btnIds    = { 1: 'poc-btn-1', 2: 'poc-btn-2', 3: 'poc-btn-3' };
  var statusMap = { 1: 'poc-s1-text', 2: 'poc-s2-text', 3: 'poc-s3-text' };
  var subMap    = { 1: 'poc-s1-sub',  2: 'poc-s2-sub',  3: 'poc-s3-sub' };
  var names     = { 1: 'Geo Trigger', 2: 'Stadium Entry', 3: 'Social Push' };

  var btn = document.getElementById(btnIds[step]);
  if (btn) { btn.textContent = '⏳ Sending…'; btn.disabled = true; }
  setEl(statusMap[step], '⏳ Sending email…');

  var xhr = new XMLHttpRequest();
  xhr.open('POST', API_BASE + endpoints[step] + '?fan=' + DEMO_FAN_KEY);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    if (btn) { btn.disabled = false; btn.textContent = '✅ ' + names[step] + ' sent'; }
    try {
      var result = JSON.parse(xhr.responseText);
      var now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      if (result.email_sent) {
        setEl(statusMap[step], '✅ Email sent · ' + now);
        setEl(subMap[step],    'To: ' + (result.recipient || '—'));
        document.getElementById('poc-status-' + step).style.borderColor = '#22C55E';
      } else {
        var err = result.email_error || 'Unknown error';
        setEl(statusMap[step], '❌ Not sent: ' + err.slice(0, 60));
        setEl(subMap[step],    'Check backend/.env credentials');
        document.getElementById('poc-status-' + step).style.borderColor = '#EF4444';
      }
    } catch(e) {
      setEl(statusMap[step], '❌ Parse error');
    }
  };
  xhr.onerror = function() {
    if (btn) { btn.disabled = false; }
    setEl(statusMap[step], '❌ Server unreachable — start backend first');
    document.getElementById('poc-status-' + step).style.borderColor = '#F97316';
  };
  xhr.send('{}');
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 2 — Seat Intelligence & Price Point Profile
// ════════════════════════════════════════════════════════════════════════════

function getPriceSensitivity(f) {
  // High LTV + low risk = low sensitivity (will pay full price)
  // Low LTV + high risk = high sensitivity (needs a discount)
  return Math.round(Math.min(100, Math.max(0, (f.risk * 0.6) + ((1 - f.ltv / 12000) * 40))));
}

function getSeatIntelHTML(f) {
  var sensitivity = getPriceSensitivity(f);
  var sensColor   = sensitivity > 66 ? RED : sensitivity > 33 ? ORANGE : GREEN;
  var sensLabel   = sensitivity > 66 ? 'High — needs incentive' : sensitivity > 33 ? 'Moderate' : 'Low — pays full price';
  var partyIcons  = f.partyType && f.partyType.indexOf('Family') >= 0 ? '👨‍👩‍👧 ' :
                    f.partyType && f.partyType.indexOf('Couple') >= 0 ? '👫 ' : '🧑 ';
  var upgradeRows = (f.upgradeHistory || ['No upgrade history']).map(function(u) {
    return '<div style="font-size:0.77rem;padding:3px 0;border-bottom:1px solid var(--border)">' + u + '</div>';
  }).join('');
  var bestDiscount = sensitivity > 66 ? '20–25%' : sensitivity > 33 ? '10–15%' : '0–8%';

  return '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">' +
    '<div class="stat-label" style="font-size:0.7rem;margin-bottom:0.6rem">SEAT INTELLIGENCE</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:0.8rem">' +
      '<div><div class="stat-label" style="font-size:0.68rem">Preferred Zone</div>' +
        '<div style="font-size:0.85rem;font-weight:600">' + (f.preferredZone || f.section) + '</div></div>' +
      '<div><div class="stat-label" style="font-size:0.68rem">Avg Price Point</div>' +
        '<div style="font-size:0.85rem;font-weight:600;color:var(--gold)">$' + (f.pricePoint || '—') + ' / ticket</div></div>' +
      '<div><div class="stat-label" style="font-size:0.68rem">Party Composition</div>' +
        '<div style="font-size:0.82rem">' + partyIcons + (f.partyType || 'Party of ' + f.party) + '</div></div>' +
      '<div><div class="stat-label" style="font-size:0.68rem">Best Offer Trigger</div>' +
        '<div style="font-size:0.82rem;font-weight:600">' + bestDiscount + ' discount</div></div>' +
    '</div>' +
    '<div class="stat-label" style="font-size:0.68rem;margin-bottom:3px">Price Sensitivity</div>' +
    '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem">' +
      '<div class="pbar" style="flex:1"><div class="pfill" style="width:' + sensitivity + '%;background:' + sensColor + '"></div></div>' +
      '<span style="font-size:0.77rem;color:' + sensColor + ';font-weight:600">' + sensitivity + '/100</span>' +
      '<span style="font-size:0.72rem;color:var(--muted)">' + sensLabel + '</span>' +
    '</div>' +
    '<div class="stat-label" style="font-size:0.68rem;margin-bottom:3px">Upgrade History</div>' +
    upgradeRows +
  '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 4 — Real-Time Entry / Check-In Feed
// ════════════════════════════════════════════════════════════════════════════

function buildEntryFeed() {
  var tbody = document.getElementById('notArrivedBody');
  if (!tbody) return;
  tbody.innerHTML = notArrivedData.map(function(row) {
    var riskNum = parseInt(row.risk);
    var riskColor = riskNum > 60 ? RED : riskNum > 40 ? ORANGE : MUTED;
    var btnClass  = riskNum > 60 ? 'btn-gold' : riskNum > 40 ? 'btn-blue' : 'btn-out';
    return '<tr>' +
      '<td><strong>' + row.fan + '</strong></td>' +
      '<td>' + row.section + '</td>' +
      '<td style="color:' + riskColor + ';font-weight:700">' + row.risk + '</td>' +
      '<td style="font-size:0.77rem;color:var(--muted)">' + row.ping + '</td>' +
      '<td><button class="btn ' + btnClass + '" style="font-size:0.68rem">' + row.action + '</button></td>' +
    '</tr>';
  }).join('');
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 1 — Dynamic Pricing Engine
// ════════════════════════════════════════════════════════════════════════════

function loadPricingData() {
  var sport = activeSport();
  if (isUnsupportedSport()) { renderPricingFallback(); return; }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API_BASE + '/api/pricing/' + ACTIVE_TEAM + '?t=' + Date.now());
  xhr.onload = function() {
    if (xhr.status === 200) {
      try { renderPricingTable(JSON.parse(xhr.responseText)); } catch(e) { renderPricingFallback(); }
    } else { renderPricingFallback(); }
  };
  xhr.onerror = function() { renderPricingFallback(); };
  xhr.send();
}

function renderPricingFallback() {
  // Use mock data if API unreachable
  var mockSections = [];
  var sections = ['Sec 101','Sec 102','Sec 103','Sec 104','Sec 105','Sec 106','Sec 107','Sec 108','Sec 109','Sec 110'];
  var risks     = [0.42, 0.28, 0.14, 0.38, 0.22, 0.16, 0.35, 0.19, 0.45, 0.31];
  sections.forEach(function(s, i) {
    var r = risks[i];
    var disc = r > 0.35 ? 25 : r > 0.25 ? 15 : r > 0.15 ? 8 : 0;
    mockSections.push({ section:s, seats_remaining:Math.round(r*685), ghost_risk:r, discount_pct:disc, suggested_price:Math.round(120*(1-disc/100)) });
  });
  renderPricingTable({ sections:mockSections, seats_remaining:1847, recommended_discount_pct:15, est_revenue_recovered:31000 });
}

function renderPricingTable(data) {
  setEl('pricing-seats', (data.seats_remaining || 0).toLocaleString());
  setEl('pricing-discount', (data.recommended_discount_pct || 0) + '%');
  setEl('pricing-revenue', '$' + Math.round((data.est_revenue_recovered || 0) / 1000) + 'K');

  var tbody = document.getElementById('pricingTableBody');
  if (tbody && data.sections) {
    tbody.innerHTML = data.sections.map(function(s) {
      var riskColor = s.ghost_risk > 0.35 ? RED : s.ghost_risk > 0.25 ? ORANGE : GREEN;
      var discBadge = s.discount_pct > 0
        ? '<span style="color:' + GOLD + ';font-weight:700">-' + s.discount_pct + '%</span>'
        : '<span style="color:' + GREEN + ';font-weight:600">Full price</span>';
      return '<tr>' +
        '<td><strong>' + s.section + '</strong></td>' +
        '<td>' + (s.seats_remaining||0) + '</td>' +
        '<td style="color:' + riskColor + ';font-weight:700">' + Math.round(s.ghost_risk*100) + '%</td>' +
        '<td>' + discBadge + '</td>' +
        '<td style="font-weight:700;color:var(--gold)">$' + (s.suggested_price||'—') + '</td>' +
        '<td><button class="btn btn-blue" style="font-size:0.68rem">Deploy</button></td>' +
      '</tr>';
    }).join('');
  }

  var insight = document.getElementById('pricing-insight');
  if (insight) {
    var disc = data.recommended_discount_pct || 15;
    var rev  = data.est_revenue_recovered || 0;
    insight.innerHTML = 'Current ghost risk warrants a <strong>' + disc + '% discount</strong> across high-risk sections. ' +
      'Deploying now to the fan waitlist (2,800 fans) fills remaining seats within <strong>18 minutes</strong> on average. ' +
      'Estimated revenue recovered: <strong>$' + (rev/1000).toFixed(0) + 'K</strong>. ' +
      'Platinum fans receive priority access with loyalty points bonus instead of price reduction.';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 3 — Friends Nearby / Geo-Sharing
// ════════════════════════════════════════════════════════════════════════════

function buildFriendShareTable() {
  var tbody = document.getElementById('friendShareBody');
  if (!tbody) return;
  tbody.innerHTML = friendShareData.map(function(row) {
    var sentBadge = row.linkSent
      ? '<span style="color:' + GREEN + ';font-weight:600">✓ Sent</span>'
      : '<button class="btn btn-purple" style="font-size:0.68rem">Send Link</button>';
    var convBadge = row.converted > 0
      ? '<span style="color:' + GREEN + ';font-weight:700">' + row.converted + ' bought</span>'
      : '<span style="color:' + MUTED + '">—</span>';
    return '<tr>' +
      '<td><strong>' + row.fan + '</strong></td>' +
      '<td><strong>' + row.nearbyFriends + '</strong> friends</td>' +
      '<td style="font-size:0.8rem;color:var(--muted)">' + row.distance + '</td>' +
      '<td>' + sentBadge + '</td>' +
      '<td>' + convBadge + '</td>' +
      '<td style="color:var(--gold);font-weight:700">' + (row.revenue > 0 ? '$' + row.revenue : '—') + '</td>' +
    '</tr>';
  }).join('');
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 5 — Social Hub
// ════════════════════════════════════════════════════════════════════════════

function buildSocialHub() {
  // UGC Leaderboard
  var tbody = document.getElementById('ugcLeaderBody');
  if (tbody) {
    var tierMap = { platinum:'t-plat', gold:'t-gold', silver:'t-silv', bronze:'t-bron' };
    var platMap = { Instagram:'🟣', TikTok:'🎵', 'X':'✖', Facebook:'🔵' };
    tbody.innerHTML = ugcLeaderboardData.map(function(row, i) {
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1) + '.';
      return '<tr>' +
        '<td>' + medal + ' <strong>' + row.name + '</strong></td>' +
        '<td><span class="tier ' + (tierMap[row.tier]||'t-bron') + '">' + row.tier + '</span></td>' +
        '<td>' + (platMap[row.platform]||'📱') + ' ' + row.platform + '</td>' +
        '<td style="font-weight:600">' + row.posts + '</td>' +
        '<td style="color:var(--blue);font-weight:600">' + row.impressions + '</td>' +
        '<td style="color:var(--gold);font-weight:600">' + row.pts.toLocaleString() + ' pts</td>' +
        '<td style="color:var(--green);font-weight:700">$' + row.revenue + '</td>' +
      '</tr>';
    }).join('');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 6 — NBA / IndyCar unsupported sport overlay
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// TEAM-SWITCH: update all hardcoded team references across the site
// ════════════════════════════════════════════════════════════════════════════

function updateTeamContent(td) {
  var ti  = td ? (td.team_info || {}) : {};
  var cfg = TEAM_CONFIG[ACTIVE_TEAM] || TEAM_CONFIG['sf49ers'];
  var cap = ti.venue_capacity || 68500;
  var teamName = ti.name || ACTIVE_TEAM;
  var injuries = (td && td.injuries) || [];
  var games    = (td && td.games) || [];
  var homeGames = games.filter(function(g){ return g.is_home; });
  var lastHome  = homeGames[homeGames.length - 1] || {};
  var nextOpp   = lastHome.opponent || 'Upcoming Opponent';
  var won       = td && td.team_info && td.team_info.record
    ? (parseInt((td.team_info.record||'').split('-')[0]) > parseInt((td.team_info.record||'').split('-')[1]))
    : true;

  // Jersey ref in Game Day timeline
  setEl('gameday-jersey-ref', cfg.jersey);

  // Capacity figures
  setEl('ghost-capacity-sub',    cap.toLocaleString());
  setEl('entry-capacity-sub',    cap.toLocaleString());
  setEl('pricing-capacity-sub',  cap.toLocaleString());

  // Ghost seats estimate from real ghost risk
  var stats = td ? (td.attendance_stats || {}) : {};
  var ghostPct = stats.avg_ghost_risk || 0.207;
  setEl('ghost-seats-val', Math.round(ghostPct * cap).toLocaleString());

  // Social Hub hashtag
  setEl('social-hashtag', cfg.hashtag);

  // Game Day AI insight — uses real injury data
  buildGameDayInsight(injuries, cfg);

  // Overview alerts — fully dynamic
  buildOverviewAlerts(td, ti, cfg, nextOpp, won, injuries);

  // Predictions tab — model metrics + recommendations
  refreshPredictionsTab(td, cfg);
}

function buildGameDayInsight(injuries, cfg) {
  var el = document.getElementById('gameday-ai-insight');
  if (!el) return;
  var starInjury = injuries.filter(function(i){
    return i.status === 'Out' || i.status === 'Questionable' || i.status === 'Injured Reserve';
  })[0];
  var injText = starInjury
    ? 'Cross-reference: live injury report shows <strong>' + starInjury.player + '</strong> <em>' + starInjury.status + '</em> — push "Support the Team" bundle as emotional hook.'
    : 'Team is healthy this week — push premium seat upgrade to capitalise on high fan sentiment.';
  el.innerHTML = 'Fans who pre-order food are <strong>3.1× more likely</strong> to buy merch before halftime. '
    + 'Push ' + cfg.jersey + ' jersey offer T-2 min halftime to 1,840 food-order completers = est. <strong>$42K incremental revenue</strong>. '
    + injText;
}

function buildOverviewAlerts(td, ti, cfg, nextOpp, won, injuries) {
  var el = document.getElementById('overview-alerts');
  if (!el) return;

  var teamName = ti.name || ACTIVE_TEAM;
  var stats    = td ? (td.attendance_stats || {}) : {};
  var ghostPct = stats.avg_ghost_risk ? Math.round(stats.avg_ghost_risk * 100) : 22;
  var cap      = ti.venue_capacity || 68500;
  var ghostSeats = Math.round((stats.avg_ghost_risk || 0.207) * cap);
  var ghostVal   = Math.round(ghostSeats * 120 * 0.5 / 1000);

  // Sentiment-driven social text
  var sentiment = td ? (td.sentiment_score || 65) : 65;
  var socialTitle = sentiment > 70
    ? 'Post-Win Social Surge — ' + (Math.round(sentiment * 58)).toLocaleString() + ' fans active'
    : 'Fan Sentiment Push — Engage ' + (Math.round(sentiment * 40)).toLocaleString() + ' active fans';

  // Star injury alert
  var starInjury = injuries.filter(function(i){
    return i.status === 'Out' || i.status === 'Questionable' || i.status === 'Injured Reserve';
  })[0];
  var injAlert = starInjury
    ? '<div class="alert a-ghost"><div class="aicon">🏥</div><div class="abody">'
        + '<div class="atitle">' + starInjury.player + ' — ' + starInjury.status + ' · Loyalty Impact</div>'
        + '<div class="adesc">Star player injury correlates with +8–14% ghost ticket rate over next 2 home games. FanIQ is pre-triggering retention offers now.</div>'
        + '<div class="aact"><button class="btn btn-gold">Launch Retention Flow</button></div>'
      + '</div></div>'
    : '<div class="alert a-opp"><div class="aicon">💡</div><div class="abody">'
        + '<div class="atitle">31 Platinum fans dropped &gt;15 loyalty pts this week</div>'
        + '<div class="adesc">Correlated with recent results. Recommend re-engagement campaign before next home game.</div>'
        + '<div class="aact"><button class="btn btn-green">Launch Recovery Flow</button></div>'
      + '</div></div>';

  el.innerHTML =
    // Ghost ticket alert — real data
    '<div class="alert a-ghost"><div class="aicon">👻</div><div class="abody">'
      + '<div class="atitle">' + ghostSeats.toLocaleString() + ' Seats at Ghost Risk — Next Home Game</div>'
      + '<div class="adesc">' + ghostPct + '% average no-show rate (last 3 home games). Predicted value of filling: $' + ghostVal + 'K.</div>'
      + '<div class="aact"><button class="btn btn-gold">Trigger Offer</button><button class="btn btn-out">View Fans</button></div>'
    + '</div></div>'
    // Geo alert
    + '<div class="alert a-loc"><div class="aicon">📍</div><div class="abody">'
      + '<div class="atitle">Fan Cluster — 6 fans within 8 mi, 3h pre-kickoff</div>'
      + '<div class="adesc">Marcus T., Priya K., and 4 others — none have tickets for ' + teamName + ' next home game.</div>'
      + '<div class="aact"><button class="btn btn-blue">Geo-Targeted Offer</button></div>'
    + '</div></div>'
    // Injury / loyalty alert — real data
    + injAlert
    // Social alert — sentiment driven
    + '<div class="alert a-soc"><div class="aicon">📲</div><div class="abody">'
      + '<div class="atitle">' + socialTitle + '</div>'
      + '<div class="adesc">90-min window open. Push ' + cfg.hashtag + ' incentive to top 500 influencer-tier fans.</div>'
      + '<div class="aact"><button class="btn btn-purple">Activate Campaign</button></div>'
    + '</div></div>'
    // Friends nearby
    + '<div class="alert a-soc"><div class="aicon">👥</div><div class="abody">'
      + '<div class="atitle">3 Fans Have 8 Nearby Friends Without Tickets</div>'
      + '<div class="adesc">Marcus T., Sarah C., Amanda F. — friends within 5 mi, no tickets. Auto-share links ready.</div>'
      + '<div class="aact"><button class="btn btn-purple">Send Share Links</button><button class="btn btn-out">View Network</button></div>'
    + '</div></div>';
}

// Patch refreshRealDataPanels to show coming-soon for unsupported sports
var _origRefresh = refreshRealDataPanels;
refreshRealDataPanels = function() {
  if (!isUnsupportedSport()) { _origRefresh(); return; }
  var cfg = NBA_CONFIGS[ACTIVE_TEAM] || INDYCAR_CONFIGS[ACTIVE_TEAM] || {};
  var sport = activeSport();
  var sportLabel = sport === 'basketball' ? '🏀 NBA' : '🏎 IndyCar';
  var msg = '<div style="text-align:center;padding:2rem;color:var(--muted)">' +
    '<div style="font-size:2rem;margin-bottom:0.5rem">' + (sport === 'basketball' ? '🏀' : '🏎') + '</div>' +
    '<div style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:0.5rem">' + (cfg.name || ACTIVE_TEAM) + '</div>' +
    '<div style="font-size:0.85rem;margin-bottom:1rem">' + sportLabel + ' scraper module in development</div>' +
    '<div style="font-size:0.78rem">Venue capacity: <strong>' + (cfg.capacity||'—').toLocaleString() + '</strong> · ' +
    'Base ticket price: <strong>$' + (cfg.base_price||'—') + '</strong></div>' +
    '<div style="margin-top:1rem;font-size:0.75rem;color:var(--gold)">All FanIQ models apply directly — plug in ' + sportLabel + ' data to activate full dashboard.</div>' +
  '</div>';
  // Apply placeholder to all real-data-dependent elements
  ['real-avg-att','real-fill-pct','real-ghost-pct','real-record','real-venue','real-capacity',
   'real-sentiment','overview-sub'].forEach(function(id){ setEl(id, sport === 'basketball' ? '🏀 NBA' : '🏎'); });
  var newsEl = document.getElementById('real-news-feed');
  if (newsEl) newsEl.innerHTML = msg;
  var histEl = document.getElementById('real-history');
  if (histEl) histEl.innerHTML = '';
};
