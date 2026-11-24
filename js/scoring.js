// Scoring engine: turns raw data into a 0–10 rating with human-readable reasons.
import { CORRIDORS } from './resorts.js';
import { holidayFor, isPublicHoliday } from './calendar.js';

export const CATEGORIES = [
  { key: 'snow', label: 'Snow', hint: 'Base depth, fresh snow, surface quality' },
  { key: 'weather', label: 'Weather', hint: 'Sun, visibility, wind, temperature, rain' },
  { key: 'terrain', label: 'Open terrain', hint: 'Share of lifts running and piste km available' },
  { key: 'commute', label: 'Commute', hint: 'Door-to-lift time from Zürich' },
  { key: 'cost', label: 'Cost', hint: 'Day pass + travel per person' },
  { key: 'crowds', label: 'Crowds', hint: 'Estimated from day, holidays, weather and popularity' },
  { key: 'fit', label: 'Terrain fit', hint: 'Steeps & freeride for intermediate–advanced, avalanche situation' },
];

export const DEFAULT_WEIGHTS = { snow: 22, weather: 25, terrain: 13, commute: 15, cost: 8, crowds: 10, fit: 7 };

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (x, x0, x1, y0, y1) => y0 + (y1 - y0) * clamp((x - x0) / (x1 - x0));
const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
const piecewise = (x, pts) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lerp(x, pts[i - 1][0], pts[i][0], pts[i - 1][1], pts[i][1]);
  return pts[pts.length - 1][1];
};
const round = (x, d = 0) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

export function dayType(iso) {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  if (isPublicHoliday(iso)) return 'sat';
  return dow === 6 ? 'sat' : dow === 0 ? 'sun' : 'weekday';
}

const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 864e5);

// ---------- weather summary for the ski day ----------
function idxRange(times, iso, h0, h1) {
  const out = [];
  for (let i = 0; i < times.length; i++) {
    if (!times[i].startsWith(iso)) continue;
    const h = +times[i].slice(11, 13);
    if (h >= h0 && h <= h1) out.push(i);
  }
  return out;
}

export function summarizeDay(w, iso) {
  if (!w?.top?.time) return null;
  const { top, mid } = w;
  const I = idxRange(top.time, iso, 9, 15);
  if (!I.length) return null;
  const pick = (o, k) => I.map((i) => o[k]?.[i]).filter((v) => v != null);
  // fresh snow: from 72h before the ski day until 09:00 that morning
  const startIdx = top.time.findIndex((t) => t.startsWith(iso)) ;
  const morning = startIdx + 9;
  const from = Math.max(0, startIdx - 72);
  const freshTop = sum(top.snowfall.slice(from, morning));
  const freshMid = sum(mid.snowfall.slice(from, morning));
  const overnight = sum(top.snowfall.slice(Math.max(0, startIdx - 9), morning)); // 15:00 the day before -> 09:00
  // melt-freeze: warm afternoons in the 2 days before with little new snow
  const prevWarm = Math.max(-99, ...mid.temperature_2m.slice(Math.max(0, startIdx - 48), startIdx).filter((v) => v != null));
  const hourly = I.map((i) => ({
    h: +top.time[i].slice(11, 13),
    tTop: top.temperature_2m[i], tMid: mid.temperature_2m[i],
    gust: top.wind_gusts_10m[i], wind: top.wind_speed_10m[i],
    cloud: top.cloud_cover[i], snow: top.snowfall[i], rain: mid.rain[i],
    sun: (top.sunshine_duration[i] || 0) / 3600, code: top.weather_code[i], vis: top.visibility[i],
  }));
  const di = w.daily?.time?.indexOf(iso);
  return {
    sunHours: sum(pick(top, 'sunshine_duration')) / 3600,
    cloud: mean(pick(top, 'cloud_cover')),
    visMin: Math.min(...pick(top, 'visibility')) / 1000,
    gustMax: Math.max(...pick(top, 'wind_gusts_10m')),
    windMean: mean(pick(top, 'wind_speed_10m')),
    tTopMin: Math.min(...pick(top, 'temperature_2m')),
    tTopMax: Math.max(...pick(top, 'temperature_2m')),
    tMidMax: Math.max(...pick(mid, 'temperature_2m')),
    tMidMin: Math.min(...pick(mid, 'temperature_2m')),
    snowDuring: sum(pick(top, 'snowfall')),
    rainDuring: sum(pick(mid, 'rain')),
    freezing: mean(pick(top, 'freezing_level_height')),
    fresh72: Math.max(freshTop, freshMid),
    overnight,
    prevWarm,
    hourly,
    sunrise: di >= 0 ? w.daily.sunrise[di]?.slice(11) : null,
    sunset: di >= 0 ? w.daily.sunset[di]?.slice(11) : null,
    // snow expected between now and the ski morning (to project today's report forward)
    snowUntil: (nowIdx) => sum(top.snowfall.slice(Math.max(0, nowIdx), morning)),
    startIdx,
  };
}

