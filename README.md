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

Two sources need a server-side step, because they don't allow browser access. `collector/collect.mjs` gathers both into `data/conditions.json`:

- **SLF IMIS stations** (open data): measured snow depth and new snow at the station nearest each ski area. Works from anywhere, including GitHub Actions.
- **bergfex** snow & lift report: lifts open, piste and snow conditions, lift hours. bergfex blocks datacenter IPs such as GitHub's, so this part only works from your own machine.

When one source fails, the collector keeps that source's last good data instead of wiping it.

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

Push the repo to GitHub, then set **Settings → Pages → Source: GitHub Actions**. `.github/workflows/pages.yml` deploys on every push to `main`.

Every GitHub run (each push, plus every 2 hours during the season) refreshes the SLF snow measurements. bergfex blocks GitHub's IPs, so the lift reports come from your laptop. A systemd user timer runs `deploy/push-conditions.sh` every 2 hours (06:15–20:15, Nov–Apr) and catches up after sleep. It collects, then commits and pushes `data/conditions.json` only when the resort reports actually changed. Each push redeploys the site.

```bash
mkdir -p ~/.config/systemd/user && cp deploy/firn-push.service deploy/firn-push.timer ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now firn-push.timer
systemctl --user list-timers firn-push.timer      # next run
journalctl --user -u firn-push -n 20              # last runs
```

If the laptop is off for days, the site still works: snow depth stays current via SLF, and the app labels the lift reports with their age. Weather, trains and avalanche data are always live in the browser.

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
