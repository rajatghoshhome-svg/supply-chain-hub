/**
 * Production Planning AI Context Builder
 *
 * Translates production plan output (chase/level/hybrid strategies, RCCP)
 * into a structured prompt for Claude to analyze capacity, recommend
 * production strategies, and explain trade-offs.
 *
 * ASCM context: Production Planning sits between DRP and MPS/Scheduling.
 * It receives plant gross requirements from DRP and determines the
 * aggregate production strategy per plant.
 */

const SYSTEM_PROMPT = `You are an ASCM/APICS-certified production planning assistant embedded in a supply chain planning platform for small and mid-size manufacturers ($50M-$500M revenue).

Your role:
1. ANALYZE production strategies (chase, level, hybrid) and recommend the best fit
2. EVALUATE rough-cut capacity plans — flag overloads and bottlenecks
3. EXPLAIN trade-offs: inventory carrying cost vs hiring/layoff cost vs overtime premiums
4. IDENTIFY risks: capacity bottlenecks, demand-supply mismatches, subcontract dependencies

Rules:
- Cite specific plant codes, work centers, periods, and quantities
- Chase minimizes inventory but has high workforce volatility cost
- Level has stable workforce but builds inventory (carrying cost risk)
- Hybrid balances both — base rate + overtime + subcontract flex
- RCCP utilization above 90% is a warning; above 100% is critical overload
- Consider product family groupings — a bottleneck on one family affects scheduling
- Format strategy comparisons as markdown tables
- If one strategy clearly dominates, state it directly with numbers
- Keep recommendations actionable — "switch PLANT-NORTH to chase for small motors because..."
- NEVER fabricate data. Only analyze what's provided.

ASCM MPC Framework position:
  Demand → DRP → **Production Plan (S&OP)** → MPS (RCCP) → MRP + Scheduling
  Production Planning answers: HOW MUCH to produce, and with WHAT strategy.
  It does NOT answer WHAT SEQUENCE (that's Scheduling) or WHAT MATERIALS (that's MRP).`;

/**
 * Build structured context for Claude to analyze production plan output.
 *
 * @param {Object} params
 * @param {Object} params.plantPlan - Per-plant production plan results
 * @param {string[]} params.periods - Period labels
 * @param {Object} params.rccp - RCCP results per plant
 * @param {string} [params.plannerQuestion] - Optional question from the planner
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
export function buildProductionContext({ plantPlan, periods, rccp, plannerQuestion }) {
  const sections = [];

  sections.push(`## Planning Horizon: ${periods.length} periods`);
  sections.push(`Periods: ${periods.join(', ')}\n`);

  // Per-plant strategy comparison
  if (plantPlan) {
    for (const [plantCode, plan] of Object.entries(plantPlan)) {
      sections.push(`## ${plantCode} — Production Plan`);

      if (plan.strategies) {
        for (const [stratName, strat] of Object.entries(plan.strategies)) {
          sections.push(`\n### ${stratName.charAt(0).toUpperCase() + stratName.slice(1)} Strategy`);
          sections.push(`Total Cost: $${strat.totalCost?.toLocaleString() || 'N/A'}`);
          if (strat.production) {
            sections.push(`Production: ${strat.production.join(', ')}`);
          }
          if (strat.inventory) {
            sections.push(`Ending Inventory: ${strat.inventory.join(', ')}`);
          }
          if (strat.overtime) {
            sections.push(`Overtime Units: ${strat.overtime.join(', ')}`);
          }
          if (strat.subcontract) {
            sections.push(`Subcontract Units: ${strat.subcontract.join(', ')}`);
          }
        }
      }

      if (plan.recommended) {
        sections.push(`\n**Recommended Strategy:** ${plan.recommended}`);
      }

      if (plan.grossReqs) {
        sections.push(`\nGross Requirements: ${plan.grossReqs.join(', ')}`);
      }
    }
  }

  // RCCP Analysis
  if (rccp) {
    sections.push(`\n## Rough-Cut Capacity Planning (RCCP)`);
    for (const [plantCode, wcResults] of Object.entries(rccp)) {
      sections.push(`\n### ${plantCode}`);
      if (Array.isArray(wcResults)) {
        for (const wc of wcResults) {
          sections.push(`\n#### ${wc.workCenter} (${wc.workCenterName || ''})`);
          sections.push('| Period | Load (hrs) | Available (hrs) | Utilization | Status |');
          sections.push('|--------|-----------|-----------------|-------------|--------|');
          if (wc.periods) {
            for (const p of wc.periods) {
              const util = `${(p.utilization * 100).toFixed(0)}%`;
              const status = p.overloaded ? 'OVERLOAD' : p.utilization > 0.9 ? 'WARNING' : 'OK';
              sections.push(`| ${p.period} | ${p.loadHours.toFixed(1)} | ${p.availableHours.toFixed(1)} | ${util} | ${status} |`);
            }
          }
          if (wc.avgUtilization != null) {
            sections.push(`Avg Utilization: ${(wc.avgUtilization * 100).toFixed(0)}%, Overloaded Periods: ${wc.overloadedPeriods || 0}`);
          }
        }
      }
    }
  }

  let userMessage = `Analyze this production plan and provide recommendations:\n\n${sections.join('\n')}`;

  if (plannerQuestion) {
    userMessage += `\n\n---\nPlanner's question: ${plannerQuestion}`;
  }

  userMessage += `\n\nPlease provide:
1. Strategy recommendation per plant with cost justification
2. Capacity bottleneck assessment — which work centers are at risk
3. Trade-off analysis (inventory cost vs flexibility cost)
4. Specific action items for the production planner
5. Risks to monitor in the next planning cycle`;

  return { systemPrompt: SYSTEM_PROMPT, userMessage };
}

/**
 * Build lightweight chat context for the production planning module.
 * Called from the central chat dispatcher with cached live data.
 *
 * @param {Object} params
 * @param {Object[]} params.plants - Plant list
 * @param {Object} params.plantWorkCenters - Work center data keyed by plant code
 * @param {Function} params.getProductsForPlant - Function to get products per plant
 * @param {Object} params.liveData - Cached live engine snapshot
 * @returns {{ systemPromptSection: string, dataSnapshot: object }}
 */