export function iconFor(s) {
  if (!s) return 'cloud';
  if (s.rainDuring > 1.5) return 'rain';
  if (s.snowDuring > 2) return 'snow';
  if (s.visMin < 1 && s.sunHours < 2) return 'fog';
  if (s.sunHours >= 5) return 'sun';
  if (s.sunHours >= 2) return 'partly';
  return 'cloud';
}

export function zurichFog(zurich, iso) {
  if (!zurich?.time) return null;
  const I = idxRange(zurich.time, iso, 8, 13);
  if (!I.length) return null;
  const low = mean(I.map((i) => zurich.cloud_cover_low[i]));
  const sun = sum(I.map((i) => zurich.sunshine_duration[i] || 0)) / 3600;
  return { lowCloud: low, sun, foggy: low > 65 && sun < 1.5 };
}

// ---------- resort status from the report ----------
export function reportStatus(c, todayIso) {
  if (!c || !Object.keys(c).length) return { status: 'unknown', note: 'No snow report published yet' };
  const age = c.reportDate ? daysBetween(c.reportDate, todayIso) : null;
  const closedText = /closed|end season/i.test(`${c.operation || ''} ${c.pisteCondition || ''}`);
  let status = 'unknown';
  if (c.liftsOpen > 0) status = 'open';
  else if (c.liftsOpen === 0 || closedText) status = 'closed';
  const lastSnow = /^\d{4}-\d{2}-\d{2}$/.test(c.lastSnowfall || '') ? c.lastSnowfall : null;
  const staleSnow = status !== 'open' && lastSnow && daysBetween(lastSnow, todayIso) > 45;
  const depthRaw = Math.max(c.mountain ?? -1, c.valley ?? -1);
  const depth = staleSnow || depthRaw < 0 ? null : depthRaw;
  return { status, age, depth, staleSnow, lastSnow };
}

