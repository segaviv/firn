import { RESORTS, CORRIDORS } from './resorts.js';
import { fetchWeather, fetchConditions, fetchAvalanche, fetchTrains } from './live.js';
import { scoreResort, summaryLine, zurichFog, CATEGORIES, DEFAULT_WEIGHTS, dayType } from './scoring.js';
import { ICONS } from './icons.js';

const TZ = 'Europe/Zurich';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- settings ----------
const DEFAULT_SETTINGS = { mode: 'car', pass: 'halbtax', occupants: 2, maxCommute: 0, showUnknown: true, weights: { ...DEFAULT_WEIGHTS }, sort: 'score' };
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('firn:settings') || '{}');
    return { ...DEFAULT_SETTINGS, ...s, weights: { ...DEFAULT_WEIGHTS, ...(s.weights || {}) } };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings() { try { localStorage.setItem('firn:settings', JSON.stringify(settings)); } catch { /* ignore */ } }
const settings = loadSettings();

// ---------- dates ----------
const zParts = (d = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((p) => [p.type, p.value]));
const todayIso = () => { const p = zParts(); return `${p.year}-${p.month}-${p.day}`; };
const nowLocal = () => { const p = zParts(); return `${p.year}-${p.month}-${p.day}T${p.hour}`; };
const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const fmtDay = (iso, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(`${iso}T12:00:00Z`));
const fmtTime = (iso) => new Intl.DateTimeFormat('de-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const fmtMin = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`);

function defaultDay(days) {
  const t = todayIso();
  const dow = new Date(`${t}T12:00:00Z`).getUTCDay();
  const hour = +zParts().hour;
  if ((dow === 6 || dow === 0) && hour < 12) return t;
  return days.find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 6 && d > t) || days[0];
}

// ---------- state ----------
const state = {
  days: [],
  day: null,
  weather: null,
  conditions: null,
  slf: null,
  trains: {},
  results: [],
  openCard: null,
};

// ---------- scoring ----------
function score(day, withTrains = true) {
  const t = todayIso();
  const ctx = (r) => ({
    iso: day, todayIso: t, nowLocal: nowLocal(),
    weather: state.weather?.resorts?.[r.id],
    cond: state.conditions?.resorts?.[r.id],
    slf: state.slf,
    train: withTrains ? state.trains[day]?.[r.id] : null,
    settings, weights: settings.weights,
  });
  return RESORTS.map((r) => scoreResort(r, ctx(r)));
}

const scoreColor = (v) => (v == null ? 'var(--line-2)' : v >= 7.5 ? 'var(--s-hi)' : v >= 6 ? 'var(--s-mid)' : v >= 4.5 ? 'var(--s-lo)' : 'var(--s-poor)');