export function buildProductionChatContext({ plants, plantWorkCenters, getProductsForPlant, liveData }) {
  const lines = ['\n## Production Planning Context'];
  for (const plant of plants) {
    const wcs = plantWorkCenters[plant.code] || [];
    lines.push(`${plant.code} (${plant.city}): capacity ${plant.weeklyCapacity} units/week, ${wcs.length} work centers`);
    lines.push(`  Products: ${getProductsForPlant(plant.code).join(', ')}`);
  }

  const systemPromptSection = `\n## ASCM Production Planning Methodology
Production strategies: Chase (match demand, variable workforce), Level (constant rate, build inventory), Hybrid (base rate + overtime/subcontract).
Rough-Cut Capacity Planning (RCCP): validates MPS against critical work center capacity.
Utilization > 90% = warning, > 100% = critical overload requiring action.
Trade-offs: inventory carrying cost vs workforce volatility vs overtime premiums.
Capabilities: strategy selection, bottleneck identification, overtime recommendations.`;

  let dataSnapshot = null;
  if (liveData?.prodSummaries) {
    lines.push('\nProduction Planning:');
    for (const [pc, s] of Object.entries(liveData.prodSummaries)) {
      lines.push(`  ${pc}: total demand=${s.totalDemand} units, recommended strategy=${s.recommended}`);
    }
    dataSnapshot = { prodSummaries: liveData.prodSummaries };
  }

  return {
    systemPromptSection: systemPromptSection + '\n' + lines.join('\n'),
    dataSnapshot,
  };
}

/**
 * Format production plan summary for API response.
 */
export function formatProductionSummary(plantPlan) {
  const summary = {};
  for (const [plantCode, plan] of Object.entries(plantPlan)) {
    summary[plantCode] = {
      recommended: plan.recommended,
      totalCosts: {},
    };
    if (plan.strategies) {
      for (const [name, strat] of Object.entries(plan.strategies)) {
        summary[plantCode].totalCosts[name] = strat.totalCost;
      }
    }
  }
  return summary;
}
