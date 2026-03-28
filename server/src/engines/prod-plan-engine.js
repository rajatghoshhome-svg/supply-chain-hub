/**
 * Production Planning Engine — Aggregate Planning
 *
 * ASCM MPC Framework position:
 *   Demand Plan → DRP → Production Plan → MPS → MRP
 *
 * Production Planning takes plant-level gross requirements from DRP
 * and determines HOW to produce them:
 *   - Chase: vary production to match demand (minimize inventory)
 *   - Level: constant production rate (minimize workforce changes)
 *   - Hybrid: level base + overtime/subcontract for peaks
 *
 * Includes Rough-Cut Capacity Planning (RCCP) to validate feasibility.
 *
 * All functions are pure — no side effects, no DB calls.
 */

/**
 * Chase Strategy — production matches demand each period.
 *
 * Minimizes inventory holding costs but incurs hiring/layoff costs
 * when production rate changes between periods.
 *
 * @param {Object} params
 * @param {string[]} params.periods
 * @param {number[]} params.grossReqs - Plant-level demand per period
 * @param {number} params.beginningInventory
 * @param {number} [params.costPerUnit=0]
 * @param {number} [params.hiringCostPerUnit=0]
 * @param {number} [params.layoffCostPerUnit=0]
 * @param {number} [params.baselineRate=0] - Previous period's production rate
 * @returns {{ production: number[], endingInventory: number[], totalCost: number, costBreakdown: Object }}
 */
export function chaseStrategy({
  periods,
  grossReqs,
  beginningInventory = 0,
  costPerUnit = 0,
  hiringCostPerUnit = 0,
  layoffCostPerUnit = 0,
  baselineRate = 0,
}) {
  const n = periods.length;
  const production = [];
  const endingInventory = [];

  let currentInventory = beginningInventory;
  let productionCost = 0;
  let workforceChangeCost = 0;
  let prevRate = baselineRate;

  for (let i = 0; i < n; i++) {
    const demand = grossReqs[i] || 0;
    const needed = Math.max(0, demand - currentInventory);
    production.push(needed);

    currentInventory = currentInventory + needed - demand;
    endingInventory.push(currentInventory);

    // Costs
    productionCost += needed * costPerUnit;

    // Workforce change cost
    const delta = needed - prevRate;
    if (delta > 0) {
      workforceChangeCost += delta * hiringCostPerUnit;
    } else if (delta < 0) {
      workforceChangeCost += Math.abs(delta) * layoffCostPerUnit;
    }
    prevRate = needed;
  }

  const totalCost = productionCost + workforceChangeCost;

  return {
    strategy: 'chase',
    periods,
    production,
    endingInventory,
    totalCost,
    costBreakdown: {
      productionCost,
      workforceChangeCost,
      inventoryCost: 0,
    },
    exceptions: [],
  };
}

/**
 * Level Strategy — constant production rate across all periods.
 *
 * Minimizes workforce changes but builds/consumes inventory.
 * May result in stockouts if demand spikes exceed accumulated inventory.
 *
 * @param {Object} params
 * @returns {{ production: number[], endingInventory: number[], totalCost: number, costBreakdown: Object, exceptions: Object[] }}
 */
