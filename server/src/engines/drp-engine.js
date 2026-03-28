/**
 * DRP Engine — Distribution Requirements Planning
 *
 * ASCM MPC Framework position:
 *   Demand Plan → DRP → Production Plan → MPS → MRP
 *
 * DRP operates at the distribution level:
 *   - Input: DC-level demand forecast + DC inventory + network lanes
 *   - Output: Planned shipments from source (plant) to each DC
 *   - Key output: Aggregated plant-level gross requirements
 *
 * DRP is NOT MRP for finished goods. Key differences:
 *   1. Operates per-SKU per-location (DC level)
 *   2. Generates planned SHIPMENTS (not production orders)
 *   3. Offsets by TRANSIT lead time (not manufacturing lead time)
 *   4. Aggregates across all DCs to create plant-level gross requirements
 *   5. Handles fair-share allocation when plant supply < total DC demand
 *
 * All functions are pure — no side effects, no DB calls.
 */

/**
 * Run DRP netting for a single DC location + SKU.
 *
 * Uses the same gross-to-net logic as MRP but generates planned shipments
 * instead of planned orders, offset by transit (not manufacturing) lead time.
 *
 * @param {Object} params
 * @param {string} params.skuCode
 * @param {string} params.locationCode
 * @param {string[]} params.periods - Array of period labels (dates)
 * @param {number[]} params.grossReqs - Demand forecast per period
 * @param {number[]} params.scheduledReceipts - In-transit shipments arriving per period
 * @param {number} params.onHand - Starting on-hand inventory
 * @param {number} params.safetyStock - Safety stock level
 * @param {number} params.transitLeadTime - Periods to ship from source to DC
 * @param {string} params.sourceCode - Source plant code
 * @returns {{ records: Object[], exceptions: Object[] }}
 */
export function runDRPForLocation({
  skuCode,
  locationCode,
  periods,
  grossReqs,
  scheduledReceipts,
  onHand,
  safetyStock,
  transitLeadTime,
  sourceCode,
}) {
  const numPeriods = periods.length;
  const records = [];
  const exceptions = [];
  let runningOH = onHand;

  // Phase 1: Gross-to-net netting — determine planned shipment receipts
  for (let i = 0; i < numPeriods; i++) {
    const gr = grossReqs[i] || 0;
    const sr = scheduledReceipts[i] || 0;

    const projOH = runningOH + sr - gr;
    let netReq = 0;
    let plannedShipment = 0;

    if (projOH < safetyStock) {
      // Need enough to bring OH back to safety stock
      netReq = safetyStock - projOH;
      plannedShipment = netReq;
      runningOH = safetyStock; // OH resets to SS after planned shipment covers gap
    } else {
      runningOH = projOH;
    }

    records.push({
      period: periods[i],
      locationCode,
      skuCode,
      sourceCode,
      grossReq: gr,
      scheduledReceipts: sr,
      projectedOH: projOH < safetyStock ? safetyStock : projOH,
      netReq,
      plannedShipment,        // Receipt at the DC
      plannedShipmentRelease: 0, // Will be filled in phase 2
    });
  }

  // Phase 2: Lead time offset — planned shipment release at source
  // If DC needs receipt in period i, the plant must ship in period (i - transitLeadTime)
  for (let i = 0; i < numPeriods; i++) {
    const shipment = records[i].plannedShipment;
    if (shipment <= 0) continue;

    const releaseIdx = i - transitLeadTime;
    if (releaseIdx < 0) {
      // Can't release before the planning horizon — need to expedite
      exceptions.push({
        type: 'expedite',
        severity: 'critical',
        skuCode,
        locationCode,
        period: periods[i],
        releasePeriod: releaseIdx,
        qty: shipment,
        message: `Shipment of ${shipment} to ${locationCode} needed in ${periods[i]} but transit LT of ${transitLeadTime} periods requires release before planning horizon. Expedite required.`,
      });
      // Still place the release in period 0 as best effort
      records[0].plannedShipmentRelease += shipment;
    } else {
      records[releaseIdx].plannedShipmentRelease += shipment;
    }
  }

  return { records, exceptions };
}

/**
 * Run full DRP across all DC locations for a single SKU.
 *
 * Runs netting per DC, then aggregates planned shipment releases
 * into plant-level gross requirements.
 *
 * @param {Object} params
 * @param {string} params.skuCode
 * @param {string[]} params.periods
 * @param {Object[]} params.locations - Array of DC configurations
 * @returns {{ dcResults: Object[], plantRequirements: Object, exceptions: Object[] }}
 */
