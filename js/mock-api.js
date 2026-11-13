/* AstroQuest — in-browser mock backend.
 * Replaces ASP.NET Core + SQL Server for the frontend-only build.
 * Every page keeps calling fetch('/api/...') exactly as before; this file intercepts those calls,
 * runs the same rules as Services/*.cs (XP, ranks, badges, quiz grading, rocket + budget validation)
 * and keeps the data in localStorage so it survives reloads.
 */
(function () {
  'use strict';
  var SEED = window.AQ_SEED;
  var realFetch = window.fetch.bind(window);
  var LS_KEY = 'aq_db_v1';

  // ---------- storage ----------
  var mem = null;
  function load() {
    if (mem) return mem;
    try { var raw = localStorage.getItem(LS_KEY); if (raw) mem = JSON.parse(raw); } catch (_) { mem = null; }
    if (!mem) mem = fresh();
    return mem;
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(mem)); } catch (_) { } }
  function fresh() {
    var now = new Date().toISOString();
    var db = {
      users: [
        { id: 'u-admin', email: 'admin@astroquest.local', password: 'Admin@12345', displayName: 'Admin', joinedAt: now, isAdmin: true, locked: false },
        { id: 'u-nova', email: 'nova@demo.local', password: 'demo123', displayName: 'Nova', joinedAt: now, isAdmin: false, locked: false },
        { id: 'u-orion', email: 'orion@demo.local', password: 'demo123', displayName: 'Orion', joinedAt: now, isAdmin: false, locked: false }
      ],
      session: null,
      progress: { 'u-nova': 230, 'u-orion': 95 },
      quizAttempts: [
        { userId: 'u-nova', score: 9, total: 10, percent: 90, at: now },
        { userId: 'u-orion', score: 7, total: 10, percent: 70, at: now }
      ],
      missions: [{ userId: 'u-nova', score: 84, at: now }],
      explorations: [{ userId: 'u-nova', planet: 'Mars', at: now }, { userId: 'u-nova', planet: 'Moon', at: now }],
      rockets: [{ userId: 'u-nova', destination: 'Moon', parts: 'cap,svc,s2,s1,bst,lndr', mass: 0, success: true, at: now }],
      badges: [{ userId: 'u-nova', code: 'first-launch', at: now }, { userId: 'u-nova', code: 'moon-landing', at: now }, { userId: 'u-nova', code: 'moon-commander', at: now }],
      questions: JSON.parse(JSON.stringify(SEED.quizQuestions)),
      nextQ: SEED.quizQuestions.length + 1,
      nextU: 1
    };
    db.rockets[0].mass = SEED.rocketParts.filter(function (p) { return 'cap,svc,s2,s1,bst,lndr'.indexOf(p.code) >= 0; }).reduce(function (a, p) { return a + p.weightKg; }, 0);
    return db;
  }

  // ---------- rules (ScoreService / BadgeService) ----------
  var PILOT = 200, COMMANDER = 500, EXPLORE_XP = 5, FIRST_LANDING_XP = 25;
  function rank(xp) { return xp >= COMMANDER ? 'Commander' : xp >= PILOT ? 'Pilot' : 'Cadet'; }
  function nextRank(xp) { return xp < PILOT ? PILOT : xp < COMMANDER ? COMMANDER : null; }
  var BADGES = {
    'first-launch': { code: 'first-launch', icon: '🚀', name: 'First Launch', description: 'Launched your first rocket from the Rocket Lab.' },
    'moon-landing': { code: 'moon-landing', icon: '🌕', name: 'Moon Landing', description: 'Landed a rocket on the Moon.' },
    'quiz-ace': { code: 'quiz-ace', icon: '🧠', name: 'Quiz Ace', description: 'Scored 100% in a space quiz.' },
    'explorer': { code: 'explorer', icon: '🪐', name: 'Solar Explorer', description: 'Explored 8 worlds in the 3D solar system.' },
    'moon-commander': { code: 'moon-commander', icon: '🛰️', name: 'Moon Commander', description: 'Finished the Moon Base mission with a score of 80% or more.' }
  };
  function xpOf(uid) { return load().progress[uid] || 0; }
  function addXp(uid, xp) { var db = load(); db.progress[uid] = (db.progress[uid] || 0) + xp; save(); return db.progress[uid]; }
  function award(uid, codes) {
    var db = load(), fresh_ = [];
    codes.forEach(function (c) {
      if (!BADGES[c]) return;
      if (db.badges.some(function (b) { return b.userId === uid && b.code === c; })) return;
      db.badges.push({ userId: uid, code: c, at: new Date().toISOString() });
      fresh_.push(BADGES[c]);
    });
    save();
    return fresh_;
  }
  function badgesOf(uid) { return load().badges.filter(function (b) { return b.userId === uid; }).map(function (b) { return BADGES[b.code]; }).filter(Boolean); }
  function me() { var db = load(); return db.session ? db.users.find(function (u) { return u.id === db.session; }) || null : null; }
  function userById(id) { return load().users.find(function (u) { return u.id === id; }); }

  // ---------- responses ----------
  function json(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } }); }
  function bad(error) { return json({ error: error }, 400); }
  function unauth() { return json({ error: 'Login required.' }, 401); }
  function notFound() { return json({ error: 'Not found' }, 404); }
  function body(init) { try { return init && init.body ? JSON.parse(init.body) : {}; } catch (_) { return {}; } }

  // ---------- routing ----------
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/') !== 0) return realFetch(input, init);
    try { return Promise.resolve(route(new URL(url, 'http://aq.local'), init || {})); }
    catch (e) { return Promise.resolve(json({ error: String(e) }, 500)); }
  };

  function route(u, init) {
    var p = u.pathname, m = (init.method || 'GET').toUpperCase(), db = load(), user = me();

    // ----- content -----
    if (p === '/api/planets') return json(SEED.planets);
    if (p.indexOf('/api/planets/') === 0) { var pl = SEED.planets.find(function (x) { return x.name === decodeURIComponent(p.slice(13)); }); return pl ? json(pl) : notFound(); }
    if (p === '/api/moons') return json(SEED.moons);
    if (p === '/api/cosmic') return json(SEED.cosmic);
    if (p === '/api/rocket-parts') return json(SEED.rocketParts);
    if (p === '/api/health') return json({ database: 'connected (browser mock)', planets: SEED.planets.length, quizQuestions: db.questions.length, users: db.users.length, chatbotConfigured: false });

    // ----- quiz -----
    if (p === '/api/quiz/topics') {
      var cnt = {}; db.questions.filter(function (q) { return q.isActive; }).forEach(function (q) { cnt[q.topic] = (cnt[q.topic] || 0) + 1; });
      return json(Object.keys(cnt).sort().map(function (t) { return { topic: t, count: cnt[t] }; }));
    }
    if (p === '/api/quiz/random') {
      var count = Math.min(20, Math.max(1, +u.searchParams.get('count') || 10)), topic = u.searchParams.get('topic');
      var pool = db.questions.filter(function (q) { return q.isActive && (!topic || q.topic === topic); }).slice();
      for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      return json(pool.slice(0, count).map(function (q) { return { id: q.id, text: q.text, options: q.options }; }));
    }
    if (p === '/api/quiz/check' && m === 'POST') {
      var b = body(init), q = db.questions.find(function (x) { return x.id === b.questionId && x.isActive; });
      if (!q) return notFound();
      return json({ correct: b.selectedIndex === q.correctIndex, correctIndex: q.correctIndex, explanation: q.explanation });
    }
    if (p === '/api/quiz/submit' && m === 'POST') {
      var ans = (body(init).answers || []), seen = {}, graded = [];
      ans.forEach(function (a) { if (seen[a.questionId]) return; var qq = db.questions.find(function (x) { return x.id === a.questionId; }); if (qq) { seen[a.questionId] = 1; graded.push({ q: qq, a: a }); } });
      if (!graded.length) return bad('No valid answers submitted.');
      var score = graded.filter(function (g) { return g.q.correctIndex === g.a.selectedIndex; }).length, total = graded.length, percent = Math.round(score * 100 / total);
      if (!user) return json({ score: score, total: total, percent: percent, saved: false, xpEarned: 0, totalXp: 0, rank: 'Cadet', newBadges: [] });
      db.quizAttempts.push({ userId: user.id, score: score, total: total, percent: percent, at: new Date().toISOString() });
      var nb = percent === 100 ? award(user.id, ['quiz-ace']) : [];
      var totalXp = addXp(user.id, score * 10);
      return json({ score: score, total: total, percent: percent, saved: true, xpEarned: score * 10, totalXp: totalXp, rank: rank(totalXp), newBadges: nb });
    }

    // ----- leaderboard -----
    if (p === '/api/leaderboard/quiz' || p === '/api/leaderboard/mission') {
      var top = Math.min(50, Math.max(1, +u.searchParams.get('top') || 10));
      var rowsSrc = p.endsWith('quiz') ? db.quizAttempts.map(function (a) { return { userId: a.userId, v: a.percent }; }) : db.missions.map(function (a) { return { userId: a.userId, v: a.score }; });
      var agg = {}; rowsSrc.forEach(function (r) { var g = agg[r.userId] || (agg[r.userId] = { userId: r.userId, best: 0, attempts: 0 }); g.best = Math.max(g.best, r.v); g.attempts++; });
      var rows = Object.values(agg).sort(function (a, b) { return b.best - a.best || a.attempts - b.attempts || (a.userId < b.userId ? -1 : 1); }).slice(0, top);
      return json(rows.map(function (r, i) { var uu = userById(r.userId); return { position: i + 1, displayName: uu ? uu.displayName : 'Astronaut', rank: rank(xpOf(r.userId)), bestScore: r.best, attempts: r.attempts }; }));
    }

    // ----- mission (auth) -----
    if (p === '/api/mission/moon' && m === 'POST') {
      if (!user) return unauth();
      var r = body(init), lk = {}; Object.keys(r).forEach(function (k) { lk[k.toLowerCase()] = r[k]; });
      var levels = ['o2', 'pwr', 'food', 'h2o', 'hp'].map(function (k) { return Number(lk[k]); });
      if (levels.some(function (v) { return isNaN(v) || v <= 0 || v > 100; })) return bad('A completed mission must finish with every resource between 1 and 100.');
      var ms = Math.round(levels.reduce(function (a, b) { return a + b; }, 0) / 5);
      db.missions.push({ userId: user.id, score: ms, at: new Date().toISOString() });
      var nb2 = ms >= 80 ? award(user.id, ['moon-commander']) : [];
      var mxp = Math.round(ms / 2), tx = addXp(user.id, mxp);
      var best = Math.max.apply(null, db.missions.filter(function (x) { return x.userId === user.id; }).map(function (x) { return x.score; }));
      return json({ score: ms, bestScore: best, xpEarned: mxp, totalXp: tx, rank: rank(tx), newBadges: nb2 });
    }

    // ----- progress (auth) -----
    if (p === '/api/progress/me') {
      if (!user) return unauth();
      var xp = xpOf(user.id);
      return json({ displayName: user.displayName, rank: rank(xp), totalXp: xp, nextRankXp: nextRank(xp), bestQuizPercent: maxOf(db.quizAttempts, user.id, 'percent'), bestMissionScore: maxOf(db.missions, user.id, 'score'), exploredPlanets: db.explorations.filter(function (e) { return e.userId === user.id; }).map(function (e) { return e.planet; }) });
    }
    if (p === '/api/progress/badges') { if (!user) return unauth(); return json(badgesOf(user.id)); }
    if (p === '/api/progress/explore' && m === 'POST') {
      if (!user) return unauth();
      var pn = body(init).planet, planet = SEED.planets.find(function (x) { return x.name === pn; });
      if (!planet) return notFound();
      if (db.explorations.some(function (e) { return e.userId === user.id && e.planet === planet.name; })) { var xn = xpOf(user.id); return json({ isNew: false, xpEarned: 0, totalXp: xn, rank: rank(xn), newBadges: [] }); }
      db.explorations.push({ userId: user.id, planet: planet.name, at: new Date().toISOString() });
      var explored = db.explorations.filter(function (e) { return e.userId === user.id; }).length;
      var nb3 = explored >= 8 ? award(user.id, ['explorer']) : [];
      var tx2 = addXp(user.id, EXPLORE_XP);
      return json({ isNew: true, xpEarned: EXPLORE_XP, totalXp: tx2, rank: rank(tx2), newBadges: nb3 });
    }

    // ----- rocket lab -----
    if (p === '/api/rocket/launch' && m === 'POST') {
      var rq = body(init), codes = [];
      (rq.parts || []).forEach(function (c) { c = String(c || '').trim(); if (c && codes.indexOf(c) < 0 && codes.length < 20) codes.push(c); });
      if (!codes.length) return bad('Select the rocket components first.');
      var chosen = SEED.rocketParts.filter(function (x) { return codes.indexOf(x.code) >= 0; });
      if (chosen.length !== codes.length) return bad('Unknown rocket component.');
      var missing = SEED.rocketParts.filter(function (x) { return x.isRequired && codes.indexOf(x.code) < 0; }).map(function (x) { return x.name; });
      if (missing.length) return bad('Missing required components: ' + missing.join(', '));
      var dest = String(rq.destination || '').trim();
      if (!dest || dest === 'Sun' || dest === 'Earth') return bad('Choose a destination.');
      var dp = SEED.planets.find(function (x) { return x.name === dest; });
      if (!dp) return bad('Unknown destination.');
      var outcome = dp.travelStatus === 'yes' ? 'landed' : dp.travelStatus === 'future' ? 'future' : 'unsafe', landed = outcome === 'landed';
      var mass = chosen.reduce(function (a, x) { return a + x.weightKg; }, 0);
      var base = { landed: landed, outcome: outcome, destination: dp.name, message: dp.travelNote, requirements: dp.requirements || [], totalMassKg: mass };
      if (!user) return json(Object.assign(base, { saved: false, xpEarned: 0, totalXp: 0, rank: 'Cadet', newBadges: [] }));
      var firstLanding = landed && !db.rockets.some(function (x) { return x.userId === user.id && x.destination === dp.name && x.success; });
      db.rockets.push({ userId: user.id, destination: dp.name, parts: codes.join(','), mass: mass, success: landed, at: new Date().toISOString() });
      var earned = ['first-launch']; if (landed && dp.name === 'Moon') earned.push('moon-landing');
      var nb4 = award(user.id, earned);
      var rxp = firstLanding ? FIRST_LANDING_XP : 0, tx3 = addXp(user.id, rxp);
      return json(Object.assign(base, { saved: true, xpEarned: rxp, totalXp: tx3, rank: rank(tx3), newBadges: nb4 }));
    }
    if (p === '/api/rocket/mine') {
      if (!user) return unauth();
      return json(db.rockets.filter(function (x) { return x.userId === user.id; }).sort(function (a, b) { return b.at < a.at ? -1 : 1; }).slice(0, 10)
        .map(function (x) { return { destination: x.destination, success: x.success, totalMassKg: x.mass, partCount: x.parts.split(',').length, launchedAt: x.at }; }));
    }

    // ----- budget -----
    if (p === '/api/budget/options') return json({ destinations: BUDGET.destinations, vehicles: BUDGET.vehicles });
    if (p === '/api/budget/plan' && m === 'POST') { var bp = budgetPlan(body(init)); return bp.error ? bad(bp.error) : json(bp.result); }

    // ----- NASA proxy -----
    if (p.indexOf('/api/nasa/') === 0) return nasa(p.slice(10), u.searchParams);

    // ----- chat -----
    if (p === '/api/chat' && m === 'POST') return json({ reply: astroReply(body(init).messages || [], user) });

    return notFound();
  }
  function maxOf(list, uid, key) { return list.filter(function (x) { return x.userId === uid; }).reduce(function (a, x) { return Math.max(a, x[key]); }, 0); }

  // ---------- BudgetService ----------
  var BUDGET = {
    destinations: [
      { code: 'leo', name: 'Low Earth Orbit', emoji: '🛰️', travelDays: 1, transferFactor: 1.0, note: 'Space-station class missions. Cheapest orbit to reach.' },
      { code: 'moon', name: 'Moon', emoji: '🌕', travelDays: 4, transferFactor: 3.2, note: 'Needs a lander and a return stage. Short trip, high mass cost.' },
      { code: 'mars', name: 'Mars', emoji: '🔴', travelDays: 210, transferFactor: 6.5, note: 'Long transfer, heavy life support, narrow launch windows.' },
      { code: 'venus', name: 'Venus Orbit', emoji: '🟡', travelDays: 150, transferFactor: 5.2, note: 'Orbiter-only. Surface landings are not survivable for long.' },
      { code: 'jupiter', name: 'Jupiter System', emoji: '🟠', travelDays: 2000, transferFactor: 10.5, note: 'Very high energy. Usually robotic, extremely long duration.' }
    ],
    vehicles: [
      { code: 'medium', name: 'Reusable Medium-Lift', leoCapacityKg: 22800, usdPerKgLeo: 2700, note: 'Reusable first stage. Low price per kg, limited capacity.' },
      { code: 'heavy', name: 'Reusable Heavy-Lift', leoCapacityKg: 63800, usdPerKgLeo: 1700, note: 'Side boosters recover. Best price per kg for large payloads.' },
      { code: 'super', name: 'Expendable Super-Heavy', leoCapacityKg: 95000, usdPerKgLeo: 9500, note: 'Highest capacity, single use. Costly but fits anything.' }
    ]
  };
  function budgetPlan(req) {
    var dest = BUDGET.destinations.find(function (d) { return d.code === String(req.destination || '').trim().toLowerCase(); });
    if (!dest) return { error: 'Unknown destination.' };
    var veh = BUDGET.vehicles.find(function (v) { return v.code === String(req.vehicle || '').trim().toLowerCase(); });
    if (!veh) return { error: 'Unknown launch vehicle.' };
    var crew = +req.crew || 0, md = +req.missionDays || 0, pay = +req.payloadKg || 0, con = +req.contingencyPercent || 0, bud = +req.budgetUsd || 0;
    if (crew < 0 || crew > 8) return { error: 'Crew must be between 0 and 8.' };
    if (md < 1 || md > 1100) return { error: 'Mission length must be between 1 and 1100 days.' };
    if (pay < 100 || pay > 60000) return { error: 'Payload must be between 100 and 60000 kg.' };
    if (con < 0 || con > 60) return { error: 'Contingency must be between 0 and 60%.' };
    if (bud < 0) return { error: 'Budget cannot be negative.' };
    var days = Math.max(md, dest.travelDays), r = { crew: crew, pay: pay, con: con, bud: bud };
    var result = build(r, dest, veh, days);
    result.alternatives = BUDGET.vehicles.map(function (v) { var x = build(r, dest, v, days); return { code: v.code, name: v.name, fits: x.fitsVehicle, totalUsd: x.totalUsd }; });
    return { result: result };
  }
  function build(r, dest, veh, days) {
    var habitat = r.crew * 1500, consumables = r.crew * days * 20, totalMass = r.pay + habitat + consumables;
    var launchMass = Math.ceil(totalMass * dest.transferFactor), fits = launchMass <= veh.leoCapacityKg, launches = Math.max(1, Math.ceil(launchMass / veh.leoCapacityKg));
    var launchCost = launchMass * veh.usdPerKgLeo, spacecraft = r.pay * 25000, training = r.crew * 5000000, ops = days * 400000 + r.crew * days * 150000;
    var subtotal = launchCost + spacecraft + training + ops, insurance = Math.round(subtotal * 0.06), contingency = Math.round((subtotal + insurance) * (r.con / 100)), total = subtotal + insurance + contingency;
    var margin = r.bud - total, within = r.bud > 0 && margin >= 0;
    var s = 40; if (fits) s += 25; if (within) s += 20; if (within && total > 0) { var slack = margin / total; if (slack >= 0.05 && slack <= 0.4) s += 5; } s += Math.min(10, Math.floor(r.con / 3)); s = Math.max(0, Math.min(100, s));
    var tips = [], N = function (n) { return n.toLocaleString(); };
    if (!fits) tips.push('Launch mass ' + N(launchMass) + ' kg exceeds ' + veh.name + ' capacity (' + N(veh.leoCapacityKg) + ' kg). Choose a bigger vehicle or cut payload.');
    if (r.con < 15) tips.push('Contingency under 15% is risky. Real missions usually carry 20–30%.');
    if (r.crew > 0 && days > 365) tips.push('A crewed mission over a year needs closed-loop life support, which this estimate does not price in full.');
    if (r.bud > 0 && !within) tips.push('You are $' + N(-margin) + ' over budget. Reduce payload, crew or duration to close the gap.');
    if (within && margin > total * 0.5) tips.push('Large unused budget. You can raise contingency or add redundancy.');
    if (launches > 1) tips.push('This needs ' + launches + ' launches. Each extra launch adds assembly risk in orbit.');
    var verdict = !fits ? 'Vehicle too small' : r.bud === 0 ? 'Estimate only' : within ? (s >= 80 ? 'Mission approved' : 'Approved with risk') : 'Over budget';
    return { destination: dest.name, vehicle: veh.name, totalMassKg: totalMass, launchMassKg: launchMass, capacityKg: veh.leoCapacityKg, fitsVehicle: fits,
      lines: [{ label: 'Launch (' + launches + '× ' + veh.name + ')', usd: launchCost }, { label: 'Spacecraft & payload build', usd: spacecraft }, { label: 'Crew training', usd: training }, { label: 'Mission operations & crew support', usd: ops }, { label: 'Insurance', usd: insurance }, { label: 'Contingency (' + r.con + '%)', usd: contingency }],
      totalUsd: total, budgetUsd: r.bud, marginUsd: margin, withinBudget: within, score: s, verdict: verdict, tips: tips, alternatives: [] };
  }

  // ---------- NASA (direct call when online, built-in sample when blocked/offline) ----------
  var NASA_KEY = window.AQ_NASA_KEY || 'DEMO_KEY';
  function nasa(kind, sp) {
    var url = null, today = new Date().toISOString().slice(0, 10);
    if (kind === 'apod') url = 'https://api.nasa.gov/planetary/apod?api_key=' + NASA_KEY;
    else if (kind === 'neo') { var d = sp.get('date') || today; url = 'https://api.nasa.gov/neo/rest/v1/feed?start_date=' + d + '&end_date=' + d + '&api_key=' + NASA_KEY; }
    else if (kind === 'mars-photos') url = 'https://api.nasa.gov/mars-photos/api/v1/rovers/perseverance/latest_photos?api_key=' + NASA_KEY;
    else if (kind === 'iss') url = 'https://api.wheretheiss.at/v1/satellites/25544';
    else if (kind === 'events') url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=300';
    else if (kind === 'images') { var q = (sp.get('q') || '').trim(); if (q.length < 2 || q.length > 100) return bad('Query must be 2-100 characters.'); url = 'https://images-api.nasa.gov/search?q=' + encodeURIComponent(q) + '&media_type=image&page_size=' + Math.min(12, Math.max(1, +sp.get('size') || 6)); }
    else return notFound();
    if (window.AQ_OFFLINE) return json(sample(kind, sp));
    return realFetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { if (kind === 'iss') j = { message: 'success', timestamp: j.timestamp, iss_position: { latitude: String(j.latitude), longitude: String(j.longitude) } }; return json(j); })
      .catch(function () { return json(sample(kind, sp)); });
  }
  function sample(kind, sp) {
    var today = new Date().toISOString().slice(0, 10);
    if (kind === 'apod') return { date: today, title: 'Offline sample — NASA Astronomy Picture of the Day', media_type: 'other', explanation: 'This is a built-in placeholder shown when api.nasa.gov cannot be reached from this page (no internet, or the page is hosted where outside requests are blocked). Open the frontend from your own computer with internet to see the real picture of the day.' };
    if (kind === 'neo') { var o = {}; o[today] = [
      { name: '(Sample) 2026 AQ1', estimated_diameter: { meters: { estimated_diameter_max: 120 } }, close_approach_data: [{ miss_distance: { kilometers: '4200000' } }] },
      { name: '(Sample) 2026 AQ2', estimated_diameter: { meters: { estimated_diameter_max: 45 } }, close_approach_data: [{ miss_distance: { kilometers: '910000' } }] },
      { name: '(Sample) 2026 AQ3', estimated_diameter: { meters: { estimated_diameter_max: 310 } }, close_approach_data: [{ miss_distance: { kilometers: '18500000' } }] }]; return { element_count: 3, near_earth_objects: o }; }
    if (kind === 'mars-photos') return { latest_photos: [] };
    if (kind === 'iss') { var t = Date.now() / 1000, lat = 51.6 * Math.sin(t / 5560 * 2 * Math.PI), lon = ((t / 5560 * 360 - t / 86400 * 360) % 360 + 540) % 360 - 180; return { message: 'success (simulated)', iss_position: { latitude: lat.toFixed(4), longitude: lon.toFixed(4) } }; }
    if (kind === 'events') return { title: 'EONET sample', events: [
      { id: 'S1', title: 'Sample: Tropical Cyclone (Bay of Bengal)', link: 'https://eonet.gsfc.nasa.gov', categories: [{ id: 'severeStorms', title: 'Severe Storms' }], geometry: [{ date: today, type: 'Point', coordinates: [88.5, 14.2], magnitudeValue: 45, magnitudeUnit: 'kts' }, { date: today, type: 'Point', coordinates: [89.6, 17.1], magnitudeValue: 60, magnitudeUnit: 'kts' }] },
      { id: 'S2', title: 'Sample: Wildfire (California)', link: 'https://eonet.gsfc.nasa.gov', categories: [{ id: 'wildfires', title: 'Wildfires' }], geometry: [{ date: today, type: 'Point', coordinates: [-121.3, 38.9] }] },
      { id: 'S3', title: 'Sample: Volcano (Etna)', link: 'https://eonet.gsfc.nasa.gov', categories: [{ id: 'volcanoes', title: 'Volcanoes' }], geometry: [{ date: today, type: 'Point', coordinates: [15.0, 37.75] }] },
      { id: 'S4', title: 'Sample: Flood (Assam)', link: 'https://eonet.gsfc.nasa.gov', categories: [{ id: 'floods', title: 'Floods' }], geometry: [{ date: today, type: 'Point', coordinates: [92.9, 26.2] }] }] };
    if (kind === 'images') return { collection: { items: [] } };
    return {};
  }

  // ---------- "Astro" chatbot (offline, grounded in the seed data) ----------
  function astroReply(messages, user) {
    var last = (messages[messages.length - 1] || {}).content || '', q = last.toLowerCase();
    var hit = SEED.planets.find(function (p) { return q.indexOf(p.name.toLowerCase()) >= 0; });
    var stats = function (s) { return (s || []).map(function (x) { return x.label + ': ' + x.value; }).join(' · '); };
    if (hit) return hit.emoji + ' ' + hit.name + ' — ' + hit.description + ' ' + stats(hit.stats) + '. Can we land there? ' + (hit.travelStatus === 'yes' ? 'Yes!' : hit.travelStatus === 'future' ? 'Not yet, but maybe soon.' : 'No.') + ' ' + hit.travelNote + ' (Source: ' + hit.source + ')';
    var cos = SEED.cosmic.find(function (c) { return q.indexOf(c.name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()) >= 0 || q.indexOf(c.name.toLowerCase()) >= 0; });
    if (cos) return cos.emoji + ' ' + cos.name.replace(/([a-z])([A-Z])/g, '$1 $2') + ' (' + cos.type + ') — ' + cos.description + ' ' + stats(cos.stats) + '. (Source: ' + cos.source + ')';
    if (/rocket|launch|how do rockets/.test(q)) return 'Rockets work by Newton\u2019s third law: burning fuel shoots hot gas out of the back at high speed, and the rocket is pushed the other way. Try the Rocket Lab — every required part (capsule, service module, both stages, booster, lander) must be on board before Mission Control lets you launch!';
    if (/xp|rank|badge|cadet|pilot|commander/.test(q)) return 'You earn XP by exploring worlds (+5 each), finishing quizzes (+10 per correct answer), landing rockets (+25 first landing) and Moon Base missions. 200 XP makes you a Pilot, 500 XP a Commander. Badges: First Launch, Moon Landing, Quiz Ace, Solar Explorer and Moon Commander.';
    if (/quiz/.test(q)) return 'The Space Quiz has 5 topics — Planets, Sun, Moon, Deep Space and Missions — 10 random questions each. Log in and your best score goes to the Leaderboard.';
    if (/hello|hi\b|hey/.test(q)) return 'Hello' + (user ? ' ' + user.displayName : '') + '! Ask me about any planet, the Sun, the Moon, black holes, pulsars, rockets or how AstroQuest works.';
    return 'I\u2019m running in offline demo mode (no AI API key in this frontend-only build), so I can only answer from the AstroQuest database: ask me about a planet (e.g. “Tell me about Mars”), a deep-space object (black hole, pulsar, nebula, quasar), rockets, quizzes or XP and ranks.';
  }

  // ---------- accounts (replaces ASP.NET Identity) ----------
  window.AQMock = {
    me: function () { var u = me(); if (!u) return { auth: false, admin: false, name: '', rank: 'Cadet', xp: 0 }; var xp = xpOf(u.id); return { auth: true, admin: !!u.isAdmin, name: u.displayName, rank: rank(xp), xp: xp, email: u.email, id: u.id }; },
    register: function (name, email, pw, pw2) {
      var db = load(); name = (name || '').trim(); email = (email || '').trim().toLowerCase();
      if (name.length < 2 || name.length > 50) return 'Astronaut name must be 2–50 characters.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Enter a valid email address.';
      if ((pw || '').length < 6) return 'Password must be at least 6 characters.';
      if (pw !== pw2) return 'Passwords do not match.';
      if (db.users.some(function (u) { return u.email === email; })) return 'An account with this email already exists.';
      var id = 'u' + Date.now().toString(36) + (db.nextU++); db.users.push({ id: id, email: email, password: pw, displayName: name, joinedAt: new Date().toISOString(), isAdmin: false, locked: false }); db.session = id; save(); return null;
    },
    login: function (email, pw) {
      var db = load(); email = (email || '').trim().toLowerCase(); var u = db.users.find(function (x) { return x.email === email; });
      if (!u || u.password !== pw) return 'Invalid email or password.';
      if (u.locked) return 'This account is locked. Ask an admin to unlock it.';
      db.session = u.id; save(); return null;
    },
    logout: function () { var db = load(); db.session = null; save(); },
    profile: function () {
      var u = me(); if (!u) return null; var db = load(), xp = xpOf(u.id);
      return { displayName: u.displayName, email: u.email, joinedAt: u.joinedAt, xp: xp, rank: rank(xp), nextRankXp: nextRank(xp), totalPlanets: SEED.planets.length,
        bestQuizPercent: maxOf(db.quizAttempts, u.id, 'percent'), bestMissionScore: maxOf(db.missions, u.id, 'score'),
        exploredPlanets: db.explorations.filter(function (e) { return e.userId === u.id; }).map(function (e) { return e.planet; }),
        recentQuizzes: db.quizAttempts.filter(function (a) { return a.userId === u.id; }).slice(-8).reverse(),
        badges: badgesOf(u.id),
        launches: db.rockets.filter(function (x) { return x.userId === u.id; }).slice(-5).reverse().map(function (x) { return { destination: x.destination, success: x.success, totalMassKg: x.mass, launchedAt: x.at }; }) };
    },
    // admin
    admin: {
      dashboard: function () { var db = load(); return { users: db.users.length, admins: db.users.filter(function (u) { return u.isAdmin; }).length, planets: SEED.planets.length, questions: db.questions.length, active: db.questions.filter(function (q) { return q.isActive; }).length, quizAttempts: db.quizAttempts.length, missions: db.missions.length, newest: db.users.slice(-5).reverse().map(userRow) }; },
      users: function () { return load().users.map(userRow); },
      toggleAdmin: function (id) { var u = userById(id); if (u) { u.isAdmin = !u.isAdmin; save(); } },
      toggleLock: function (id) { var u = userById(id); if (u) { u.locked = !u.locked; save(); } },
      questions: function () { return load().questions; },
      saveQuestion: function (q) { var db = load(); if (q.id) { var i = db.questions.findIndex(function (x) { return x.id === q.id; }); if (i >= 0) db.questions[i] = q; } else { q.id = db.nextQ++; db.questions.push(q); } save(); },
      toggleQuestion: function (id) { var q = load().questions.find(function (x) { return x.id === id; }); if (q) { q.isActive = !q.isActive; save(); } },
      deleteQuestion: function (id) { var db = load(); db.questions = db.questions.filter(function (x) { return x.id !== id; }); save(); }
    },
    reset: function () { mem = fresh(); save(); }
  };
  function userRow(u) { var xp = xpOf(u.id); return { id: u.id, displayName: u.displayName, email: u.email, joinedAt: u.joinedAt, xp: xp, rank: rank(xp), isAdmin: !!u.isAdmin, isLocked: !!u.locked }; }

  // window.AQ — what _AqHead.cshtml used to render server-side
  window.AQ = window.AQMock.me();

  // Navigation helper (file links locally; hash links inside the single-file bundle)
  window.aqHref = function (page) { return page; }; // inside the single-file bundle a click handler turns x.html into #x
  window.aqGo = function (page) { if (window.AQ_BUNDLE) { parent.location.hash = page.replace(/\.html(\?|#|$)/, '$1'); } else { location.href = page; } };

  // Nav chips — what _NavAuth.cshtml used to render
  document.addEventListener('DOMContentLoaded', function () {
    var slot = document.getElementById('aqNavAuth'); if (!slot) return;
    var a = window.AQ, h = '<a href="' + aqHref('leaderboard.html') + '" class="nb">🏆 Leaderboard</a>';
    if (a.auth) {
      if (a.admin) h += '<a class="nb" href="' + aqHref('admin.html') + '">Admin</a>';
      h += '<a class="nb" href="' + aqHref('profile.html') + '">👨‍🚀 ' + esc(a.name) + ' · ' + esc(a.rank) + '</a><button type="button" class="nb" id="aqLogout">Logout</button>';
    } else {
      h += '<a class="nb" href="' + aqHref('login.html') + '">Login</a><a class="nb" href="' + aqHref('register.html') + '">Register</a>';
    }
    slot.outerHTML = h;
    var lo = document.getElementById('aqLogout'); if (lo) lo.onclick = function () { AQMock.logout(); aqGo('index.html'); };
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  });
})();
