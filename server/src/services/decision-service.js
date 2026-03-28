/**
 * Decision Service — In-memory decision log with trust scoring
 *
 * Provides logging, retrieval, status updates, and trust-score
 * computation for all planning decisions across modules.
 */

// ─── In-memory store ─────────────────────────────────────────────
let decisions = [];
let nextSeq = 1;

function genId() {
  const id = `DEC-${String(nextSeq).padStart(3, '0')}`;
  nextSeq++;
  return id;
}

// ─── Public API ──────────────────────────────────────────────────

export function logDecision({ module, action, entityType, entityId, entity, rationale, decidedBy, financialImpact, status }) {
  const decision = {
    id: genId(),
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    module,
    action,
    entityType: entityType || 'item',
    entityId: entityId || null,
    entity: entity || entityId || '',
    rationale,
    decidedBy: decidedBy || 'AI recommended',
    financialImpact: financialImpact || null,
    status: status || 'pending',
  };
  decisions.push(decision);
  return decision;
}

export function getDecisions({ module, limit } = {}) {
  let result = [...decisions];
  if (module && module !== 'all') {
    result = result.filter(d => d.module === module);
  }
  // Newest first
  result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (limit) {
    result = result.slice(0, limit);
  }
  return result;
}

export function getDecisionById(id) {
  return decisions.find(d => d.id === id) || null;
}

export function updateDecisionStatus(id, status) {
  const decision = decisions.find(d => d.id === id);
  if (!decision) return null;
  decision.status = status;
  decision.updatedAt = new Date().toISOString();
  return decision;
}

export function getTrustScore({ module } = {}) {
  const modules = ['demand', 'drp', 'production', 'scheduling', 'mrp'];
  const targetModules = (module && module !== 'all') ? [module] : modules;

  const perModule = {};
  for (const m of modules) {
    const modDecisions = decisions.filter(d => d.module === m);
    const aiDecisions = modDecisions.filter(d => d.decidedBy === 'AI recommended');
    const total = aiDecisions.length;
    const accepted = aiDecisions.filter(d => d.status === 'accepted').length;
    const deferred = aiDecisions.filter(d => d.status === 'deferred').length;
    const dismissed = aiDecisions.filter(d => d.status === 'dismissed').length;
    perModule[m] = {
      total,
      accepted,
      deferred,
      dismissed,
      trustPct: total > 0 ? Math.round((accepted / total) * 100) : 0,
    };
  }

  // Overall
  const allAi = decisions.filter(d => d.decidedBy === 'AI recommended');
  const overall = {
    total: allAi.length,
    accepted: allAi.filter(d => d.status === 'accepted').length,
    deferred: allAi.filter(d => d.status === 'deferred').length,
    dismissed: allAi.filter(d => d.status === 'dismissed').length,
    trustPct: allAi.length > 0 ? Math.round((allAi.filter(d => d.status === 'accepted').length / allAi.length) * 100) : 0,
  };

  if (module && module !== 'all') {
    return { module, ...perModule[module], overall };
  }

  return { overall, perModule };
}

// ─── Pre-seed realistic decisions ────────────────────────────────

