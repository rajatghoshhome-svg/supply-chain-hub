/**
 * Briefing / General AI Context Builder
 *
 * Provides a cross-module executive summary for morning briefings and
 * general supply chain conversations. Aggregates snapshots from all
 * planning modules into a single context window.
 *
 * This is the default context when no specific module is selected,
 * or when the user asks for a daily summary / cross-module analysis.
 */

/**
 * Build lightweight chat context for the briefing / general module.
 * Called from the central chat dispatcher with cached live data.
 *
 * @param {Object} params
 * @param {Object[]} params.plants - Plant list
 * @param {Object[]} params.dcs - DC list
 * @param {Object[]} params.products - Product catalog
 * @param {Object[]} params.productFamilies - Product family groupings
 * @param {Object} params.liveData - Cached live engine snapshot (from getLiveData)
 * @returns {{ systemPromptSection: string, dataSnapshot: object }}
 */
export function buildBriefingChatContext({ plants, dcs, products, productFamilies, liveData }) {
  const lines = ['\n## Network Overview'];
  lines.push(`${plants.length} plants, ${dcs.length} DCs, ${products.length} products, ${productFamilies.length} families`);
  lines.push(`Plants: ${plants.map(p => `${p.code} (${p.city}, cap ${p.weeklyCapacity}/wk)`).join('; ')}`);
  lines.push(`DCs: ${dcs.map(d => `${d.code} (${d.city})`).join('; ')}`);
  lines.push(`Products: ${products.map(p => p.code).join(', ')}`);

  const systemPromptSection = `\n## Executive Supply Chain Overview
You provide cross-module analysis spanning the full ASCM MPC cascade:
  Demand Plan -> DRP -> S&OP/Production Plan -> MPS (RCCP) -> MRP + Scheduling
Capabilities: daily summary, attention item prioritization, financial exposure assessment, cross-module impact analysis.
When briefing, lead with the highest-impact items: critical exceptions, capacity overloads, late orders, forecast misses.
Quantify exposure in units and dollars where possible.`;

  let dataSnapshot = null;
  if (liveData) {
    lines.push(`\nPlanning Horizon: ${liveData.periods?.[0]} to ${liveData.periods?.[liveData.periods.length - 1]} (8 weekly periods)`);

    // DRP snapshot
    lines.push(`\nDRP: ${liveData.drpResults} SKUs planned, ${liveData.drpExceptions} exceptions`);

    // Demand snapshot
    if (liveData.demandSnapshots?.length > 0) {
      lines.push('\nDemand Forecasts:');
      for (const d of liveData.demandSnapshots) {
        lines.push(`  ${d.sku}: best method=${d.method}, MAPE=${d.mape}%, next 4 periods=[${d.forecast.join(', ')}]`);
      }
    }

    // Production snapshot
    lines.push('\nProduction Planning:');
    for (const [pc, s] of Object.entries(liveData.prodSummaries || {})) {
      lines.push(`  ${pc}: total demand=${s.totalDemand} units, recommended strategy=${s.recommended}`);
    }

    // Scheduling snapshot
    lines.push('\nScheduling (EDD rule):');
    for (const [pc, s] of Object.entries(liveData.schedSummaries || {})) {
      lines.push(`  ${pc}: ${s.totalOrders} orders, makespan=${s.makespan}h, ${s.lateOrders} late`);
    }

    // MRP snapshot
    lines.push('\nMRP Summary:');
    for (const [pc, s] of Object.entries(liveData.mrpSummaries || {})) {
      lines.push(`  ${pc}: ${s.totalExceptions} exceptions (${s.critical} critical)`);
      if (s.topShortages?.length > 0) {
        lines.push(`    shortages: ${s.topShortages.map(sh => `${sh.sku} period ${sh.period} (${Math.round(sh.qty)} units)`).join(', ')}`);
      }
    }

    // Attention items
    const attentionItems = [];
    const totalMrpCritical = Object.values(liveData.mrpSummaries || {}).reduce((sum, s) => sum + s.critical, 0);
    const totalLateOrders = Object.values(liveData.schedSummaries || {}).reduce((sum, s) => sum + s.lateOrders, 0);
    if (totalMrpCritical > 0) attentionItems.push(`${totalMrpCritical} critical MRP exceptions`);
    if (totalLateOrders > 0) attentionItems.push(`${totalLateOrders} late production orders`);
    if (liveData.drpExceptions > 0) attentionItems.push(`${liveData.drpExceptions} DRP exceptions`);

    if (attentionItems.length > 0) {
      lines.push(`\nATTENTION ITEMS: ${attentionItems.join('; ')}`);
    }

    dataSnapshot = {
      drpResults: liveData.drpResults,
      drpExceptions: liveData.drpExceptions,
      demandSnapshots: liveData.demandSnapshots,
      prodSummaries: liveData.prodSummaries,
      schedSummaries: liveData.schedSummaries,
      mrpSummaries: liveData.mrpSummaries,
    };
  }

  return {
    systemPromptSection: systemPromptSection + '\n' + lines.join('\n'),
    dataSnapshot,
  };
}
