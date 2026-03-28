/**
 * MRP AI Context Builder
 *
 * Translates MRP engine output (deterministic records + exceptions) into
 * a structured prompt for Claude. The AI layer's job is to:
 *   1. Prioritize exceptions by business impact
 *   2. Explain root causes in planner-friendly language
 *   3. Suggest resolution actions with rationale
 *   4. Identify cascading risks (e.g., late raw material → multiple FGs affected)
 *
 * This is a pure function — no DB access, no API calls. It builds the
 * system prompt + user message that gets sent to the Claude API.
 */

const SYSTEM_PROMPT = `You are an ASCM/APICS-certified MRP planning assistant embedded in a supply chain planning platform used by small and mid-size manufacturers ($50M-$500M revenue).

Your role:
1. ANALYZE MRP exceptions and prioritize by business impact
2. EXPLAIN root causes using supply chain terminology the planner understands
3. RECOMMEND specific actions (expedite, reschedule, cancel, increase safety stock)
4. IDENTIFY cascading risks — when one exception triggers downstream problems

Rules:
- Always cite specific SKU codes, quantities, and dates
- Express financial impact when possible (e.g., "delaying 50 units of MTR-500 risks $X in late delivery penalties")
- Group related exceptions (e.g., if a raw material shortage affects multiple finished goods, group them)
- Distinguish between CRITICAL (production stoppage risk), WARNING (service level risk), and INFO (optimization opportunity)
- Use markdown tables for multi-exception summaries
- Keep recommendations actionable — include "who does what by when"
- If no exceptions exist, confirm the plan is clean and highlight any optimization opportunities
- NEVER fabricate data. Only analyze what's provided in the MRP results.`;

/**
 * Build the AI context message from MRP run results
 *
 * @param {Object} params
 * @param {Array} params.mrpResults - Array of { sku, records, exceptions } from runMRP
 * @param {Object} params.bomTree - The BOM adjacency map
 * @param {Array} params.periods - The planning periods
 * @param {string} [params.plannerQuestion] - Optional natural language question from planner
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
export function buildMRPContext({ mrpResults, bomTree, periods, plannerQuestion }) {
  const sections = [];

  // ─── Header ─────────────────────────────────────────────────────
  sections.push(`## MRP Run Results`);
  sections.push(`**Planning horizon:** ${periods[0]} to ${periods[periods.length - 1]} (${periods.length} weekly periods)`);
  sections.push(`**SKUs planned:** ${mrpResults.length}`);

  // ─── Exception Summary ──────────────────────────────────────────
  const allExceptions = mrpResults.flatMap(r =>
    r.exceptions.map(e => ({ ...e, skuName: r.sku.name }))
  );

  const critical = allExceptions.filter(e => e.severity === 'critical');
  const warnings = allExceptions.filter(e => e.severity === 'warning');
  const info = allExceptions.filter(e => e.severity === 'info');

  sections.push(`\n## Exception Summary`);
  sections.push(`- **Critical:** ${critical.length}`);
  sections.push(`- **Warning:** ${warnings.length}`);
  sections.push(`- **Info:** ${info.length}`);

  if (allExceptions.length > 0) {
    sections.push(`\n### Exception Details`);
    sections.push(`| SKU | Type | Severity | Period | Qty | Message |`);
    sections.push(`|-----|------|----------|--------|-----|---------|`);
    for (const ex of allExceptions) {
      const period = ex.period || ex.fromPeriod || '—';
      sections.push(
        `| ${ex.skuCode} | ${ex.type} | ${ex.severity} | ${period} | ${ex.qty || '—'} | ${ex.message} |`
      );
    }
  }

  // ─── Shortage Analysis ──────────────────────────────────────────
  // Identify SKUs where projected OH goes negative (before planned receipts)
  const shortages = [];
  for (const result of mrpResults) {
    for (let t = 0; t < result.records.length; t++) {
      const rec = result.records[t];
      if (rec.netReq > 0) {
        shortages.push({
          skuCode: result.sku.code,
          skuName: result.sku.name,
          period: rec.period,
          netReq: rec.netReq,
          projectedOH: rec.projectedOH,
        });
      }
    }
  }

  if (shortages.length > 0) {
    sections.push(`\n## Material Shortages (Net Requirements > 0)`);
    sections.push(`| SKU | Period | Net Requirement | Projected OH |`);
    sections.push(`|-----|--------|----------------|--------------|`);
    for (const s of shortages) {
      sections.push(`| ${s.skuCode} (${s.skuName}) | ${s.period} | ${s.netReq} | ${s.projectedOH} |`);
    }
  }

  // ─── BOM Dependency Map (for cascade analysis) ──────────────────
  sections.push(`\n## BOM Structure (for cascade analysis)`);
  for (const [parent, children] of Object.entries(bomTree)) {
    const childStr = children
      .map(c => `${c.childCode} (×${c.qtyPer}${c.scrapPct > 0 ? `, ${c.scrapPct}% scrap` : ''})`)
      .join(', ');
    sections.push(`- **${parent}** → ${childStr}`);
  }

  // ─── Planned Order Releases (for procurement visibility) ────────
  const releases = [];
  for (const result of mrpResults) {
    for (const rec of result.records) {
      if (rec.plannedOrderRelease > 0) {
        releases.push({
          skuCode: result.sku.code,
          period: rec.period,
          qty: rec.plannedOrderRelease,
        });
      }
    }
  }

  if (releases.length > 0) {
    sections.push(`\n## Planned Order Releases`);
    sections.push(`| SKU | Period | Quantity |`);
    sections.push(`|-----|--------|----------|`);
    for (const r of releases) {
      sections.push(`| ${r.skuCode} | ${r.period} | ${r.qty} |`);
    }
  }

  // ─── Assemble user message ──────────────────────────────────────
  let userMessage = sections.join('\n');

  if (plannerQuestion) {
    userMessage += `\n\n## Planner Question\n${plannerQuestion}`;
  } else {
    userMessage += `\n\n## Task\nAnalyze these MRP results. Prioritize the exceptions by business impact, explain root causes, recommend specific actions, and identify any cascading risks across the BOM.`;
  }

  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
  };
}

/**
 * Build lightweight chat context for the MRP module.
 * Called from the central chat dispatcher with cached live data.
 *
 * @param {Object} params
 * @param {Object[]} params.plants - Plant list
 * @param {Object} params.plantBOMs - BOM data keyed by plant code
 * @param {Function} params.getProductsForPlant - Function to get products per plant
 * @param {Object} params.liveData - Cached live engine snapshot
 * @returns {{ systemPromptSection: string, dataSnapshot: object }}
 */
