#!/usr/bin/env node
// Collects snow & lift reports from bergfex.com for every resort in js/resorts.js
// and writes data/conditions.json. No dependencies (Node >= 18).
//
//   node collector/collect.mjs            # write ./data/conditions.json
//   node collector/collect.mjs out.json   # custom path
//
// bergfex pages are not CORS-enabled, which is why this runs server-side
// (on your machine via serve.mjs, or in GitHub Actions).

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESORTS } from '../js/resorts.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || `${ROOT}/data/conditions.json`);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const TZ = 'Europe/Zurich';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(20000) });
      if (res.status === 404) return null;
      if (res.status === 403 || res.status === 429) throw Object.assign(new Error(`HTTP ${res.status}`), { final: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (e.final || i === tries - 1) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

const decode = (s) => s
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü').replace(/&auml;/g, 'ä')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/\s+/g, ' ').trim();

const num = (s) => {
  if (s == null) return null;
  const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// Today's date parts in Zurich
function zurichToday() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(`${p}T12:00:00Z`);
}

// "Today, 08:31" | "Yesterday" | "Mon, 16.11." | "16.11.2025" -> ISO date (YYYY-MM-DD) or null
function parseRelDate(s) {
  if (!s) return null;
  const today = zurichToday();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (/today/i.test(s)) return iso(today);
  if (/yesterday/i.test(s)) return iso(new Date(today - 864e5));
  const us = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); // 03/31/2026
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
  if (m) {
    let y = m[3] ? +m[3] : today.getUTCFullYear();
    const d = new Date(Date.UTC(y, +m[2] - 1, +m[1], 12));
    if (!m[3] && d > today) d.setUTCFullYear(y - 1); // "16.12." seen in January
    return iso(d);
  }
  return null;
}

function parseOverview(html) {
  const out = {};
  const rows = html.split(/<tr class="tr\d">/).slice(1);
  for (const row of rows) {
    const slug = row.match(/href="\/([^/]+)\/schneebericht\/"/)?.[1];
    if (!slug) continue;
    const vals = [...row.matchAll(/<td[^>]*data-value="([^"]*)"/g)].map((m) => m[1]);
    // [name, valley, mountain, new, liftsOpen, datetime]
    const total = row.match(/<span class="smallest">(\d+)<\/span>/)?.[1];
    out[slug] = {
      valley: num(vals[1]), mountain: num(vals[2]), fresh: num(vals[3]),
      liftsOpen: vals[4] === '' ? null : num(vals[4]), liftsTotal: total ? +total : null,
      reportedAt: vals[5] || null,
    };
  }
  return out;
}

function parseDetail(html) {
  const pairs = {};
  for (const m of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) {
    const rawDt = m[1];
    const dt = decode(rawDt);
    const dd = m[2];
    if (/^Mountain/i.test(dt)) {
      pairs.mountain = num(decode(dd));
      pairs.mountainElev = num(rawDt.match(/([\d,]+)\s*m\b/)?.[1]);
    } else if (/^Snow depth/i.test(dt)) {
      pairs.valley = num(decode(dd.replace(/<div[\s\S]*$/, '')));
      pairs.valleyElev = num(rawDt.match(/([\d,]+)\s*m\b/)?.[1]);
      const fresh = dd.match(/new:\s*([\d.]+)\s*cm/i);
      if (fresh) pairs.fresh = +fresh[1];
    } else if (/^Snow condition/i.test(dt)) pairs.snowCondition = decode(dd);
    else if (/^Latest snowfall/i.test(dt)) pairs.lastSnowfall = parseRelDate(decode(dd)) || decode(dd);
    else if (/^Operation/i.test(dt)) pairs.operation = decode(dd);
    else if (/^Opening times/i.test(dt)) pairs.hours = decode(dd);
    else if (/^Piste conditions/i.test(dt)) pairs.pisteCondition = decode(dd);
    else if (/^Open lifts/i.test(dt)) {
      const t = decode(dd);
      const m2 = t.match(/(\d+)\s*of\s*(\d+)/i);
      if (m2) { pairs.liftsOpen = +m2[1]; pairs.liftsTotal = +m2[2]; }
    } else if (/^Snow report$/i.test(dt)) pairs.reportedLabel = decode(dd);
  }
  const sub = html.match(/class="desktop-only h2-sub">([^<]+)</)?.[1];
  pairs.reportDate = parseRelDate(sub || pairs.reportedLabel);
  for (const k of Object.keys(pairs)) if (pairs[k] === 'no information' || pairs[k] === '-' || pairs[k] === '') pairs[k] = null;
  return pairs;
}

// ---------- SLF IMIS stations (measured snow, open data) ----------
const toRad = (d) => (d * Math.PI) / 180;
function distKm(a, b) {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'firn-ski-planner (personal, non-commercial)' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

// Picks the station that best represents the ski area: close by, and near the
// upper-middle of the ski area's elevation range. Returns per-resort summaries.
async function collectSlf() {
  const [stations, daily] = await Promise.all([
    getJSON('https://measurement-api.slf.ch/public/api/imis/stations'),
    getJSON('https://measurement-api.slf.ch/public/api/imis/daily-snow?period_in_days=3'),
  ]);
  const byStation = {};
  for (const d of daily) (byStation[d.station_code] ||= []).push(d);
  for (const list of Object.values(byStation)) list.sort((a, b) => a.measure_date.localeCompare(b.measure_date));
  const candidates = stations.filter((s) => byStation[s.code]?.some((d) => d.HS != null));

  const out = {};
  for (const r of RESORTS) {
    const target = r.base + 0.65 * (r.top - r.base);
    let best = null;
    for (const s of candidates) {
      const km = distKm(r, s);
      if (km > 25) continue;
      const cost = km + Math.abs(s.elevation - target) / 100; // 100 m of elevation ~ 1 km of distance
      if (!best || cost < best.cost) best = { s, km, cost };
    }
    if (!best) continue;
    const series = byStation[best.s.code];
    const last = [...series].reverse().find((d) => d.HS != null);
    const fresh = series.reduce((sum, d) => sum + (d.HN_1D || 0), 0);
    out[r.id] = {
      code: best.s.code, label: best.s.label, elevation: Math.round(best.s.elevation), distanceKm: Math.round(best.km * 10) / 10,
      hs: Math.round(last.HS), fresh72: Math.round(fresh), fresh24: Math.round(series[series.length - 1]?.HN_1D || 0),
      date: last.measure_date.slice(0, 10),
    };
  }
  return out;
}

// ---------- bergfex (snow & lift report; blocked from datacenter IPs) ----------
async function collectBergfex(errors) {
  let overview = {};
  try {
    const html = await get('https://www.bergfex.com/schweiz/schneewerte/');
    if (html) overview = parseOverview(html);
  } catch (e) {
    errors.push(`bergfex overview: ${e.message}`);
  }
  const out = {};
  for (const r of RESORTS) {
    if (!r.bergfex) continue;
    try {
      const html = await get(`https://www.bergfex.com/${r.bergfex}/schneebericht/`);
      const entry = { ...(overview[r.bergfex] || {}) };
      if (html) for (const [k, v] of Object.entries(parseDetail(html))) if (v != null) entry[k] = v; // detail wins
      if (entry.reportedAt && !entry.reportDate) entry.reportDate = entry.reportedAt.slice(0, 10);
      entry.url = `https://www.bergfex.com/${r.bergfex}/schneebericht/`;
      out[r.id] = entry;
    } catch (e) {
      errors.push(`bergfex ${r.id}: ${e.message}`);
      if (/403|429/.test(e.message)) {
        // Refused (bot protection / rate limit): back off completely, the remaining
        // resorts keep their previous report. Try again on the next scheduled run.
        errors.push('bergfex refused the request; stopped and kept previous reports for the rest');
        break;
      }
    }
    await sleep(1500); // be polite
  }
  return out;
}

async function readPrevious() {
  try { return JSON.parse(await readFile(OUT, 'utf8')); } catch { return null; }
}

async function main() {
  const started = Date.now();
  const now = new Date().toISOString();
  const prev = await readPrevious();
  const errors = [];

  const [bergfex, slf] = await Promise.all([
    process.env.SKIP_BERGFEX ? {} : collectBergfex(errors), // SKIP_BERGFEX=1 simulates GitHub's 403
    collectSlf().catch((e) => { errors.push(`slf: ${e.message}`); return null; }),
  ]);
  const bergfexOk = Object.keys(bergfex).length > 0;
  const slfOk = slf && Object.keys(slf).length > 0;
  if (!bergfexOk && !slfOk) {
    console.error(`[collect] every source failed, keeping existing ${OUT}: ${errors.join('; ')}`);
    process.exit(1);
  }

  const result = {
    generatedAt: now,
    sources: {
      bergfex: bergfexOk ? { at: now, resorts: Object.keys(bergfex).length } : prev?.sources?.bergfex || (prev?.generatedAt ? { at: prev.generatedAt, carriedOver: true } : null),
      slf: slfOk ? { at: now, resorts: Object.keys(slf).length } : prev?.sources?.slf || null,
    },
    resorts: {},
    errors,
  };
  for (const r of RESORTS) {
    const old = prev?.resorts?.[r.id] || {};
    // bergfex fields: fresh if we got them, otherwise carry over the last good report
    const { slf: _oldSlf, ...oldBergfex } = old;
    // per resort: fresh report if fetched this run, otherwise carry over the last good one
    const entry = bergfex[r.id] ? { ...bergfex[r.id] } : { ...oldBergfex };
    const s = slfOk ? slf[r.id] : old.slf;
    if (s) entry.slf = s;
    result.resorts[r.id] = entry;
  }

  await mkdir(dirname(OUT), { recursive: true });
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, JSON.stringify(result, null, 1));
  await rename(tmp, OUT);
  const took = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[collect] bergfex ${bergfexOk ? Object.keys(bergfex).length + ' resorts' : 'unavailable (kept previous)'}, SLF ${slfOk ? Object.keys(slf).length + ' resorts' : 'unavailable'}, ${took}s -> ${OUT}`);
  if (errors.length) console.log('[collect] errors:', errors.join('; '));
}

main().catch((e) => { console.error('[collect] fatal', e); process.exit(1); });
