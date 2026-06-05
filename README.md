# ⚡ Restos de Juventud — Power Outage Monitor v2

> *"Se me va la juventud con esta vaina."*

A community-powered tool born out of necessity. Where I live, power outages happen daily — sometimes multiple times, with voltage spikes that trip surge protectors. I needed a way to track them, understand patterns, predict when they're most likely to happen, and see whether my neighbors are experiencing the same thing.

## What it does

- **Multi-user** — anyone can register and track their own outages independently
- **Logs outages and micro-outages** (voltage spikes/fluctuations that trip breakers in under a minute)
- **Probabilistic engine** — builds a per-user model over time; predicts how likely a cut is at any hour on any day of the week
- **Community view** — see how many users in your city are currently without power, and today's totals by city
- **Dashboard** with weekly, monthly, and yearly totals, longest outage, worst day, and a natural-language forecast
- **CSV export** — download your full history
- **Profile** — public/private toggle, city, zone, password change
- Fully responsive, works as a mobile web app 

## Why I built it

The power company doesn't publish schedules. Cuts happen without warning. After months of this, I realized I was accumulating mental data — "it usually goes out around 2pm on weekdays" — but had nothing concrete to back it up. And I wanted to know if it was just my building or the whole neighborhood. This tool makes that intuition rigorous and collective.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Vanilla JS, no framework | Zero build step, instant deploy, nothing to break or update |
| **Backend** | Vercel Serverless Functions (Node.js) | Free tier, deploys on git push, scales to zero |
| **Database** | Neon (PostgreSQL) | Free tier, survives deploys unlike SQLite on serverless, real SQL for future queries |
| **Auth** | JWT in httpOnly cookies + bcryptjs | Stateless — works perfectly with serverless. No session store needed |
| **Inference** | Laplace-smoothed conditional probability | Simple, interpretable math. No ML library needed at this data scale |

### Why no React/Vue/etc?

The UI is rendered as HTML strings from a `render()` function. For a tool at this scope, a framework would add a build pipeline, dependency churn, and bundle size — all overhead with no benefit. The result is a single file with zero dependencies that loads instantly.

### Why Neon over SQLite?

Vercel's serverless functions have no persistent filesystem — SQLite resets on every deploy. Neon gives a real PostgreSQL database that lives independently from the deployment layer. Data persists across all deploys, restarts, and regions.

### Why Laplace smoothing?

Early on, the dataset is sparse. A slot with 1 observation and 1 hit shouldn't read as 100% probability. Laplace smoothing adds a small prior (α = 0.5) to numerator and denominator, pulling estimates toward uncertainty when data is thin. As observations accumulate the prior fades and the real signal dominates.

### Why httpOnly cookies for JWT?

Storing tokens in localStorage exposes them to XSS attacks. httpOnly cookies are inaccessible to JavaScript — only the browser sends them with requests. Combined with SameSite=Lax this covers the main attack vectors for an app at this scale.