export function buildMRPChatContext({ plants, plantBOMs, getProductsForPlant, liveData }) {
  const lines = ['\n## MRP Context'];
  lines.push('Plant-specific BOMs — same FG may have different component structure per plant');
  for (const plant of plants) {
    const bom = plantBOMs[plant.code] || {};
    const fgs = Object.keys(bom);
    lines.push(`${plant.code}: ${fgs.length} FG BOMs defined (${fgs.join(', ')})`);
  }
  lines.push('\nDual-sourced: MTR-200 uses ROT-A at PLANT-NORTH, ROT-B at PLANT-SOUTH');

  const systemPromptSection = `\n## ASCM MRP Methodology
MRP netting logic: Gross Requirements - Scheduled Receipts - On Hand = Net Requirements.
Lead time offsetting: Planned Order Release = Planned Order Receipt offset by lead time.
Lot sizing rules: lot-for-lot, FOQ (fixed order quantity), POQ (period order quantity).
Exception types: expedite (need date < release date), defer, cancel, reschedule.
Capabilities: expedite/defer recommendations, substitute suggestions, exception prioritization.`;

  let dataSnapshot = null;
  if (liveData?.mrpSummaries) {
    lines.push('\nMRP Summary:');
    for (const [pc, s] of Object.entries(liveData.mrpSummaries)) {
      lines.push(`  ${pc}: ${s.totalExceptions} exceptions (${s.critical} critical)`);
      if (s.topShortages?.length > 0) {
        lines.push(`    shortages: ${s.topShortages.map(sh => `${sh.sku} period ${sh.period} (${Math.round(sh.qty)} units)`).join(', ')}`);
      }
    }
    dataSnapshot = { mrpSummaries: liveData.mrpSummaries };
  }

  return {
    systemPromptSection: systemPromptSection + '\n' + lines.join('\n'),
    dataSnapshot,
  };
}

/**
 * Format a single MRP record for display (used by route)
 */
export function formatMRPSummary(mrpResults) {
  return mrpResults.map(result => ({
    skuCode: result.sku.code,
    skuName: result.sku.name,
    totalNetReq: result.records.reduce((sum, r) => sum + r.netReq, 0),
    totalPlannedOrders: result.records.reduce((sum, r) => sum + r.plannedOrderReceipt, 0),
    exceptionCount: result.exceptions.length,
    criticalExceptions: result.exceptions.filter(e => e.severity === 'critical').length,
    records: result.records,
    exceptions: result.exceptions,
  }));
}
