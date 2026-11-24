// Live data fetchers. Everything here is CORS-enabled and runs in the browser,
// except the bergfex snow report which is pre-collected into data/conditions.json.
import { RESORTS, ZURICH } from './resorts.js';

const TZ = 'Europe/Zurich';

// ---------- small cache (localStorage, safe) ----------
function cacheGet(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    return Date.now() - t < maxAgeMs ? v : null;
  } catch { return null; }
}
function cacheSet(key, v) {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch { /* full or blocked */ }
}

async function getJSON(url, timeout = 20000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// ---------- weather (Open-Meteo, multi-location in one request) ----------
const HOURLY_TOP = ['temperature_2m', 'snowfall', 'precipitation', 'cloud_cover', 'visibility', 'wind_speed_10m', 'wind_gusts_10m', 'sunshine_duration', 'freezing_level_height', 'weather_code'];
const HOURLY_MID = ['temperature_2m', 'snowfall', 'rain', 'precipitation', 'cloud_cover_low', 'sunshine_duration'];

function meteoUrl(points, hourly) {
  const p = new URLSearchParams({
    latitude: points.map((x) => x.lat).join(','),
    longitude: points.map((x) => x.lon).join(','),
    elevation: points.map((x) => x.elev).join(','),
    hourly: hourly.join(','),
    daily: 'sunrise,sunset',
    timezone: TZ,
    past_days: '3',
    forecast_days: '9',
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

// Returns { [resortId]: { top: hourlyObj, mid: hourlyObj, daily }, zurich: hourlyObj }
export async function fetchWeather({ force = false } = {}) {
  const key = 'firn:weather:v1';
  if (!force) {
    const c = cacheGet(key, 45 * 60 * 1000);
    if (c) return c;
  }
  const top = RESORTS.map((r) => ({ lat: r.lat, lon: r.lon, elev: Math.round(r.top - 150) }));
  const mid = RESORTS.map((r) => ({ lat: r.lat, lon: r.lon, elev: Math.round((r.base + r.top) / 2) }));
  mid.push({ lat: ZURICH.lat, lon: ZURICH.lon, elev: 410 });
  const [a, b] = await Promise.all([getJSON(meteoUrl(top, HOURLY_TOP)), getJSON(meteoUrl(mid, HOURLY_MID))]);
  const arrA = Array.isArray(a) ? a : [a];
  const arrB = Array.isArray(b) ? b : [b];
  const out = { fetchedAt: new Date().toISOString(), resorts: {} };
  RESORTS.forEach((r, i) => {
    out.resorts[r.id] = { top: arrA[i].hourly, mid: arrB[i].hourly, daily: arrA[i].daily };
  });
  out.zurich = arrB[RESORTS.length].hourly;
  cacheSet(key, out);
  return out;
}

// ---------- snow & lift report (collected server-side) ----------
export async function fetchConditions() {
  try {
    const res = await fetch(`data/conditions.json?t=${Math.floor(Date.now() / 300000)}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch {
    return null;
  }
}

// ---------- avalanche bulletin (SLF, CAAMLv6 JSON) ----------
const DANGER = { low: 1, moderate: 2, considerable: 3, high: 4, very_high: 5 };
export async function fetchAvalanche() {
  const key = 'firn:slf:v1';
  const c = cacheGet(key, 60 * 60 * 1000);
  if (c) return c;
  try {
    const d = await getJSON('https://aws.slf.ch/api/bulletin/caaml/en/json');
    const byRegion = {};
    let validFrom = null;
    for (const b of d.bulletins || []) {
      const lvl = Math.max(0, ...(b.dangerRatings || []).map((x) => DANGER[x.mainValue] || 0));
      validFrom = validFrom || b.validTime?.startTime;
      for (const reg of b.regions || []) byRegion[reg.regionID] = Math.max(byRegion[reg.regionID] || 0, lvl);
    }
    const out = { byRegion, validFrom };
    cacheSet(key, out);
    return out;
  } catch {
    return null;
  }
}

// ---------- train connections (transport.opendata.ch) ----------
function parseDuration(s) {
  // "00d01:42:00"
  const m = s && s.match(/(\d+)d(\d+):(\d+)/);
  return m ? +m[1] * 1440 + +m[2] * 60 + +m[3] : null;
}

const hhmm = (iso) => iso ? new Intl.DateTimeFormat('de-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '';

export async function fetchTrain(station, date, time = '07:00', from = ZURICH.station) {
  const key = `firn:train:v2:${from}:${station}:${date}:${time}`;
  const c = cacheGet(key, 12 * 60 * 60 * 1000);
  if (c) return c;
  const p = new URLSearchParams({ from, to: station, date, time, limit: '4' });
  const d = await getJSON(`https://transport.opendata.ch/v1/connections?${p}`, 15000);
  const conns = (d.connections || []).map((c) => ({
    minutes: parseDuration(c.duration),
    dep: hhmm(c.from?.departure),
    arr: hhmm(c.to?.arrival),
    transfers: c.transfers ?? null,
    products: (c.products || []).filter(Boolean),
  })).filter((c) => c.minutes);
  if (!conns.length) return null;
  const best = conns.reduce((a, b) => (b.minutes < a.minutes ? b : a));
  const first = conns[0];
  const out = { best, first };
  cacheSet(key, out);
  return out;
}

// Fetch trains for all resorts with limited concurrency.
export async function fetchTrains(date, onProgress) {
  const out = {};
  const queue = [...RESORTS];
  let done = 0;
  async function worker() {
    while (queue.length) {
      const r = queue.shift();
      try { out[r.id] = await fetchTrain(r.station, date); } catch { out[r.id] = null; }
      done++;
      onProgress?.(done, RESORTS.length);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}
