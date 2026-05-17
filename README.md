# ⚡ Restos de Juventud — Power Outage Monitor

> *"Se me va la juventud con esta vaina."*

A personal tool born out of necessity. Where I live, power outages happen daily — sometimes multiple times, with voltage spikes that trip surge protectors. I needed a way to track them, understand patterns, and predict when they're most likely to happen.

## What it does

- **Logs outages and micro-outages** (voltage spikes/fluctuations that trip breakers but restore within seconds)
- **Builds a probabilistic model** over time: given enough data, it tells you how likely a cut is at any given hour on any day of the week
- **Dashboard** with weekly, monthly, and yearly totals — plus a heatmap of risk by day/hour
- **Multi-device access** — log from your phone, check from your PC, data is always in sync
- Works entirely from the browser, no app install required

## Why I built it

The power company doesn't publish schedules. Cuts happen without warning. After a few months of this, I realized I was accumulating mental data — "it usually goes out around 2pm on weekdays" — but had nothing concrete to back it up. This tool makes that intuition rigorous.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Vanilla JS (no framework) | Zero build step, instant deploy, nothing to update or break |
| **Backend** | Vercel Serverless Functions | Free tier, deploys from git push, global CDN |
| **Database** | Neon (PostgreSQL) | Free tier, survives deploys (unlike SQLite on serverless), easy to query later |
| **Inference** | Laplace-smoothed conditional probability | Simple, interpretable math. No ML library needed for this problem size |

### Why no React/Vue/etc?

The UI is fully server-rendered HTML strings. For a single-user tool with this scope, a framework would add a build pipeline, dependency churn, and bundle size — all overhead with no benefit. Vanilla JS with a `render()` function is fast, readable, and has zero dependencies.

### Why Neon over SQLite?

Vercel's serverless functions have no persistent filesystem. SQLite would reset on every deploy. Neon gives us a real PostgreSQL database that lives independently from the deployment layer — data persists across all deploys, restarts, and scaling events.

### Why Laplace smoothing?

Early on, the dataset is sparse. A slot with 1 observation and 1 hit shouldn't read as 100% probability. Laplace smoothing adds a small prior (α = 0.5) to both numerator and denominator, pulling estimates toward uncertainty when data is thin. As observations accumulate, the prior's influence fades and the real signal dominates.

## Data model

```sql
CREATE TABLE outages (
  id               TEXT PRIMARY KEY,
  start_time       TEXT NOT NULL,
  end_time         TEXT,
  duration_minutes REAL,
  type             TEXT DEFAULT 'corte',  -- 'corte' | 'fluctuacion'
  notes            TEXT,
  created_at       TEXT DEFAULT NOW()::text
);
```

`fluctuacion` records have `start_time = end_time` and `duration_minutes = 0`. They're logged as timestamped events, not intervals, and are excluded from the probabilistic model (they'd skew it — a spike that lasts a second is not the same signal as a 4-hour cut).

## Running locally

```bash
npm install
# Create a .env file with:
# DATABASE_URL=postgresql://...your_neon_connection_string...
node server.js   # (if using the local server version)
```

Or deploy to Vercel:
1. Push to GitHub
2. Import on vercel.com
3. Add `DATABASE_URL` environment variable
4. Deploy