// ---------- main scoring ----------
export function scoreResort(r, ctx) {
  const { iso, todayIso, weather, zurich, cond, slf, train, settings, weights } = ctx;
  const W = { ...DEFAULT_WEIGHTS, ...(weights || {}) };
  const s = summarizeDay(weather, iso);
  const rep = reportStatus(cond, todayIso);
  const lead = daysBetween(todayIso, iso);
  const dtype = dayType(iso);
  const holiday = holidayFor(iso);
  const cats = {};

  // ----- Snow -----
  {
    const reasons = [];
    let depth = rep.depth;
    let projected = 0;
    if (depth != null && s && weather?.top?.time) {
      // add forecast snow between the report and the ski morning
      const nowIdx = weather.top.time.findIndex((t) => t.slice(0, 13) >= ctx.nowLocal);
      projected = Math.max(0, s.snowUntil(nowIdx >= 0 ? nowIdx : 0) * 0.7); // settling
      depth += projected;
    }
    const depthS = depth == null ? 0.4 : piecewise(depth, [[0, 0], [20, 0.2], [50, 0.55], [100, 0.85], [160, 1]]);
    const fresh = Math.max(s?.fresh72 ?? 0, lead === 0 ? cond?.fresh ?? 0 : 0);
    const freshS = piecewise(fresh, [[0, 0], [5, 0.3], [15, 0.7], [30, 1]]);
    let adj = 0;
    const condText = (cond?.snowCondition || '').toLowerCase();
    if (depth == null) reasons.push(rep.staleSnow ? 'Snow report is from last season — base depth unknown' : 'No current base depth reported');
    else reasons.push(`${Math.round(depth)} cm base${projected > 3 ? ` (incl. ~${Math.round(projected)} cm still to fall)` : ''}`);
    if (fresh >= 1) reasons.push(`${Math.round(fresh)} cm fresh in the 72 h before`);
    else reasons.push('No fresh snow in the last 3 days');
    if (lead <= 1 && condText) {
      if (/powder/.test(condText)) { adj += 0.08; reasons.push('Reported: powder'); }
      if (/hard|icy|ice/.test(condText)) { adj -= 0.1; reasons.push('Reported: partly hard / icy'); }
      if (/wet|slush/.test(condText)) { adj -= 0.08; reasons.push('Reported: wet snow'); }
    }
    if (s && s.prevWarm > 3 && fresh < 3) { adj -= 0.08; reasons.push('Recent thaw — expect firm, icy morning pistes'); }
    const score = clamp(0.6 * depthS + 0.4 * freshS + adj);
    cats.snow = { score, reasons, value: depth, fresh };
  }

  // ----- Weather -----
  {
    const reasons = [];
    let score = 0.5;
    if (s) {
      const sunS = clamp(s.sunHours / 6);
      const skyS = 0.65 * sunS + 0.35 * (1 - (s.cloud ?? 50) / 100);
      let windS = piecewise(s.gustMax, [[30, 1], [50, 0.7], [70, 0.3], [90, 0]]);
      if (r.windExposed && s.gustMax > 50) windS *= 0.8;
      const tempS = piecewise(s.tMidMax, [[-20, 0.3], [-12, 0.85], [-6, 1], [2, 1], [6, 0.6], [10, 0.3]]);
      let pen = 0;
      if (s.rainDuring > 1) { pen += clamp(s.rainDuring / 6, 0.2, 0.45); reasons.push(`Rain lower down (${round(s.rainDuring, 1)} mm, freezing level ~${Math.round(s.freezing / 100) * 100} m)`); }
      if (s.snowDuring > 4) { pen += 0.1; reasons.push(`Snowing during the day (${Math.round(s.snowDuring)} cm) — flat light`); }
      score = clamp(0.55 * skyS + 0.25 * windS + 0.2 * tempS - pen);
      reasons.unshift(`${round(s.sunHours, 1)} h of sun between 9 and 16`);
      if (s.gustMax >= 60) reasons.push(`Gusts up to ${Math.round(s.gustMax)} km/h at the top${r.windExposed ? ' — exposed lifts may close' : ''}`);
      else if (s.gustMax >= 40) reasons.push(`Breezy on top (gusts ${Math.round(s.gustMax)} km/h)`);
      if (s.tTopMin <= -15) reasons.push(`Very cold on top (${Math.round(s.tTopMin)}°C)`);
      else reasons.push(`${Math.round(s.tTopMin)}° to ${Math.round(s.tMidMax)}°C on the mountain`);
      if (s.visMin < 1 && s.sunHours < 2) reasons.push('Poor visibility / in the clouds');
    } else reasons.push('No forecast available');
    if (lead >= 5) reasons.push(`Forecast is ${lead} days out — low confidence`);
    cats.weather = { score, reasons };
  }

  // ----- Open terrain -----
  {
    const reasons = [];
    let score = 0.5;
    if (rep.status === 'open' && cond.liftsTotal) {
      const frac = cond.liftsOpen / cond.liftsTotal;
      const openKm = r.km * frac;
      score = clamp(0.5 * frac + 0.5 * clamp(openKm / 100));
      reasons.push(`${cond.liftsOpen} of ${cond.liftsTotal} lifts open (~${Math.round(openKm)} km of ${r.km} km)`);
      if (frac < 0.35) reasons.push('Early/late-season setup — terrain concentrated, may feel busy');
    } else if (rep.status === 'closed') {
      score = 0;
      reasons.push('Closed according to the latest report');
    } else {
      score = 0.25;
      reasons.push(`Opening not confirmed — no lift report yet (${r.km} km when fully open)`);
    }
    if (rep.age != null && rep.age > 2) reasons.push(`Report is ${rep.age} days old`);
    if (lead > 0 && rep.status !== 'unknown') reasons.push('Based on today’s report');
    cats.terrain = { score, reasons };
  }

  // ----- Commute -----
  const corr = CORRIDORS[r.corridor];
  const trafficF = corr[dtype] * (holiday ? 1.06 : 1);
  const carMin = Math.round(r.drive * trafficF + 10);
  const returnF = dtype === 'sun' ? corr.returnSun : dtype === 'sat' ? corr.returnSat : 1.05;
  const carReturnMin = Math.round(r.drive * returnF + 10);
  const trainMin = train?.best?.minutes != null ? train.best.minutes + r.lastMile : r.trainFallback + r.lastMile;
  const trainLive = train?.best?.minutes != null;
  const mode = settings.mode;
  const commuteMin = mode === 'car' ? carMin : trainMin;
  {
    const reasons = [];
    const score = clamp(1 - (commuteMin - 60) / 120);
    if (mode === 'car') {
      reasons.push(`~${carMin} min by car incl. ${dtype === 'weekday' ? 'normal' : 'weekend'} traffic on the ${corr.label}`);
      if (carReturnMin - carMin > 20) reasons.push(`Return could take ~${carReturnMin} min (${dtype === 'sun' ? 'Sunday' : 'weekend'} afternoon jams)`);
      reasons.push(`Train alternative: ${trainMin} min`);
    } else {
      reasons.push(`${trainMin} min by train to the lift${trainLive ? ` (${train.best.dep}→${train.best.arr}, ${train.best.transfers} change${train.best.transfers === 1 ? '' : 's'})` : ' (typical)'}`);
      reasons.push(`Car alternative: ~${carMin} min`);
    }
    cats.commute = { score, reasons, value: commuteMin };
  }

  // ----- Crowds (needs weather) -----
  const crowd = (() => {
    const dayF = dtype === 'sat' ? 1 : dtype === 'sun' ? 0.93 : 0.4;
    let wxF = 1;
    if (s) {
      if (s.sunHours >= 5 && s.fresh72 >= 15) wxF = 1.25;
      else if (s.sunHours >= 5) wxF = 1.12;
      else if (s.sunHours < 1.5 || s.rainDuring > 1) wxF = 0.75;
    }
    const earlyF = rep.status === 'open' && cond.liftsTotal && cond.liftsOpen / cond.liftsTotal < 0.35 ? 1.12 : 1;
    const idx = clamp(r.popularity * dayF * wxF * earlyF * (holiday?.factor ?? 1));
    return { idx, dayF, wxF, earlyF };
  })();
  {
    const reasons = [];
    const label = crowd.idx >= 0.85 ? 'Packed' : crowd.idx >= 0.65 ? 'Busy' : crowd.idx >= 0.4 ? 'Moderate' : 'Quiet';
    reasons.push(`${label} expected`);
    if (dtype !== 'weekday') reasons.push(dtype === 'sat' ? 'Saturday — peak day' : 'Sunday — slightly calmer than Saturday');
    else reasons.push('Weekday — lift lines short');
    if (holiday) reasons.push(holiday.label);
    if (crowd.wxF > 1.15) reasons.push('Bluebird after fresh snow draws everyone out');
    else if (crowd.wxF > 1) reasons.push('Sunny forecast increases demand');
    else if (crowd.wxF < 1) reasons.push('Poor weather keeps people home');
    if (r.popularity >= 0.75) reasons.push('One of the most-visited areas from Zürich');
    cats.crowds = { score: clamp(1 - crowd.idx), reasons, label, value: crowd.idx };
  }

  // ----- Cost -----
  const ticket = r.dynamic ? Math.round((r.price[0] + (r.price[1] - r.price[0]) * clamp(crowd.idx * 1.05)) / 1) : r.price[0];
  const occupants = Math.max(1, settings.occupants || 2);
  const carCost = (2 * r.driveKm * 0.2 + r.parking) / occupants;
  const fullFare = 2 * (r.driveKm * 0.31 + 4);
  const trainCost = settings.pass === 'ga' ? 0 : settings.pass === 'halbtax' ? fullFare / 2 : fullFare;
  const travelCost = mode === 'car' ? carCost : trainCost;
  const perPerson = ticket + travelCost;
  {
    const reasons = [];
    reasons.push(`Day pass ${r.dynamic ? `≈ CHF ${ticket} (dynamic, est. from demand; range ${r.price[0]}–${r.price[1]})` : `CHF ${ticket}`}`);
    reasons.push(mode === 'car'
      ? `Car ≈ CHF ${Math.round(carCost)} p.p. (fuel + CHF ${r.parking} parking, ${occupants} in the car)`
      : `Train ≈ CHF ${Math.round(trainCost)} p.p. return${settings.pass === 'halbtax' ? ' with Halbtax' : settings.pass === 'ga' ? ' (GA)' : ''}`);
    if (mode === 'train' && settings.pass !== 'ga') reasons.push('Check Snow’n’Rail combo for ~10–20% off');
    cats.cost = { score: clamp(1 - (perPerson - 60) / 75), reasons, value: perPerson };
  }

  // ----- Terrain fit + avalanche -----
  const aval = slf ? Math.max(0, ...r.slf.map((id) => slf.byRegion[id] || 0)) : null;
  {
    const reasons = [];
    let score = r.fit;
    reasons.push(r.fit >= 0.85 ? 'Excellent steeps & freeride terrain' : r.fit >= 0.65 ? 'Good mix of reds/blacks' : r.fit >= 0.5 ? 'Mostly intermediate terrain' : 'Limited challenge for advanced skiers');
    if (aval) {
      const names = ['', 'low', 'moderate', 'considerable', 'high', 'very high'];
      reasons.push(`Avalanche danger ${aval} (${names[aval]})${lead > 1 ? ' — current bulletin' : ''}`);
      if (aval >= 3) { score -= 0.1; reasons.push('Off-piste: be very careful, stick to pistes unless equipped & experienced'); }
      else if ((cats.snow.fresh ?? 0) >= 15 && r.fit >= 0.7) { score += 0.1; reasons.push('Powder-day potential near the pistes'); }
    }
    cats.fit = { score: clamp(score), reasons, value: aval };
  }

  // ----- total -----
  const closed = rep.status === 'closed';
  const wSum = sum(Object.values(W));
  let total = sum(CATEGORIES.map((c) => cats[c.key].score * W[c.key])) / wSum;
  // hard caps: dangerous / pointless days
  const caps = [];
  if (s?.rainDuring > 4) { total = Math.min(total, 0.45); caps.push('heavy rain'); }
  if (s?.gustMax > 90) { total = Math.min(total, 0.4); caps.push('storm'); }
  if (cats.snow.value != null && cats.snow.value < 15 && rep.status !== 'open') { total = Math.min(total, 0.35); caps.push('too little snow'); }
  if (rep.status === 'unknown') total = Math.min(total, 0.5); // explained via the terrain category

  // headline reasoning: strongest weighted positives and the biggest drag
  const contrib = CATEGORIES.map((c) => ({ key: c.key, label: c.label, score: cats[c.key].score, w: W[c.key], delta: (cats[c.key].score - 0.55) * W[c.key] }));
  const pros = contrib.filter((c) => c.score >= 0.65).sort((a, b) => b.delta - a.delta).slice(0, 2);
  const cons = contrib.filter((c) => c.score < 0.45).sort((a, b) => a.delta - b.delta).slice(0, 2);

  // leave-by time for car (first lift ~08:30)
  const firstLift = (cond?.hours || '08:30').match(/(\d{1,2}):(\d{2})/);
  const liftMin = firstLift ? +firstLift[1] * 60 + +firstLift[2] : 510;
  const leaveMin = liftMin - carMin;
  const leaveBy = `${String(Math.floor(leaveMin / 60)).padStart(2, '0')}:${String(leaveMin % 60).padStart(2, '0')}`;

  return {
    r, total: closed ? null : round(total * 10, 1), closed, caps, cats, pros, cons, rep, s,
    commute: { carMin, carReturnMin, trainMin, trainLive, train, leaveBy },
    cost: { ticket, carCost, trainCost, perPerson },
    crowd, aval, lead, dtype, holiday,
    icon: iconFor(s),
  };
}

