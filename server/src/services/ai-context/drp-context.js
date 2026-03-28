/**
 * DRP AI Context Builder
 *
 * Translates DRP engine output into a structured prompt for Claude
 * to analyze distribution exceptions, recommend rebalancing, and
 * explain the supply chain dynamics.
 *
 * ASCM context: DRP sits between Demand Plan and Production Plan.
 * Its output (plant-level gross requirements) feeds into Production
 * Planning, which determines the production strategy (chase/level/hybrid).
 */

/**
 * Build a structured context object for Claude to analyze DRP results.
 *
 * @param {Object} params
 * @param {Object[]} params.results - Array of runDRP results (per SKU)
 * @param {Object} params.network - { locations, lanes }
 * @param {Object} params.plantInventory - Plant FG inventory positions
 * @param {string[]} params.periods - Period labels
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
export function buildDRPContext({ results, network, plantInventory, periods }) {
  const systemPrompt = `You are a supply chain planning expert specializing in Distribution Requirements Planning (DRP) within the ASCM/APICS Manufacturing Planning and Control (MPC) framework.

Your role is to analyze DRP output and provide actionable recommendations. Key principles:

1. DRP POSITION IN CASCADE: Demand Plan → DRP → Production Plan → MPS → MRP
   - DRP receives demand forecasts allocated to distribution centers
   - DRP output (plant gross requirements) feeds into Production Planning
   - The plant decides HOW to produce; DRP decides WHERE to ship

2. DRP NETTING LOGIC:
   - Same gross-to-net as MRP but at distribution level
   - Net requirements become planned SHIPMENTS (not production orders)
   - Lead time offset uses TRANSIT time (not manufacturing time)

3. FAIR-SHARE ALLOCATION:
   - When plant supply < total DC demand, allocate proportionally
   - Consider service level priorities (A/B/C customers per DC)
   - Balance stockout risk across the network

4. EXCEPTION ANALYSIS:
   - Expedite: transit lead time exceeds available time
   - Rebalance: one DC overstocked while another is short
   - Safety stock violation: projected OH falls below SS

When analyzing, consider:
- Network balance (inventory distribution across DCs)
- Transit lead time impact on responsiveness
- Plant capacity constraints implied by aggregated requirements
- Seasonal demand patterns affecting replenishment timing

Provide specific, actionable recommendations. Reference period numbers and quantities.
Format recommendations as a prioritized list with severity (critical/warning/info).`;

  // Build the user message with structured DRP data
  const sections = [];

  // Network topology
  sections.push('## Distribution Network');
  if (network?.locations) {
    for (const loc of network.locations) {
      sections.push(`- ${loc.code} (${loc.type}): ${loc.name}, ${loc.city} ${loc.state}`);
    }
  }
  if (network?.lanes) {
    sections.push('\nLanes:');
    for (const lane of network.lanes) {
      sections.push(`- ${lane.source} → ${lane.dest}: ${lane.leadTimePeriods} period(s) transit, $${lane.transitCostPerUnit}/unit`);
    }
  }

  // Plant inventory
  if (plantInventory) {
    sections.push('\n## Plant Inventory (Finished Goods)');
    for (const [plant, skus] of Object.entries(plantInventory)) {
      for (const [sku, inv] of Object.entries(skus)) {
        sections.push(`- ${plant} / ${sku}: OH=${inv.onHand}, SS=${inv.safetyStock}`);
      }
    }
  }

  // Per-SKU DRP results
  for (const result of results) {
    sections.push(`\n## DRP Results — ${result.skuCode}`);

    // DC-level detail
    for (const dc of result.dcResults) {
      sections.push(`\n### ${dc.locationCode}`);
      sections.push('| Period | Gross Req | Sched Rcpt | Proj OH | Net Req | Pln Ship | Pln Release |');
      sections.push('|--------|-----------|------------|---------|---------|----------|-------------|');
      for (const rec of dc.records) {
        sections.push(`| ${rec.period} | ${rec.grossReq} | ${rec.scheduledReceipts} | ${rec.projectedOH} | ${rec.netReq} | ${rec.plannedShipment} | ${rec.plannedShipmentRelease} |`);
      }
    }

    // Plant-level aggregation
    if (result.plantRequirements) {
      sections.push(`\n### Plant Gross Requirements (${result.plantRequirements.plantCode})`);
      sections.push(`Periods: ${periods.join(', ')}`);
      sections.push(`Gross Reqs: ${result.plantRequirements.grossReqs.join(', ')}`);

      if (result.plantRequirements.byDC) {
        sections.push('\nBreakdown by DC:');
        for (const [dc, releases] of Object.entries(result.plantRequirements.byDC)) {
          sections.push(`- ${dc}: ${releases.join(', ')}`);
        }
      }
    }

    // Exceptions
    if (result.exceptions?.length > 0) {
      sections.push(`\n### Exceptions (${result.exceptions.length})`);
      for (const exc of result.exceptions) {
        sections.push(`- [${exc.severity.toUpperCase()}] ${exc.type}: ${exc.message}`);
      }
    }
  }

  const userMessage = `Analyze this DRP output and provide recommendations:

${sections.join('\n')}

Please provide:
1. Overall network health assessment
2. Critical exceptions requiring immediate action
3. Rebalancing opportunities across DCs
4. Plant capacity concerns based on aggregated requirements
5. Recommendations for the next planning cycle`;

  return { systemPrompt, userMessage };
}