export function levelStrategy({
  periods,
  grossReqs,
  beginningInventory = 0,
  costPerUnit = 0,
  inventoryCarryingCost = 0,
}) {
  const n = periods.length;
  const totalDemand = grossReqs.reduce((a, b) => a + b, 0);

  // Level rate: produce enough over the horizon to meet total demand
  // accounting for beginning inventory
  const totalNeeded = Math.max(0, totalDemand - beginningInventory);
  const levelRate = n > 0 ? Math.ceil(totalNeeded / n) : 0;

  const production = new Array(n).fill(levelRate);
  const endingInventory = [];
  const exceptions = [];

  let currentInventory = beginningInventory;
  let productionCost = 0;
  let inventoryCost = 0;

  for (let i = 0; i < n; i++) {
    const demand = grossReqs[i] || 0;
    currentInventory = currentInventory + levelRate - demand;
    endingInventory.push(currentInventory);

    productionCost += levelRate * costPerUnit;

    if (currentInventory > 0) {
      inventoryCost += currentInventory * inventoryCarryingCost;
    }

    if (currentInventory < 0) {
      exceptions.push({
        type: 'stockout',
        severity: 'critical',
        period: periods[i],
        periodIndex: i,
        shortfall: Math.abs(currentInventory),
        message: `Level strategy stockout in ${periods[i]}: shortfall of ${Math.abs(currentInventory)} units. Consider hybrid strategy or increasing level rate.`,
      });
    }
  }

  return {
    strategy: 'level',
    periods,
    production,
    levelRate,
    endingInventory,
    totalCost: productionCost + inventoryCost,
    costBreakdown: {
      productionCost,
      inventoryCost,
      workforceChangeCost: 0,
    },
    exceptions,
  };
}

/**
 * Hybrid Strategy — level base production + overtime + subcontract for peaks.
 *
 * Balances inventory holding, workforce stability, and peak coverage.
 *
 * @param {Object} params
 * @param {number} params.baseRate - Regular production capacity per period
 * @param {number} [params.maxOvertimeRate=0] - Max overtime units per period
 * @param {number} [params.overtimeCostPremium=1.5] - Multiplier on costPerUnit
 * @param {number} [params.subcontractCostPremium=2.0] - Multiplier on costPerUnit
 * @returns {{ production: number[], overtime: number[], subcontract: number[], endingInventory: number[], totalCost: number }}
 */
export function hybridStrategy({
  periods,
  grossReqs,
  beginningInventory = 0,
  baseRate = 0,
  maxOvertimeRate = 0,
  costPerUnit = 0,
  overtimeCostPremium = 1.5,
  subcontractCostPremium = 2.0,
}) {
  const n = periods.length;
  const production = [];
  const overtime = [];
  const subcontract = [];
  const endingInventory = [];
  const exceptions = [];

  let currentInventory = beginningInventory;
  let productionCost = 0;
  let overtimeCost = 0;
  let subcontractCost = 0;
  let inventoryCost = 0;

  for (let i = 0; i < n; i++) {
    const demand = grossReqs[i] || 0;
    const gap = demand - currentInventory - baseRate;

    let ot = 0;
    let sub = 0;

    if (gap > 0) {
      // Need more than base rate can cover
      ot = Math.min(gap, maxOvertimeRate);
      if (gap > maxOvertimeRate) {
        sub = gap - maxOvertimeRate;
      }
    }

    const totalProd = baseRate + ot + sub;
    production.push(totalProd);
    overtime.push(ot);
    subcontract.push(sub);

    currentInventory = currentInventory + totalProd - demand;
    endingInventory.push(currentInventory);

    // Costs
    productionCost += baseRate * costPerUnit;
    overtimeCost += ot * costPerUnit * overtimeCostPremium;
    subcontractCost += sub * costPerUnit * subcontractCostPremium;
    if (currentInventory > 0) {
      inventoryCost += currentInventory * (costPerUnit * 0.02); // 2% carrying
    }

    if (sub > 0) {
      exceptions.push({
        type: 'subcontract',
        severity: 'warning',
        period: periods[i],
        qty: sub,
        message: `Subcontracting ${sub} units in ${periods[i]} — base (${baseRate}) + overtime (${ot}) insufficient for demand (${demand}).`,
      });
    }
  }

  return {
    strategy: 'hybrid',
    periods,
    production,
    overtime,
    subcontract,
    endingInventory,
    baseRate,
    maxOvertimeRate,
    totalCost: productionCost + overtimeCost + subcontractCost + inventoryCost,
    costBreakdown: {
      productionCost,
      overtimeCost,
      subcontractCost,
      inventoryCost,
    },
    exceptions,
  };
}

