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

// ─────────────────────────────────────────────────────────────────────────────
// New functions for Champion DRP: transit type, move-vs-make, calendar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recommend transit type for a lane based on distance, volume, and rail access.
 *
 * @param {Object} lane - Lane data with distanceMiles, hasRailAccess, mode
 * @param {number} pallets - Number of pallets in this shipment
 * @returns {{ recommended: string, reasoning: string, costEstimate: number }}
 */
export function recommendTransitType(lane, pallets = 0) {
  if (lane.mode === 'STO') {
    return {
      recommended: 'STO',
      reasoning: 'DC-to-DC stock transfer order',
      costEstimate: lane.distanceMiles * (lane.truckCostPerMile || 2.85),
    };
  }

  if (lane.distanceMiles > 1000 && pallets > 15 && lane.hasRailAccess && lane.railCostPerMile) {
    const railCost = lane.distanceMiles * lane.railCostPerMile;
    const truckCost = lane.distanceMiles * (lane.truckCostPerMile || 2.85);
    return {
      recommended: 'rail',
      reasoning: `${lane.distanceMiles} miles with ${pallets} pallets. Rail saves $${Math.round(truckCost - railCost).toLocaleString()} vs truck.`,
      costEstimate: railCost,
      truckCostEstimate: truckCost,
      savings: Math.round(truckCost - railCost),
    };
  }

  return {
    recommended: 'truck',
    reasoning: lane.distanceMiles <= 1000
      ? `Short haul (${lane.distanceMiles} miles) — truck is most efficient`
      : pallets <= 15
        ? `Only ${pallets} pallets — not enough volume to justify rail`
        : `No rail access at destination`,
    costEstimate: lane.distanceMiles * (lane.truckCostPerMile || 2.85),
  };
}

/**
 * Compare move (DC-to-DC transfer) vs make (new production + ship) for a SKU.
 *
 * @param {Object} params
 * @param {string} params.skuName - Product name for display
 * @param {number} params.qty - Units needed
 * @param {number} params.unitWeight - Lbs per unit
 * @param {number} params.unitCost - Production cost per unit
 * @param {Object} params.moveLane - DC-to-DC lane data
 * @param {Object} params.plantLane - Plant-to-destination-DC lane data
 * @param {number} params.handlingCostPerPallet - Default $2
 * @param {number} params.palletsPerUnit - Default 0.02 (50 units per pallet)
 * @returns {{ moveOption, makeOption, recommendation, savingsPercent }}
 */
export function moveVsMakeAnalysis({
  skuName = '',
  qty,
  unitWeight = 25,
  unitCost = 50,
  moveLane,
  plantLane,
  handlingCostPerPallet = 50,
  palletsPerUnit = 0.02,
}) {
  const totalWeight = qty * unitWeight;
  const totalPallets = Math.ceil(qty * palletsPerUnit);

  // Move option: transfer from one DC to another
  const moveTransitCost = totalWeight * (moveLane.costPerLb || 0.10);
  const moveHandlingCost = totalPallets * handlingCostPerPallet;
  const moveCost = moveTransitCost + moveHandlingCost;

  const moveOption = {
    cost: Math.round(moveCost),
    leadTimeDays: moveLane.leadTimeDays,
    steps: [
      { label: 'Pick & pack at source DC', cost: moveHandlingCost, days: 0.5 },
      { label: `Transit ${moveLane.from} → ${moveLane.to} (${moveLane.distanceMiles} mi)`, cost: moveTransitCost, days: moveLane.leadTimeDays },
      { label: 'Receive at destination DC', cost: 0, days: 0.5 },
    ],
    riskFactors: ['Depletes source DC inventory', 'No new product created'],
  };

  // Make option: produce at plant and ship to destination
  const productionCost = qty * unitCost;
  const makeTransitCost = totalWeight * (plantLane.costPerLb || 0.12);
  const makeCost = productionCost + makeTransitCost;

  const makeOption = {
    cost: Math.round(makeCost),
    leadTimeDays: plantLane.leadTimeDays + 3, // +3 days production lead time
    steps: [
      { label: 'Production at plant', cost: productionCost, days: 3 },
      { label: `Transit ${plantLane.from} → ${plantLane.to} (${plantLane.distanceMiles} mi)`, cost: makeTransitCost, days: plantLane.leadTimeDays },
      { label: 'Receive at destination DC', cost: 0, days: 0.5 },
    ],
    riskFactors: ['Requires plant capacity', 'Longer lead time'],
  };

  const recommendation = moveCost <= makeCost ? 'move' : 'make';
  const cheaper = Math.min(moveCost, makeCost);
  const pricier = Math.max(moveCost, makeCost);
  const savingsPercent = pricier > 0 ? Math.round(((pricier - cheaper) / pricier) * 100) : 0;

  return {
    moveOption,
    makeOption,
    recommendation,
    savingsPercent,
    savingsAmount: Math.round(pricier - cheaper),
  };
}

/**
 * Adjust planned shipment release dates to align with shipping calendar.
 *
 * @param {number[]} plannedReleases - Planned quantities per period (week)
 * @param {Object} calendar - { shipDays: [1,3,5], frequency }
 * @param {string} startDate - ISO date of first period
 * @returns {Object[]} Adjusted releases with ship dates
 */
export function applyShippingCalendar(plannedReleases, calendar, startDate) {
  if (!calendar || !calendar.shipDays || calendar.shipDays.length === 0) {
    return plannedReleases.map((qty, i) => ({ period: i, qty, shipDay: null }));
  }

  return plannedReleases.map((qty, i) => {
    if (qty <= 0) return { period: i, qty: 0, shipDay: null };

    // Find the next available ship day in this period's week
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekDay = weekStart.getDay(); // 0=Sun, 1=Mon...

    // Find closest ship day (1-based: 1=Mon)
    let bestDay = calendar.shipDays[0];
    for (const sd of calendar.shipDays) {
      if (sd >= weekDay) { bestDay = sd; break; }
    }

    return { period: i, qty, shipDay: bestDay };
  });
}