function seed() {
  const seedData = [
    // DRP decisions (5)
    { module: 'drp', action: 'Expedite shipment', entity: 'MTR-100 @ DC-EAST', entityType: 'exception', rationale: 'Safety stock violation projected in period 3. Current on-hand 45 units vs SS of 120. Transit time 3 days from DC-CENTRAL.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 2400, type: 'cost-avoidance' } },
    { module: 'drp', action: 'Rebalance inventory', entity: 'MTR-100 · DC-EAST → DC-WEST', entityType: 'transfer', rationale: 'DC-WEST projected stockout in Week 4. DC-EAST has 180 excess units above safety stock. Transfer cost $680 vs $8,500 stockout risk.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 8500, type: 'cost-avoidance' } },
    { module: 'drp', action: 'Reject transfer', entity: 'MTR-700 · DC-CENTRAL → DC-EAST', entityType: 'transfer', rationale: 'Transfer cost $1,200 exceeds stockout risk of $900. DC-EAST demand is declining per latest forecast revision.', decidedBy: 'Planner', status: 'dismissed', financialImpact: { amount: 1200, type: 'savings' } },
    { module: 'drp', action: 'Increase safety stock', entity: 'HOUS-SM @ DC-WEST', entityType: 'policy', rationale: 'Service level dropped to 91% over last 4 weeks. Demand variability coefficient increased 18%. Recommend SS increase from 80 to 110 units.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 3200, type: 'cost-avoidance' } },
    { module: 'drp', action: 'Defer replenishment', entity: 'WIND-LG @ DC-NORTH', entityType: 'planned-order', rationale: 'Projected on-hand remains above SS through period 6. Deferring saves carrying cost and aligns with demand trough.', decidedBy: 'AI recommended', status: 'deferred', financialImpact: { amount: 1800, type: 'savings' } },

    // MRP decisions (5)
    { module: 'mrp', action: 'Expedite PO', entity: 'MTR-200 · PLANT-SOUTH', entityType: 'exception', rationale: 'Material shortage in Week 3 — ROT-B lead time exceeds schedule. Expedited from supplier SUP-STEEL. Premium freight required.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 2400, type: 'cost' } },
    { module: 'mrp', action: 'Cancel planned order', entity: 'HOUS-LG · PLANT-SOUTH', entityType: 'planned-order', rationale: 'Demand revision removed Week 6 gross requirement. Existing inventory covers remaining periods through horizon.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 1800, type: 'savings' } },
    { module: 'mrp', action: 'Reschedule in', entity: 'WIND-MED · PLANT-NORTH', entityType: 'exception', rationale: 'Planned receipt in Week 5 but needed in Week 3. Pulled forward to align with parent MTR-300 assembly schedule.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 4500, type: 'cost-avoidance' } },
    { module: 'mrp', action: 'Reschedule out', entity: 'ROT-A · PLANT-SOUTH', entityType: 'exception', rationale: 'Planned order in Week 2 no longer needed until Week 5. Pushing out frees capacity and reduces WIP inventory.', decidedBy: 'Planner', status: 'accepted', financialImpact: { amount: 960, type: 'savings' } },
    { module: 'mrp', action: 'Substitute material', entity: 'SHAFT-C → SHAFT-D · PLANT-NORTH', entityType: 'exception', rationale: 'SHAFT-C supplier delay of 2 weeks. SHAFT-D is qualified alternate with 85 units on-hand. No engineering change required.', decidedBy: 'AI recommended', status: 'deferred', financialImpact: { amount: 6200, type: 'cost-avoidance' } },

    // Demand decisions (4)
    { module: 'demand', action: 'Override forecast', entity: 'MTR-500 · All DCs', entityType: 'forecast', rationale: 'Seasonal pattern detected but exponential smoothing missed it. Manual adjustment +15% for Weeks 5-8 based on prior year actuals.', decidedBy: 'Planner', status: 'accepted', financialImpact: { amount: 12000, type: 'cost-avoidance' } },
    { module: 'demand', action: 'Accept AI forecast', entity: 'HOUS-SM · Walmart channel', entityType: 'forecast', rationale: 'Weighted ensemble model outperformed 3-month moving average by 8.2% MAPE. Recommendation to adopt AI forecast for Q2 planning cycle.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 15000, type: 'cost-avoidance' } },
    { module: 'demand', action: 'Adjust seasonality index', entity: 'WIND-LG · Northeast region', entityType: 'parameter', rationale: 'Climate data shows earlier spring onset. Shifting seasonal peak forward by 2 weeks improves forecast accuracy by 4.1%.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 7800, type: 'cost-avoidance' } },
    { module: 'demand', action: 'Flag demand anomaly', entity: 'ROT-B · Amazon channel', entityType: 'alert', rationale: 'Week 4 order spike 340% above baseline. Likely promotional event not in plan. Recommending hold until confirmation from sales.', decidedBy: 'AI recommended', status: 'deferred', financialImpact: { amount: 22000, type: 'risk' } },

    // Production decisions (4)
    { module: 'production', action: 'Switch to chase strategy', entity: 'PLANT-NORTH · Small Motors', entityType: 'strategy', rationale: 'Level strategy shows 23% overstock in Weeks 5-8. Chase reduces inventory carrying cost by $4,200 with acceptable overtime premium.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 4200, type: 'savings' } },
    { module: 'production', action: 'Add overtime shift', entity: 'PLANT-SOUTH · Line 2', entityType: 'capacity', rationale: 'Week 3-4 demand exceeds regular capacity by 140 units. Saturday shift covers gap at $2,100 overtime vs $9,800 stockout cost.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 7700, type: 'cost-avoidance' } },
    { module: 'production', action: 'Defer capacity expansion', entity: 'PLANT-WEST · Assembly cell', entityType: 'capacity', rationale: 'Utilization trending down to 72%. Recommend monitoring for 2 more periods before committing $45K capital expenditure.', decidedBy: 'Planner', status: 'accepted', financialImpact: { amount: 45000, type: 'savings' } },
    { module: 'production', action: 'Rebalance product mix', entity: 'PLANT-NORTH · Lines 1-3', entityType: 'schedule', rationale: 'Moving HOUS-LG from Line 1 to Line 3 reduces changeover by 4.5 hours/week. Net capacity gain of 90 units.', decidedBy: 'AI recommended', status: 'deferred', financialImpact: { amount: 3600, type: 'savings' } },

    // Scheduling decisions (4)
    { module: 'scheduling', action: 'Resequence EDD to SPT', entity: 'PLANT-WEST · WC-ASSEMBLY', entityType: 'sequence', rationale: 'SPT reduces makespan by 12h with zero additional late orders. Same due-date compliance at lower WIP.', decidedBy: 'Planner', status: 'deferred', financialImpact: { amount: 2800, type: 'savings' } },
    { module: 'scheduling', action: 'Split batch', entity: 'ORD-4471 · PLANT-NORTH', entityType: 'order', rationale: 'Order of 500 units split into 2x250. First batch ships on-time for priority customer. Second batch follows in 48h.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 5400, type: 'cost-avoidance' } },
    { module: 'scheduling', action: 'Reassign work center', entity: 'ORD-4485 · WC-GRIND → WC-GRIND-2', entityType: 'routing', rationale: 'WC-GRIND at 98% utilization. WC-GRIND-2 has 6h available. Reassignment avoids 1-day delay on critical path order.', decidedBy: 'AI recommended', status: 'accepted', financialImpact: { amount: 3200, type: 'cost-avoidance' } },
    { module: 'scheduling', action: 'Accept schedule freeze', entity: 'PLANT-SOUTH · Week 14', entityType: 'policy', rationale: 'Freezing the 7-day horizon reduces nervousness. 94% of orders within frozen window ship on-time vs 81% without freeze.', decidedBy: 'AI recommended', status: 'dismissed', financialImpact: { amount: 1500, type: 'cost-avoidance' } },
  ];

  // Spread dates over last 5 days
  const dates = ['2026-03-24', '2026-03-25', '2026-03-25', '2026-03-26', '2026-03-26', '2026-03-27', '2026-03-27', '2026-03-28'];

  seedData.forEach((d, i) => {
    const date = dates[i % dates.length];
    const ts = new Date(`${date}T${String(8 + (i % 10)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00Z`).toISOString();
    const decision = {
      id: genId(),
      timestamp: ts,
      date,
      module: d.module,
      action: d.action,
      entityType: d.entityType,
      entityId: d.entity,
      entity: d.entity,
      rationale: d.rationale,
      decidedBy: d.decidedBy,
      financialImpact: d.financialImpact,
      status: d.status,
    };
    decisions.push(decision);
  });
}

// Run seed on module load
seed();