// ---------- rendering: days ----------
function renderDays() {
  const el = $('#days');
  const bests = state.weather ? Object.fromEntries(state.days.map((d) => {
    const res = score(d, false).filter((x) => x.total != null);
    const best = res.sort((a, b) => b.total - a.total)[0];
    return [d, best];
  })) : {};
  el.innerHTML = state.days.map((d) => {
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    const isWe = dow === 0 || dow === 6;
    const name = d === todayIso() ? 'Today' : fmtDay(d, { weekday: 'short' });
    const b = bests[d];
    return `<button class="day ${isWe ? 'weekend' : ''}" role="tab" data-day="${d}" aria-selected="${d === state.day}">
      <span class="d-name">${name}</span>
      <span class="d-date">${fmtDay(d, { day: 'numeric', month: 'short' })}</span>
      <span class="d-ico">${b ? ICONS[b.icon] : ''}<span class="d-score">${b ? b.total.toFixed(1) : ''}</span></span>
    </button>`;
  }).join('');
  el.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

// ---------- rendering: verdict ----------
function renderVerdict(rated) {
  const el = $('#verdict');
  const d = state.day;
  const dayLabel = fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' });
  const best = rated[0];
  if (!best) {
    el.innerHTML = `<div class="kicker">${dayLabel}</div>
      <h1 class="verdict-title">Nothing worth the trip <em>yet</em>.</h1>
      <p class="verdict-why">No resort near Zürich reports open lifts for this day. Early season: check back as resorts open.</p>`;
    return;
  }
  const v = best.total;
  const name = best.r.name.split(' · ')[0];
  let title;
  if (v >= 7) title = `Go to <em>${esc(name)}</em>.`;
  else if (v >= 5.5) title = `<em>${esc(name)}</em> is your best bet.`;
  else title = `Maybe skip this one.`;
  const why = v >= 5.5 ? summaryLine(best) : `Best available is ${esc(best.r.name)} at ${v.toFixed(1)}: ${summaryLine(best).replace(/^./, (c) => c.toLowerCase())}`;
  const c = best.commute;
  const mode = settings.mode;
  const travel = fmtMin(mode === 'car' ? c.carMin : c.trainMin);
  const when = mode === 'car' ? ['Leave by', c.leaveBy] : c.trainLive ? ['Train', `${c.train.best.dep} → ${c.train.best.arr}`] : ['Train', 'typical time'];
  const runners = rated.slice(1, 4).map((x) => `<a href="#r-${x.r.id}" data-jump="${x.r.id}">${esc(x.r.name.split(' · ')[0])}<span class="num">${x.total.toFixed(1)}</span></a>`).join('');

  // weekend comparison
  let compare = '';
  const dt = dayType(d);
  const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
  const other = dow === 6 ? addDays(d, 1) : dow === 0 ? addDays(d, -1) : null;
  if (other && state.days.includes(other)) {
    const ob = score(other, false).filter((x) => x.total != null).sort((a, b) => b.total - a.total)[0];
    if (ob) {
      const diff = ob.total - v;
      const oname = fmtDay(other, { weekday: 'long' });
      if (diff >= 0.4) compare = `<div class="compare">${ICONS.calendar}<span>${oname} looks better: ${esc(ob.r.name.split(' · ')[0])} ${ob.total.toFixed(1)}.</span> <button data-day="${other}">Switch</button></div>`;
      else if (diff <= -0.4) compare = `<div class="compare">${ICONS.calendar}<span>Better than ${oname} (best ${ob.total.toFixed(1)}).</span></div>`;
      else compare = `<div class="compare">${ICONS.calendar}<span>${oname} is similar (best ${ob.total.toFixed(1)}).</span></div>`;
    }
  }
  void dt;

  el.innerHTML = `
    <div class="kicker"><span>${dayLabel}</span><span class="dot"></span><span>${mode === 'car' ? 'By car' : 'By train'}</span></div>
    <h1 class="verdict-title">${title}</h1>
    <p class="verdict-why">${why}</p>
    <div class="verdict-stats">
      <div class="big-score"><span class="score" style="color:${scoreColor(v)}">${v.toFixed(1)}</span><span class="of">/10</span></div>
      <div class="vstats">
        <div class="vstat"><span>${mode === 'car' ? 'Drive' : 'Door to lift'}</span><b>${travel}</b></div>
        <div class="vstat"><span>${when[0]}</span><b>${when[1]}</b></div>
        <div class="vstat"><span>Cost p.p.</span><b>≈ CHF ${Math.round(best.cost.perPerson)}</b></div>
        <div class="vstat"><span>Sun · crowds</span><b>${best.s ? `${best.s.sunHours.toFixed(1)} h` : '–'} · ${best.cats.crowds.label}</b></div>
      </div>
    </div>
    ${runners ? `<div class="runners"><span>Also good</span>${runners}</div>` : ''}
    ${compare}`;
}

// ---------- rendering: notes ----------
function renderNotes(rated) {
  const el = $('#notes');
  const notes = [];
  const best = rated[0];
  const d = state.day;
  const dt = dayType(d);
  const fog = zurichFog(state.weather?.zurich, d);
  if (fog?.foggy && best?.s?.sunHours >= 4) notes.push(['good', 'fogEscape', `<b>Escape the Hochnebel.</b> Fog over Zürich until midday, ${best.s.sunHours.toFixed(1)} h of sun above it.`]);
  if (best?.holiday) notes.push(['warn', 'calendar', `<b>${esc(best.holiday.label)}.</b> Expect fuller slopes and roads; go early.`]);
  if (settings.mode === 'car' && best) {
    const corr = CORRIDORS[best.r.corridor];
    if (dt === 'sun') notes.push(['warn', 'road', `<b>Sunday return traffic</b> on the ${corr.label}: ~${fmtMin(best.commute.carReturnMin)} home. Leave the slopes by 15:00 or after dinner.`]);
    else if (dt === 'sat') notes.push(['', 'road', `<b>Leave by ${best.commute.leaveBy}</b> to be at the first lift; Saturday morning queues build from ~07:30 on the ${corr.label}.`]);
    const snowRoad = best.s && (best.s.overnight > 5 || best.s.snowDuring > 5);
    if (snowRoad) notes.push(['warn', 'snow', `<b>Snow on the roads.</b> ${Math.round(Math.max(best.s.overnight, best.s.snowDuring))} cm expected — winter tyres essential, carry chains for mountain roads.`]);
  }
  if (best?.aval >= 3) notes.push(['bad', 'avalanche', `<b>Avalanche danger ${best.aval}</b> around ${esc(best.r.name.split(' · ')[0])}. Off-piste only with gear, training and a plan.`]);
  else if (best?.aval) notes.push(['', 'avalanche', `Avalanche danger <b>${best.aval}</b> around ${esc(best.r.name.split(' · ')[0])} (current SLF bulletin).`]);
  if (best && best.lead >= 4) notes.push(['', 'info', `The forecast is <b>${best.lead} days out</b>. Check again on Thursday or Friday, ratings will shift.`]);
  if (best?.r.dynamic) notes.push(['', 'ticket', `<b>${esc(best.r.name.split(' · ')[0])} uses dynamic pricing.</b> Buying online a few days ahead is usually cheaper. The CHF ${best.cost.ticket} is an estimate.`]);
  if (best?.s && best.s.tTopMin <= -12) notes.push(['', 'thermo', `<b>Cold on top (${Math.round(best.s.tTopMin)}°C).</b> Face mask, hand warmers, and charge your phone.`]);
  if (best?.s?.sunrise) notes.push(['', 'sunrise', `Daylight ${best.s.sunrise}–${best.s.sunset}${best.rep && state.conditions?.resorts?.[best.r.id]?.hours ? ` · lifts ${esc(state.conditions.resorts[best.r.id].hours)}` : ''}.`]);
  if (!state.conditions) notes.push(['bad', 'info', '<b>Snow & lift reports unavailable.</b> Run the collector (<code>npm run collect</code>) to fetch them. Ratings use weather only.']);
  else {
    const src = state.conditions.sources || {};
    const liftAt = src.bergfex?.at || state.conditions.generatedAt;
    const ageH = (Date.now() - Date.parse(liftAt)) / 36e5;
    if (ageH > 12) notes.push(['warn', 'info', `Lift & resort reports are <b>${ageH > 48 ? `${Math.round(ageH / 24)} days` : `${Math.round(ageH)} h`} old</b> (they refresh when your laptop runs the collector).${src.slf?.at ? ' Snow depth uses current SLF measurements.' : ''}`]);
  }
  if (settings.mode === 'train' && settings.pass !== 'ga') notes.push(['', 'train', '<b>Snow’n’Rail</b> (RailAway) bundles train + pass with ~10–20% off at many of these resorts.']);
  el.innerHTML = notes.length ? `<h3>Worth knowing</h3>${notes.map(([cls, ic, html]) => `<div class="note ${cls}">${ICONS[ic] || ICONS.info}<div>${html}</div></div>`).join('')}` : '';
}

// ---------- rendering: cards ----------
function crowdBar(idx) {
  const n = Math.round(idx * 5);
  return `<span class="crowd-bar" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
}

function metricsHtml(x) {
  const cond = state.conditions?.resorts?.[x.r.id];
  const m = [];
  if (x.s) {
    const cls = x.s.rainDuring > 1 ? 'neg' : x.s.sunHours >= 5 ? 'pos' : '';
    m.push(`<span class="metric ${cls}">${ICONS[x.icon]}<b>${x.s.sunHours.toFixed(1)} h</b> sun · ${Math.round(x.s.tTopMin)}°</span>`);
  }
  const snow = x.cats.snow;
  if (snow.value != null || snow.fresh >= 1) {
    const cls = snow.fresh >= 15 ? 'pos' : snow.value != null && snow.value < 30 ? 'warn' : '';
    m.push(`<span class="metric ${cls}">${ICONS.flake}${snow.value != null ? `<b>${Math.round(snow.value)} cm</b>` : '<b>?</b> base'}${snow.fresh >= 1 ? ` · +${Math.round(snow.fresh)} new` : ''}</span>`);
  }
  if (cond?.liftsTotal && x.rep.status === 'open') m.push(`<span class="metric">${ICONS.lift}<b>${cond.liftsOpen}/${cond.liftsTotal}</b> lifts</span>`);
  else if (x.rep.status === 'unknown') m.push(`<span class="metric warn">${ICONS.lift}Opening unconfirmed</span>`);
  const mode = settings.mode;
  m.push(`<span class="metric">${mode === 'car' ? ICONS.car : ICONS.train}<b>${fmtMin(mode === 'car' ? x.commute.carMin : x.commute.trainMin)}</b></span>`);
  m.push(`<span class="metric">${ICONS.coin}<b>CHF ${Math.round(x.cost.perPerson)}</b></span>`);
  m.push(`<span class="metric">${ICONS.people}${x.cats.crowds.label}${crowdBar(x.crowd.idx)}</span>`);
  if (x.s?.gustMax >= 60) m.push(`<span class="metric neg">${ICONS.wind}<b>${Math.round(x.s.gustMax)}</b> km/h</span>`);
  return m.join('');
}

function detailHtml(x) {
  const cond = state.conditions?.resorts?.[x.r.id];
  const W = settings.weights;
  const wSum = Object.values(W).reduce((a, b) => a + b, 0);
  const rows = CATEGORIES.map((c) => {
    const cat = x.cats[c.key];
    const v = cat.score * 10;
    return `<div class="bd-row">
      <div class="bd-label">${c.label}<small>${Math.round((W[c.key] / wSum) * 100)}% weight</small></div>
      <div class="bar"><i style="--p:${cat.score.toFixed(3)};--c:${scoreColor(v)}"></i></div>
      <div class="bd-val">${v.toFixed(1)}</div>
      <ul class="bd-reasons">${cat.reasons.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>`;
  }).join('');

  const hours = x.s ? `<div><h4>On the mountain · ${x.r.top - 150} m</h4><div class="hours">${x.s.hourly.map((h) => {
    const ic = h.rain > 0.3 ? 'rain' : h.snow > 0.3 ? 'snow' : h.sun > 0.6 ? 'sun' : h.sun > 0.2 ? 'partly' : h.vis < 1000 ? 'fog' : 'cloud';
    return `<div class="hour"><span>${String(h.h).padStart(2, '0')}h</span>${ICONS[ic]}<b>${Math.round(h.tTop)}°</b><span class="gust ${h.gust >= 55 ? 'hi' : ''}">${Math.round(h.gust)} km/h</span></div>`;
  }).join('')}</div></div>` : '';

  const c = x.commute;
  const t = c.train?.best;
  const gmaps = (mode) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('Zürich HB')}&destination=${encodeURIComponent(mode === 'transit' ? x.r.station : (x.r.park || [x.r.lat, x.r.lon]).join(','))}&travelmode=${mode}`;
  const facts = `
    <div class="facts">
      <div class="fact"><div class="fact-h">${ICONS.car} Car</div>
        <div class="big">${fmtMin(c.carMin)}</div>
        <p>Leave by <b>${c.leaveBy}</b> · home ~${fmtMin(c.carReturnMin)}</p>
        <p>≈ CHF ${Math.round(x.cost.carCost)} p.p. (${settings.occupants} in car)</p></div>
      <div class="fact"><div class="fact-h">${ICONS.train} Train</div>
        <div class="big">${fmtMin(c.trainMin)}</div>
        <p>${t ? `${t.dep} → ${t.arr} · ${t.transfers} change${t.transfers === 1 ? '' : 's'}` : 'Typical Saturday time'}${x.r.lastMile ? ` · +${x.r.lastMile} min to lift` : ''}</p>
        <p>≈ CHF ${Math.round(x.cost.trainCost)} return${settings.pass === 'halbtax' ? ' (Halbtax)' : settings.pass === 'ga' ? ' (GA)' : ''}</p></div>
      <div class="fact"><div class="fact-h">${ICONS.mountain} Mountain</div>
        <div class="big">${x.r.base}–${x.r.top} m</div>
        <p>${x.r.km} km of pistes${cond?.hours ? ` · lifts ${esc(cond.hours)}` : ''}</p>
        <p>${cond?.snowCondition && !/no info/i.test(cond.snowCondition) ? `Snow: ${esc(cond.snowCondition)}` : x.rep.note ? esc(x.rep.note) : ''}${cond?.reportDate ? ` · report ${esc(cond.reportDate)}` : ''}</p>
        ${cond?.slf ? `<p>SLF ${esc(cond.slf.label)} ${cond.slf.elevation} m: <b>${cond.slf.hs} cm</b>, +${cond.slf.fresh72} cm / 3 days</p>` : ''}</div>
    </div>`;

  const links = `<div class="links">
    <a class="primary" href="${x.r.tickets}" target="_blank" rel="noopener">${ICONS.ticket} Live price & tickets</a>
    ${cond?.url ? `<a href="${cond.url}" target="_blank" rel="noopener">Snow report ${ICONS.arrow}</a>` : ''}
    <a href="${gmaps(settings.mode === 'car' ? 'driving' : 'transit')}" target="_blank" rel="noopener">Directions ${ICONS.arrow}</a>
    <a href="https://www.slf.ch/en/avalanche-bulletin-and-snow-situation/" target="_blank" rel="noopener">Avalanche bulletin ${ICONS.arrow}</a>
    <a href="${x.r.url}" target="_blank" rel="noopener">Website ${ICONS.arrow}</a>
  </div>`;

  return `<p class="blurb">${esc(x.r.blurb)}</p>
    <div><h4>Why ${x.total != null ? x.total.toFixed(1) : '—'}</h4><div class="breakdown">${rows}</div></div>
    ${hours}
    <div><h4>Getting there & details</h4>${facts}</div>
    ${links}`;
}

function cardHtml(x, i, rank) {
  const v = x.total;
  const open = state.openCard === x.r.id;
  return `<li class="card ${open ? 'open' : ''}" id="r-${x.r.id}" data-id="${x.r.id}" style="--i:${i}">
    <button class="card-head" aria-expanded="${open}" aria-controls="d-${x.r.id}">
      <span class="rank">${rank != null ? String(rank).padStart(2, '0') : '—'}</span>
      <div class="title">
        <h3>${esc(x.r.name)}</h3>
        <p class="sub">${esc(x.r.region)} · ${x.r.base}–${x.r.top} m · ${x.r.km} km</p>
        <p class="why">${esc(summaryLine(x))}</p>
      </div>
      <span class="ring ${v == null ? 'closed' : ''}" style="--p:${v != null ? (v / 10).toFixed(3) : 0};--c:${scoreColor(v)}" aria-label="${v != null ? `Rating ${v.toFixed(1)} of 10` : 'Closed'}"><span>${v != null ? v.toFixed(1) : 'Closed'}</span></span>
    </button>
    <div class="metrics">${metricsHtml(x)}</div>
    <div class="toggle-hint">${open ? 'Less' : 'Why this rating'} ${ICONS.chevron}</div>
    <div class="detail" id="d-${x.r.id}" ${open ? '' : 'hidden'}>${open ? detailHtml(x) : ''}</div>
  </li>`;
}

const SORTERS = {
  score: (a, b) => (b.total ?? -1) - (a.total ?? -1),
  commute: (a, b) => a.cats.commute.value - b.cats.commute.value,
  snow: (a, b) => b.cats.snow.score - a.cats.snow.score,
  weather: (a, b) => b.cats.weather.score - a.cats.weather.score,
  cost: (a, b) => a.cost.perPerson - b.cost.perPerson,
  crowds: (a, b) => a.crowd.idx - b.crowd.idx,
};

function render() {
  if (!state.weather) return;
  const results = score(state.day);
  state.results = results;
  const maxC = +settings.maxCommute || 0;
  const inRange = (x) => !maxC || x.cats.commute.value <= maxC;
  const visible = results.filter((x) => !x.closed && inRange(x) && (settings.showUnknown || x.rep.status === 'open'));
  const closed = results.filter((x) => x.closed && inRange(x));
  const rated = [...visible].sort(SORTERS.score);
  const ranks = new Map(rated.map((x, i) => [x.r.id, i + 1]));
  const sorted = [...visible].sort(SORTERS[settings.sort] || SORTERS.score);

  renderVerdict(rated);
  renderNotes(rated);
  renderDays();

  const hidden = results.length - visible.length - closed.length;
  $('#count').textContent = `${visible.length}${hidden > 0 ? ` · ${hidden} hidden by filters` : ''}`;
  $('#cards').innerHTML = sorted.length ? sorted.map((x, i) => cardHtml(x, i, ranks.get(x.r.id))).join('') : '<li class="empty">No resorts match your filters.</li>';
  $('#closedGroup').hidden = !closed.length;
  $('#closedCount').textContent = closed.length;
  $('#closedCards').innerHTML = closed.map((x, i) => cardHtml(x, i, null)).join('');
  renderFreshness();
}

function renderFreshness() {
  const parts = [];
  if (state.weather?.fetchedAt) parts.push(`Weather ${fmtTime(state.weather.fetchedAt)}`);
  const src = state.conditions?.sources || {};
  const stamp = (iso) => `${fmtDay(iso.slice(0, 10), { day: 'numeric', month: 'short' })} ${fmtTime(iso)}`;
  const liftAt = src.bergfex?.at || state.conditions?.generatedAt;
  if (liftAt) parts.push(`lift reports ${stamp(liftAt)}`);
  if (src.slf?.at) parts.push(`SLF snow ${stamp(src.slf.at)}`);
  if (state.slf?.validFrom) parts.push(`avalanche bulletin ${fmtTime(state.slf.validFrom)}`);
  const tr = state.trains[state.day];
  if (settings.mode === 'train') parts.push(tr ? 'live SBB timetable' : 'typical train times');
  $('#freshness').textContent = parts.length ? `Updated: ${parts.join(' · ')}` : '';
}

// ---------- interactions ----------
function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}

async function ensureTrains() {
  if (settings.mode !== 'train' || state.trains[state.day]) return;
  const day = state.day;
  try {
    state.trains[day] = await fetchTrains(day);
    if (day === state.day) render();
  } catch {
    toast('Could not reach the SBB timetable. Showing typical train times.');
  }
}

function selectDay(d) {
  state.day = d;
  state.openCard = null;
  render();
  ensureTrains();
}

document.addEventListener('click', (e) => {
  const day = e.target.closest('[data-day]');
  if (day) { selectDay(day.dataset.day); return; }
  const jump = e.target.closest('[data-jump]');
  if (jump) {
    e.preventDefault();
    state.openCard = jump.dataset.jump;
    render();
    document.getElementById(`r-${jump.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const head = e.target.closest('.card-head, .toggle-hint');
  if (head) {
    const card = head.closest('.card');
    const id = card.dataset.id;
    const opening = state.openCard !== id;
    // close previously open card
    document.querySelectorAll('.card.open').forEach((c) => {
      c.classList.remove('open');
      c.querySelector('.card-head').setAttribute('aria-expanded', 'false');
      const d = c.querySelector('.detail'); d.hidden = true; d.innerHTML = '';
      c.querySelector('.toggle-hint').firstChild.textContent = 'Why this rating ';
    });
    state.openCard = opening ? id : null;
    if (opening) {
      const x = state.results.find((r) => r.r.id === id);
      card.classList.add('open');
      card.querySelector('.card-head').setAttribute('aria-expanded', 'true');
      const d = card.querySelector('.detail'); d.innerHTML = detailHtml(x); d.hidden = false;
      card.querySelector('.toggle-hint').firstChild.textContent = 'Less ';
      const top = card.getBoundingClientRect().top;
      const bar = $('.topbar').getBoundingClientRect().height;
      if (top < bar) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
});

$('#modeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (!b) return;
  settings.mode = b.dataset.mode;
  saveSettings();
  syncMode();
  render();
  ensureTrains();
});
function syncMode() {
  document.querySelectorAll('#modeSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode)));
}

$('#sortSel').addEventListener('change', (e) => { settings.sort = e.target.value; saveSettings(); render(); });

$('#refreshBtn').addEventListener('click', () => load(true));

// settings sheet
const dlg = $('#settings');
const form = $('#settingsForm');
function buildWeights() {
  $('#weights').innerHTML = CATEGORIES.map((c) => `
    <label class="weight" title="${esc(c.hint)}"><span>${c.label}</span>
      <input type="range" min="0" max="40" step="1" name="w_${c.key}" value="${settings.weights[c.key]}">
      <output>${settings.weights[c.key]}</output></label>`).join('');
}
$('#settingsBtn').addEventListener('click', () => {
  form.pass.value = settings.pass;
  form.occupants.value = settings.occupants;
  form.maxCommute.value = String(settings.maxCommute);
  form.showUnknown.checked = settings.showUnknown;
  buildWeights();
  dlg.showModal();
});
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
form.addEventListener('input', (e) => {
  const t = e.target;
  if (t.name?.startsWith('w_')) {
    settings.weights[t.name.slice(2)] = +t.value;
    t.nextElementSibling.textContent = t.value;
  } else if (t.name === 'pass') settings.pass = t.value;
  else if (t.name === 'occupants') settings.occupants = Math.max(1, Math.min(7, +t.value || 1));
  else if (t.name === 'maxCommute') settings.maxCommute = +t.value;
  else if (t.name === 'showUnknown') settings.showUnknown = t.checked;
  saveSettings();
  render();
});
$('#resetWeights').addEventListener('click', () => { settings.weights = { ...DEFAULT_WEIGHTS }; saveSettings(); buildWeights(); render(); });

// ---------- boot ----------
function skeleton() {
  $('#cards').innerHTML = Array.from({ length: 5 }, () => '<li class="skeleton sk-card"></li>').join('');
}

async function load(force = false) {
  const btn = $('#refreshBtn');
  btn.classList.add('spinning');
  try {
    const [weather, conditions, slf] = await Promise.all([
      fetchWeather({ force }).catch((e) => { console.error(e); return null; }),
      fetchConditions(),
      fetchAvalanche(),
    ]);
    if (!weather) {
      toast('Weather forecast unavailable. Check your connection and refresh.');
      if (!state.weather) { $('#cards').innerHTML = '<li class="empty">Couldn’t load the forecast. Tap refresh to try again.</li>'; return; }
    } else state.weather = weather;
    state.conditions = conditions;
    state.slf = slf;
    if (force) state.trains = {};
    render();
    ensureTrains();
    if (force) toast('Live data refreshed');
  } finally {
    btn.classList.remove('spinning');
  }
}

function init() {
  const t = todayIso();
  state.days = Array.from({ length: 8 }, (_, i) => addDays(t, i));
  state.day = defaultDay(state.days);
  $('#sortSel').value = settings.sort;
  syncMode();
  renderDays();
  skeleton();
  load();
  // keep it fresh when the phone app is reopened
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.weather && Date.now() - Date.parse(state.weather.fetchedAt) > 45 * 60 * 1000) load();
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
