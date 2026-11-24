# Firn: ski days from Zürich

A small, fast web app that rates ~20 Swiss ski resorts within day-trip range of Zürich for any day in the next week, and explains each rating.

**What it weighs** (weights are adjustable in Preferences):

| Category | Inputs |
|---|---|
| Snow | Reported base depth, plus snow forecast before the day, fresh snow in the last 72 h, reported surface (powder / hard / wet), thaw-then-freeze detection |
| Weather | Sunshine hours 9–16 h, cloud and visibility, wind gusts at the top (exposed lifts flagged), temperature, rain below the freezing level |
| Open terrain | Lifts open / total and estimated open piste km. Resorts with no report yet are marked "opening unconfirmed" |
| Commute | Car: OSRM route time × weekend traffic per corridor (A3 Walensee, A13, Gotthard…). Train: live SBB connection + last mile to the lift |
| Cost | Day pass (dynamic prices estimated from demand), plus fuel and parking split by passengers, or train fare with Halbtax / GA |
| Crowds | Popularity × Saturday/Sunday × school & public holidays × bluebird/powder-day pull × early-season concentration |
| Terrain fit | Steeps & freeride for intermediate–advanced skiers, adjusted by the SLF avalanche danger level |

It also flags: **Hochnebel escape** (fog in Zürich, sun above), Sunday return traffic, snow on the roads, avalanche danger, holiday crowds, forecast confidence, daylight and lift hours, dynamic-pricing tips and Snow'n'Rail.

## Architecture

Almost everything runs in the browser. These APIs allow direct browser access (CORS):

- **Open-Meteo**: hourly forecast at mid and top elevation of every resort (one request)
- **transport.opendata.ch**: live SBB connections
- **SLF**: avalanche bulletin (CAAML JSON)

The only thing that needs a server-side step is the **snow & lift report** (bergfex.com, which does not allow cross-origin requests). `collector/collect.mjs` scrapes it into `data/conditions.json`. Run it on a schedule, either on your own machine (`serve.mjs` does this) or in GitHub Actions. So there's no backend to maintain, just a cron-style job.

## Run on your laptop (and open it from your phone over Tailscale)

Requires Node ≥ 18, no `npm install` needed.

```bash
node serve.mjs            # http://0.0.0.0:8642, refreshes snow reports hourly
```

On your phone (Tailscale on): `http://[hostname]:8642`.

**Keep it running** as a user service:

```bash
mkdir -p ~/.config/systemd/user && cp deploy/firn.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now firn
loginctl enable-linger $USER   # keep running when logged out
```

**HTTPS + install as an app (optional):** `tailscale serve --bg 8642` exposes it at `https://[hostname].<tailnet>.ts.net` inside your tailnet. Over HTTPS you can "Add to Home Screen" and the offline cache works.

## Host on GitHub Pages instead

Push the repo to GitHub, then set **Settings → Pages → Source: GitHub Actions**. `.github/workflows/pages.yml` deploys on push and re-collects snow reports every 2 hours in winter.

## Customising

- **Resorts**: `js/resorts.js` (coordinates, elevations, prices, SBB stop, bergfex slug, SLF regions, terrain fit, popularity)
- **Holidays**: `js/calendar.js` (approximate; refresh each season)
- **Scoring**: `js/scoring.js`
- **Manual data refresh**: `npm run collect`

## Caveats

- Lift ticket prices are **estimates**. Dynamic-pricing resorts (Laax, Andermatt, Davos, Arosa Lenzerheide…) are modelled from expected demand, not read from the shops; the card links to each live price page.
- Crowds are a heuristic model; no public live crowd data exists.
- Snow reports are only as good as what resorts publish; early in the season some show last spring's values (detected and ignored).
- Car times come from free-flow routing plus a weekend factor, not live traffic.