/**
 * Rough-Cut Capacity Planning (RCCP)
 *
 * Validates a production plan against work center capacities.
 * Returns utilization percentages and overload flags per period per work center.
 *
 * @param {Object} params
 * @param {string[]} params.periods
 * @param {number[]} params.production - Units to produce per period
 * @param {Object[]} params.workCenters - Array of { code, hoursPerUnit, capacityHoursPerPeriod }
 * @returns {Object[]} Per work center: { code, utilization[], loadHours[], availableHours[], overloaded[] }
 */
export function roughCutCapacity({ periods, production, workCenters }) {
  if (!workCenters || workCenters.length === 0) return [];

  return workCenters.map(wc => {
    const n = periods.length;
    const loadHours = [];
    const availableHours = [];
    const utilization = [];
    const overloaded = [];

    for (let i = 0; i < n; i++) {
      const load = (production[i] || 0) * wc.hoursPerUnit;
      const cap = wc.capacityHoursPerPeriod;
      const util = cap > 0 ? (load / cap) * 100 : 0;

      loadHours.push(load);
      availableHours.push(cap);
      utilization.push(Math.round(util * 100) / 100);
      overloaded.push(util > 100);
    }

    return {
      code: wc.code,
      hoursPerUnit: wc.hoursPerUnit,
      capacityHoursPerPeriod: wc.capacityHoursPerPeriod,
      loadHours,
      availableHours,
      utilization,
      overloaded,
    };
  });
}

/**
 * Run full production plan — compare all three strategies with RCCP.
 *
 * @param {Object} params - Combined params for all strategies + RCCP
 * @returns {{ strategies: Object, recommended: string }}
 */
export function runProductionPlan({
  periods,
  grossReqs,
  beginningInventory = 0,
  costPerUnit = 0,
  inventoryCarryingCost = 0,
  hiringCostPerUnit = 0,
  layoffCostPerUnit = 0,
  baseRate,
  maxOvertimeRate = 0,
  overtimeCostPremium = 1.5,
  subcontractCostPremium = 2.0,
  workCenters = [],
}) {
  // Run all three strategies
  const chase = chaseStrategy({
    periods, grossReqs, beginningInventory,
    costPerUnit, hiringCostPerUnit, layoffCostPerUnit,
  });

  const level = levelStrategy({
    periods, grossReqs, beginningInventory,
    costPerUnit, inventoryCarryingCost,
  });

  // For hybrid, default baseRate to level rate if not provided
  const effectiveBaseRate = baseRate ?? level.levelRate ?? Math.ceil(
    grossReqs.reduce((a, b) => a + b, 0) / periods.length
  );

  const hybrid = hybridStrategy({
    periods, grossReqs, beginningInventory,
    baseRate: effectiveBaseRate, maxOvertimeRate,
    costPerUnit, overtimeCostPremium, subcontractCostPremium,
  });

  // Run RCCP for each strategy
  if (workCenters.length > 0) {
    chase.rccp = roughCutCapacity({ periods, production: chase.production, workCenters });
    level.rccp = roughCutCapacity({ periods, production: level.production, workCenters });
    hybrid.rccp = roughCutCapacity({ periods, production: hybrid.production, workCenters });
  }

  // Recommend the strategy with lowest total cost that doesn't have stockouts
  const candidates = [
    { name: 'chase', plan: chase },
    { name: 'level', plan: level },
    { name: 'hybrid', plan: hybrid },
  ];

  // Prefer strategies without stockouts; among those, pick lowest cost
  const feasible = candidates.filter(c => c.plan.exceptions.filter(e => e.type === 'stockout').length === 0);
  const pool = feasible.length > 0 ? feasible : candidates;
  pool.sort((a, b) => a.plan.totalCost - b.plan.totalCost);

  return {
    periods,
    grossReqs,
    beginningInventory,
    strategies: { chase, level, hybrid },
    recommended: pool[0].name,
  };
}
