# Supply Chain Planning Platform

AI-native supply chain planning for SMB manufacturers. Deterministic ASCM/APICS planning engines for the math, Claude for exception analysis and natural language interaction.

Five modules covering the full ASCM MPC cascade: Demand Planning, DRP, Production Planning, Scheduling, and MRP.

## Quick Start

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Start both frontend and backend
npm run dev
```

Frontend runs on `http://localhost:5173`, API server on `http://localhost:3001`.

### Environment Variables

Create `server/.env`:

```
DATABASE_URL=postgres://user:pass@localhost:5432/supply_chain
ANTHROPIC_API_KEY=sk-ant-...
```

The app works without a database (synthetic data) and without an API key (AI chat disabled, everything else works).

## Architecture

```
Browser (React 19 + Vite)          Express Server
  Module Pages ──── REST ──────>  Route Handlers
  AgentChat    <──── SSE ───────  Service Layer
                                     |
                    ┌────────────────┼────────────────┐
                    |                |                 |
              Deterministic     AI Agent          Cascade
              Engines           Layer             Orchestrator
              (pure JS)         (Claude API)      (EventEmitter)
                    |                |                 |
                    └────────────────┼────────────────┘
                                     |
                              PostgreSQL (Drizzle ORM)
```

**Hybrid approach:** Engines are pure JavaScript functions with zero LLM nondeterminism. Same answer every run. AI analyzes engine output for exceptions, recommendations, and natural language interaction. AI never touches the planning math.

## Modules

| Module | Engine | What It Does |
|--------|--------|-------------|
| **Demand Planning** | `demand-engine.js` | 5 statistical methods (moving avg, exp smoothing, Holt-Winters), best-fit selection, MAPE/MAD/bias metrics |
| **DRP** | `drp-engine.js` | Distribution requirements across 3 DCs, transit lead time netting, fair-share allocation |
| **Production Planning** | `prod-plan-engine.js` | Chase/level/hybrid strategies per plant, rough-cut capacity planning (RCCP) |
| **Scheduling** | `sched-engine.js` | SPT/EDD/CR sequencing, Gantt chart, changeover optimization |
| **MRP** | `mrp-engine.js` | Plant-specific BOM explosion, gross-to-net netting, lot sizing (L4L, FOQ, EOQ, POQ), exception generation |

### ASCM Cascade Flow

```
Demand Forecast --> DRP --> Production Plan --> Scheduling --> MRP
                                                    ^          |
                                                    └──────────┘
                                              (closed loop feedback)
```

A change to a demand forecast triggers the full cascade. Each step writes to the database before triggering the next. Real-time progress via SSE.

## Key Features

- **Morning Briefing** -- AI-generated daily summary of attention items, overnight changes, and auto-resolved exceptions
- **What-If Theater** -- Side-by-side scenario comparison with color-coded diffs and financial impact
- **Exception Resolution Learning** -- Learns from planner decisions, pre-fills resolutions with confidence scores
- **Decision Log + Trust Score** -- Full audit trail of every planning decision, per-module AI trust percentages
- **Financial Impact Layer** -- Dollar impact on every exception and plan change
- **Cascade Visualization** -- Animated flow showing changes ripple through all 5 modules
- **Network Map** -- Interactive Leaflet map of plant and DC locations with lane connections
- **Implementation Wizard** -- Guided 5-step onboarding: upload CSVs, AI column mapping, validate, run first cascade

## Project Structure

```
src/
  pages/              # One page per module + Landing, Decisions, Agent, Onboarding
  components/
    shared/           # Card, DataTable, ModuleLayout, PageHeader, StatusPill
    demand/           # ForecastChart (SVG)
    AgentChat.jsx     # Claude-powered chat with SSE streaming
    CascadeViz.jsx    # Real-time cascade progress
    MorningBriefing.jsx
    NetworkMap.jsx    # Leaflet interactive map
    WhatIfTheater.jsx
  styles/tokens.js    # Design token system (see DESIGN.md)
  utils/format.js     # Shared number formatting

server/
  src/
    engines/          # 5 deterministic planning engines (pure functions)
    services/         # Business logic, cascade orchestrator, AI integration
      ai-context/     # Per-module Claude context builders (6 files)
    routes/           # Express route handlers
    data/             # Synthetic demo data (BOM, demand, network)
    db/               # Drizzle ORM schema and seed
    middleware/       # Error handling
```

## Commands

| Command | What |
|---------|------|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run dev:client` | Frontend only (Vite) |
| `npm run dev:server` | Backend only (Express) |
| `npm run build` | Production build |
| `npm run test` | Run all 260 tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run seed` | Seed database |

## Tests

260 tests across 15 test files. All 5 engines have test-first coverage with ASCM/APICS compliance tests.

```bash
npm run test
```

Test files are co-located: `server/src/engines/__tests__/`, `server/src/services/__tests__/`.

## Tech Stack

- **Frontend:** React 19, Vite 8, React Router 7, Leaflet
- **Backend:** Express 5, Node.js
- **Database:** PostgreSQL, Drizzle ORM
- **AI:** Claude API (Sonnet) via SSE streaming
- **Testing:** Vitest
- **Design:** Custom design token system, 3 responsive breakpoints, WCAG Level A

## Design System

See [DESIGN.md](./DESIGN.md) for the full token reference: colors, typography, spacing, border radius, shadows, and component patterns.

## Deploying

The frontend is configured for Vercel deployment. All pages include static fallback data so the app renders without a running backend (AI chat and live data require the Express server).

```bash
npm run build   # outputs to dist/
```