export function summaryLine(x) {
  if (x.closed) return 'Closed according to the latest report.';
  const phr = {
    snow: (c) => (c.fresh >= 10 ? `${Math.round(c.fresh)} cm of fresh snow` : c.value != null ? `a solid ${Math.round(c.value)} cm base` : 'decent snow'),
    weather: () => (x.s ? `${Math.round(x.s.sunHours)} h of sunshine` : 'good weather'),
    terrain: () => 'lots of open terrain',
    commute: (c) => `a short trip (${c.value} min)`,
    cost: (c) => `good value (≈ CHF ${Math.round(c.value)} p.p.)`,
    crowds: (c) => `${c.label.toLowerCase()} slopes`,
    fit: () => 'great terrain for strong skiers',
  };
  const con = {
    snow: (c) => (c.value == null ? 'uncertain snow' : c.value < 40 ? `a thin base (${Math.round(c.value)} cm)` : 'no fresh snow'),
    weather: () => (x.s?.rainDuring > 1 ? 'rain' : x.s?.gustMax > 60 ? 'strong wind' : 'grey skies'),
    terrain: () => (x.rep.status === 'unknown' ? 'its opening isn’t confirmed yet' : 'few lifts open'),
    commute: (c) => `a long trip (${c.value} min)`,
    cost: (c) => `a pricey day (≈ CHF ${Math.round(c.value)} p.p.)`,
    crowds: (c) => `${c.label.toLowerCase()} slopes`,
    fit: () => 'limited challenge',
  };
  const p = x.pros.map((c) => phr[c.key](x.cats[c.key]));
  const n = x.cons.map((c) => con[c.key](x.cats[c.key]));
  let out = p.length ? cap(joinAnd(p)) : 'An average day';
  if (n.length) out += `${p.length ? ', but' : ' with'} ${joinAnd(n)}`;
  if (x.caps.length) out += ` — capped for ${x.caps.join(' & ')}`;
  return `${out}.`;
}
const joinAnd = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
