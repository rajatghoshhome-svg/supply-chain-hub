/**
 * Vercel Serverless Function: /api/ai/chat
 *
 * Proxies chat messages to Claude API with rich Champion Pet Foods
 * supply chain context. Each module gets a tailored system prompt
 * so the AI can reason about the user's question with real data.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

const PREAMBLE = `You are an AI supply chain planning assistant embedded in an ASCM/APICS-compliant planning platform for Champion Pet Foods.

Champion Pet Foods is a premium pet nutrition company with two flagship brands:
  - ORIJEN: Biologically Appropriate, premium-tier dog and cat food (dry, freeze-dried, treats)
  - ACANA: Heritage-class, high-quality dog and cat food (dry, wet)

MANUFACTURING NETWORK:
  - DogStar Kitchens (PLT-DOGSTAR), Auburn KY — 9 work centers (4 extruders, 1 coating, 1 freeze-dry, 3 packaging lines)
  - NorthStar Kitchen (PLT-NORTHSTAR), Edmonton AB — 5 work centers (2 extruders, 1 retort/wet line, 2 packaging lines)

DISTRIBUTION CENTERS: DC-ATL (Atlanta), DC-DEN (Denver), DC-TOR (Toronto)

PRODUCT FAMILIES (9):
  DogStar: Orijen Dry Dog, Orijen Dry Cat, Orijen Freeze-Dried, Orijen Treats, Acana Dry Dog, Acana Dry Cat
  NorthStar: Acana Wet Dog, Orijen Dry Cat (shared), Acana Dry Dog (shared)

PRODUCT HIERARCHY: Brand > Family > Line > Product > SKU (size variant)
  Example: ORIJEN > Dry Dog Food > Core > Original > ORI-ORIG-25 (25 lb bag)

ASCM MPC CASCADE:
  Demand Plan > DRP > S&OP/Production Plan > MPS (RCCP) > [MRP + Scheduling]`;

const MODULE_CONTEXT = {
  demand: `
## CURRENT DEMAND STATE
- Forecast method: Holt-Winters + ML Ensemble (weighted blend)
- Planning horizon: 12 weekly buckets (W1-W12)
- 9 product families, 105 SKUs, 5 customer channels
- 3 active manual overrides on consensus plan

DEMAND DATA (weekly avg cases):
| Family | Avg Weekly | Trend | MAPE |
|--------|-----------|-------|------|
| Orijen Dry Dog | 23,252 | +4.2% | 6.2% |
| Orijen Dry Cat | 15,800 | +6.1% | 7.8% |
| Acana Dry Dog | 18,400 | flat | 8.1% |
| Orijen Freeze-Dried | 8,200 | -2.3% | 11.4% |
| Acana Wet Dog | 7,600 | +3.8% | 9.6% |
| Orijen Treats | 5,400 | +1.2% | 8.8% |
| Acana Dry Cat | 6,100 | +2.1% | 9.2% |

SEASONAL RAMP: Weeks 5-6 show 32-35k units for Orijen Dry Dog (seasonal peak).
FORECAST ACCURACY: Orijen Freeze-Dried has weakest MAPE (11.4%) — growing category, historical patterns lagging.

You are the demand planning assistant. Help the planner understand forecast accuracy, recommend method changes, identify demand anomalies, and evaluate override impacts.`,

  production_plan: `
## CURRENT PRODUCTION STATE
Planning horizon: 12 weekly periods (W1-W12)
Firmed periods: W1-W2 (locked), W3-W12 open for adjustment

STRATEGY COMPARISON — Orijen Dry Dog (DogStar):
| Strategy | Total Cost | Key Feature |
|----------|-----------|-------------|
| Chase | $926,278 (REC) | Match demand, variable workforce |
| Level | $912,418 | Constant rate, 2 exceptions (inventory risk W5-W6) |
| Hybrid | $966,223 | Base + overtime for peaks |

GROSS REQUIREMENTS (Orijen Dry Dog): 23,252 / 21,957 / 22,508 / 23,092 / 32,052 / 34,800 / 28,500 / 24,100 / 22,800 / 21,400 / 20,900 / 21,500
Base production rate: 21,518 units/week

RCCP: Extruders 1-4 will hit 92% utilization in W6 under any strategy. Packaging lines at 78%.
Exceptions: 52 total, 7 critical (capacity overloads in peak weeks)

HEURISTIC PARAMETERS:
- Safety stock days: 14
- Overtime cap: 20% of base capacity
- Subcontract available: No (pet food quality requirements)
- Changeover time: 0.5-2.0 hours depending on family switch

You are the production planning assistant. Help evaluate strategies, explain cost trade-offs, identify capacity risks, and recommend firming decisions.`,

  drp: `
## CURRENT DISTRIBUTION STATE

LANE NETWORK:
| Lane | Distance | Transit | Mode | Ship Days | Open Shipments |
|------|----------|---------|------|-----------|---------------|
| PLT-DOGSTAR > DC-ATL | 460 mi | 2d | Truck | Mon/Wed/Fri | 3 |
| PLT-DOGSTAR > DC-DEN | 1,180 mi | 3d | Truck | Tue/Thu | 2 |
| PLT-NORTHSTAR > DC-TOR | 2,100 mi | 4d | Rail | Mon/Wed/Fri | 3 |
| PLT-NORTHSTAR > DC-DEN | 1,640 mi | 3d | Truck | Tue/Fri | 2 |
| PLT-NORTHSTAR > DC-ATL | 2,480 mi | 5d | Intermodal | Mon/Thu | 2 |
| DC-ATL <> DC-DEN | 1,390 mi | 3d | STO | — | — |
| DC-TOR <> DC-ATL | 880 mi | 2d | STO | — | — |

DC INVENTORY:
| DC | Orijen Dry Dog | Acana Dry Dog | Days of Supply |
|----|---------------|---------------|----------------|
| DC-ATL | 14,200 (SS: 8,000) | 9,800 (SS: 6,000) | 18-22d |
| DC-DEN | 9,800 (SS: 7,000) | 5,200 (SS: 5,500) ⚠ | 9-14d |
| DC-TOR | 6,900 (SS: 7,500) ⚠ | 8,700 (SS: 5,000) | 10-24d |

DEMAND SPLITS:
| Family | DC-ATL | DC-DEN | DC-TOR |
|--------|--------|--------|--------|
| orijen-dry-dog | 45% | 30% | 25% |
| acana-wet-dog | 50% | 30% | 20% |
| orijen-freeze-dry | 40% | 35% | 25% |

MOVE VS MAKE SCENARIOS:
1. MVM-301 (CRITICAL): Orijen Original DC-ATL>DC-DEN, 2,400 units. MOVE saves $8,150 (34%) vs MAKE. Move: $15,800/3d. Make: $23,950/10d.
2. MVM-302 (WARNING): Acana Wet Dog DC-TOR>DC-ATL, 1,600 units. MOVE saves $3,200 (18%). Cross-border customs risk.

8 recommended shipments pending load building. 186,400 lbs total weight.

You are the distribution planning assistant. Help with inventory rebalancing, transfer decisions, load optimization, and lane management.`,

  scheduling: `
## CURRENT SCHEDULING STATE — DogStar Kitchens

WORK CENTERS:
| Work Center | Stage | Status | Current Order | Pace |
|------------|-------|--------|--------------|------|
| Extruder 1 | Extrusion | RUNNING | Acana Heritage Dog Dry (520 units) | 75% — BEHIND |
| Extruder 2 | Extrusion | RUNNING | Orijen Tundra Cat Dry (380 units) | 62% — BEHIND |
| Extruder 3 | Extrusion | RUNNING | Orijen Original Dry Dog (600 units) | 88% — ON PACE |
| Extruder 4 | Extrusion | RUNNING | Acana Prairie Dry Dog (440 units) | 91% — ON PACE |
| Coating | Coating | IDLE | — | — |
| Freeze-Dry | Freeze-Dry | IDLE | — | — |
| Pkg Line 1 | Packaging | COMPLETED | — | — |
| Pkg Line 2 | Packaging | DOWNTIME | MAINT scheduled | — |
| Pkg Line 3 | Packaging | COMPLETED | — | — |

SCHEDULE SUMMARY:
- Total orders: 35, Running: 4, Completed: 12, Delayed: 2
- Avg utilization: 78%, Total changeover: 8.5 hours
- Horizon: Apr 6-27, 2026. Current simulated time: Apr 9, 2:30 PM
- Sequencing rule: EDD (Earliest Due Date)
- CIP downtime: Every Sunday. Maintenance: Every other Friday.

CHANGEOVER MATRIX (hours):
- Same family: 0h
- Same brand, diff family: 0.5h
- Diff brand, same format: 1.0h
- Diff format: 2.0h

You are the scheduling assistant. Help with sequence optimization, bottleneck resolution, pace monitoring, and downtime planning.`,

  mrp: `
## CURRENT MRP STATE

BOM STRUCTURE (example — Orijen Original Dry Dog 25lb):
| Level | Component | Qty Per | Lead Time | Lot Sizing |
|-------|-----------|---------|-----------|------------|
| 0 | ORI-ORIG-25 (Finished Good) | 1 | 1 week | L4L |
| 1 | Fresh Chicken Meal | 0.35 kg | 2 weeks | POQ(4) |
| 1 | Fresh Turkey | 0.20 kg | 2 weeks | POQ(4) |
| 1 | Fresh Whole Herring | 0.12 kg | 3 weeks | POQ(4) |
| 1 | Chicken Fat | 0.08 kg | 1 week | FOQ(500) |
| 1 | Packaging Film 25lb | 1.0 ea | 1 week | FOQ(10000) |

EXCEPTIONS SUMMARY:
| Type | Count | Critical |
|------|-------|----------|
| Expedite | 3 | 2 |
| Reschedule In | 2 | 0 |
| Reschedule Out | 1 | 0 |
| Cancel | 1 | 0 |
| New PO | 2 | 0 |

TOP RISKS:
1. Fresh Chicken Meal — supplier lead time risk, 3-day gap projected in W3
2. Extrusion capacity — overloaded W5-W6 for Orijen Dry Dog
3. Freeze-dry coating — new PO auto-generated for W4, verify supplier

INVENTORY POSITION (key materials):
- Fresh Chicken Meal: 1,200 kg on-hand, 2,400 kg on-order (arriving W2)
- Turkey Meal: 800 kg on-hand, adequate through W4
- Packaging Film: 45,000 units, covers 4.5 weeks

You are the MRP assistant. Help with exception resolution, BOM analysis, planned order recommendations, and material shortage mitigation.`,

  general: `
## CROSS-MODULE OVERVIEW

KEY METRICS TODAY:
- Demand: 9 families tracked, MAPE range 6.2-11.4%, 3 overrides active
- DRP: 8 open shipments, 2 move-vs-make scenarios (1 critical), DC-DEN below SS
- Production: Hybrid strategy selected ($966K), seasonal ramp W5-W6 needs attention
- Scheduling: 35 orders, 4 running, 2 behind pace, 78% avg utilization
- MRP: 9 exceptions (2 critical expedites), Fresh Chicken Meal risk

TOP 3 ACTIONS THIS WEEK:
1. Execute STO transfer DC-ATL > DC-DEN for Orijen Original (saves $8,150)
2. Monitor Extruder 1 & 2 pace — both behind, may cascade to packaging delays
3. Firm Production Plan periods W3-W4 before seasonal ramp

AI TRUST SCORE: 71% (12/17 recommendations accepted by planners)

You are the supply chain planning assistant. Provide cross-functional insights, prioritize actions, and help connect decisions across Demand, DRP, Production, Scheduling, and MRP modules.`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.VITE_CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { module = 'general', messages = [] } = req.body;
  const moduleContext = MODULE_CONTEXT[module] || MODULE_CONTEXT.general;
  const systemPrompt = PREAMBLE + '\n' + moduleContext;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({ error: `Anthropic API error: ${body}` });
    }

    // Stream SSE back to client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
}