export function runDRP({ skuCode, periods, locations }) {
  const dcResults = [];
  const allExceptions = [];

  // Run netting for each DC
  for (const loc of locations) {
    const result = runDRPForLocation({
      skuCode,
      locationCode: loc.code,
      periods,
      grossReqs: loc.grossReqs,
      scheduledReceipts: loc.scheduledReceipts,
      onHand: loc.onHand,
      safetyStock: loc.safetyStock,
      transitLeadTime: loc.transitLeadTime,
      sourceCode: loc.sourceCode,
    });

    dcResults.push({
      locationCode: loc.code,
      records: result.records,
      exceptions: result.exceptions,
    });

    allExceptions.push(...result.exceptions);
  }

  // Determine the source plant (use the first location's source — single-plant A-lite scope)
  const plantCode = locations[0]?.sourceCode || 'PLANT-MAIN';

  // Aggregate DC shipment releases into plant-level gross requirements
  const plantRequirements = aggregatePlantRequirements({
    dcResults,
    plantCode,
    periods,
  });

  return {
    skuCode,
    dcResults,
    plantRequirements,
    exceptions: allExceptions,
  };
}

/**
 * Aggregate planned shipment releases from all DCs into plant-level gross requirements.
 *
 * This is the critical DRP output that feeds into Production Planning.
 * The plant must produce enough to satisfy all DC shipment releases.
 *
 * @param {Object} params
 * @param {Object[]} params.dcResults - Results from runDRPForLocation per DC
 * @param {string} params.plantCode
 * @param {string[]} params.periods
 * @returns {{ plantCode: string, grossReqs: number[], byDC: Object }}
 */
export function aggregatePlantRequirements({ dcResults, plantCode, periods }) {
  const numPeriods = periods.length;
  const grossReqs = new Array(numPeriods).fill(0);
  const byDC = {};

  for (const dc of dcResults) {
    const dcReleases = new Array(numPeriods).fill(0);

    for (let i = 0; i < numPeriods; i++) {
      const release = dc.records[i]?.plannedShipmentRelease || 0;
      grossReqs[i] += release;
      dcReleases[i] = release;
    }

    byDC[dc.locationCode] = dcReleases;
  }

  return {
    plantCode,
    periods,
    grossReqs,
    byDC,
  };
}

/**
 * Fair-share allocation when plant supply < total DC demand.
 *
 * ASCM rule: allocate proportionally to each DC's share of total demand,
 * with integer rounding that preserves the total.
 *
 * @param {Object} params
 * @param {number} params.available - Units available at the plant
 * @param {Object[]} params.demands - Array of { locationCode, demand }
 * @returns {Object[]} Array of { locationCode, demand, allocated }
 */
export function fairShareAllocation({ available, demands }) {
  const totalDemand = demands.reduce((sum, d) => sum + d.demand, 0);

  // If supply >= demand, allocate full demand
  if (available >= totalDemand) {
    return demands.map(d => ({
      locationCode: d.locationCode,
      demand: d.demand,
      allocated: d.demand,
    }));
  }

  // If no demand or no supply, allocate zero
  if (totalDemand === 0 || available === 0) {
    return demands.map(d => ({
      locationCode: d.locationCode,
      demand: d.demand,
      allocated: 0,
    }));
  }

  // Proportional allocation with largest-remainder rounding
  const rawAllocations = demands.map(d => ({
    locationCode: d.locationCode,
    demand: d.demand,
    rawShare: (d.demand / totalDemand) * available,
  }));

  // Floor each allocation
  const result = rawAllocations.map(a => ({
    locationCode: a.locationCode,
    demand: a.demand,
    allocated: Math.floor(a.rawShare),
    remainder: a.rawShare - Math.floor(a.rawShare),
  }));

  // Distribute remaining units by largest remainder
  let remaining = available - result.reduce((sum, r) => sum + r.allocated, 0);

  // Sort by remainder descending (stable: keep original order for ties)
  const sortedIndices = result
    .map((r, i) => ({ idx: i, remainder: r.remainder }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const { idx } of sortedIndices) {
    if (remaining <= 0) break;
    result[idx].allocated += 1;
    remaining -= 1;
  }

  // Clean up: remove internal remainder field
  return result.map(({ locationCode, demand, allocated }) => ({
    locationCode,
    demand,
    allocated,
  }));
}
