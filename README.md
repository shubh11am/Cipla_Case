# Cipla_Case — CARDIO-PRIORITISER

An auditable AI prioritisation agent for the India Cardiac market, built for
**Cipla Ascend Season 4 (2026)**, deployed as a live web app.

The agent may be tested live at the finale — this is where.

**What a judge can do here that a deck cannot show:** move the model's weights and watch the
ranking re-compute, click any space for its full audit trail with sourced signals, see the blind
backtest, and ask the agent a question in plain English.

---

## How it is put together

The agent's expensive half — turning 7,452 SKU rows into per-space economics and competitive
structure — is deterministic. It only changes when the dataset or the cluster rules change. So it
runs **once in Python** and is exported to static JSON.

The cheap half — percentile-rank, weight, five screens — is arithmetic over 11 rows. That is
**re-implemented in TypeScript** and runs in the browser, which is why the sliders are instant and
why Vercel never needs pandas.

```
agent/*.py  ──(python export_web.py)──▶  web/data/*.json  ──▶  lib/score.ts  ──▶  browser
                                                                     │
                                                          app/api/ask/route.ts ──▶ Claude API
```

`npm run verify` re-scores the shipped data in TypeScript and asserts it matches Python's own
numbers, which travel in the JSON as `py_*` fields. It currently agrees to within 0.001 of a point.
**Run it after any change to `lib/score.ts` or the exporter.**

---

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

To enable the "Ask the agent" tab locally, create `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without it, every other tab works and the Ask tab explains what is missing.

---

## Refreshing the data

Whenever the dataset, `config.yaml`, or the business-case assumptions change:

```bash
cd "../../agent"
python export_web.py     # rewrites this repo's data/*.json
cd "../Cipla_Case/Cipla_Case"
npm run verify           # confirm TS still matches Python
npm run build            # confirm it still builds
```

---

## Deploying to Vercel

This repo **is** the app — `package.json` sits at the root, so Vercel needs no Root Directory
setting.

1. Push to GitHub: `git add -A && git commit -m "web app" && git push`
2. On vercel.com → **Add New → Project** → import `shubh11am/Cipla_Case` → **Deploy**.
   Next.js is auto-detected; leave every build setting alone.
3. Optional — **Settings → Environment Variables** → add `ANTHROPIC_API_KEY` to enable the Ask
   tab, then **Deployments → ⋯ → Redeploy**.

The app is a static page plus one serverless function, so it runs comfortably on the free tier.

---

## Files

| Path | What it is |
|---|---|
| `lib/score.ts` | The scoring engine and five screens, ported from Python. Must stay numerically identical. |
| `app/page.tsx` | The four tabs and all state. |
| `components/Matrix.tsx` | The attractiveness × right-to-win chart, drawn as SVG. |
| `components/SpaceDetail.tsx` | The `--explain` audit trail as a panel. |
| `app/api/ask/route.ts` | The only server-side code. Calls Claude, grounded in the computed table. |
| `data/*.json` | Exported by `agent/export_web.py`. Do not hand-edit. |
| `scripts/verify.ts` | Proves the browser reproduces the Python agent. |
