#!/usr/bin/env node
// Collects snow & lift reports from bergfex.com for every resort in js/resorts.js
// and writes data/conditions.json. No dependencies (Node >= 18).
//
//   node collector/collect.mjs            # write ./data/conditions.json
//   node collector/collect.mjs out.json   # custom path
//
// bergfex pages are not CORS-enabled, which is why this runs server-side
// (on your machine via serve.mjs, or in GitHub Actions).

import { writeFile, mkdir, rename } from 'node:fs/promises';
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === tries - 1) throw e;
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

async function main() {
  const started = Date.now();
  const result = { generatedAt: new Date().toISOString(), source: 'bergfex.com (data: MySwitzerland / resorts)', resorts: {}, errors: [] };

  let overview = {};
  try {
    const html = await get('https://www.bergfex.com/schweiz/schneewerte/');
    if (html) overview = parseOverview(html);
  } catch (e) {
    result.errors.push(`overview: ${e.message}`);
  }

  for (const r of RESORTS) {
    if (!r.bergfex) continue;
    const entry = { ...(overview[r.bergfex] || {}) };
    try {
      const html = await get(`https://www.bergfex.com/${r.bergfex}/schneebericht/`);
      if (html) {
        const d = parseDetail(html);
        for (const [k, v] of Object.entries(d)) if (v != null) entry[k] = v; // detail wins
      }
    } catch (e) {
      result.errors.push(`${r.id}: ${e.message}`);
    }
    if (entry.reportedAt && !entry.reportDate) entry.reportDate = entry.reportedAt.slice(0, 10);
    entry.url = `https://www.bergfex.com/${r.bergfex}/schneebericht/`;
    result.resorts[r.id] = entry;
    await sleep(700); // be polite
  }

  await mkdir(dirname(OUT), { recursive: true });
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, JSON.stringify(result, null, 1));
  await rename(tmp, OUT);
  const n = Object.keys(result.resorts).length;
  console.log(`[collect] ${n} resorts, ${result.errors.length} errors, ${((Date.now() - started) / 1000).toFixed(1)}s -> ${OUT}`);
  if (result.errors.length) console.log('[collect] errors:', result.errors.join('; '));
}

main().catch((e) => { console.error('[collect] fatal', e); process.exit(1); });
