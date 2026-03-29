/**
 * Financial Impact Service
 *
 * Computes dollar-value impact from planning cascade results.
 * All functions are pure — no side effects, no DB access.
 */

// Cost assumptions (configurable per company)
const DEFAULT_COSTS = {
  expeditePerUnit: 15,         // premium freight cost
  stockoutPerUnit: 85,         // lost revenue per unit
  inventoryCarryPerUnit: 2.50, // weekly carrying cost per unit
  overtimePerHour: 45,         // overtime labor premium
  lateOrderPenalty: 500,       // per order penalty
  changeoverCost: 200,         // per changeover event
};

export function calculateFinancialImpact(scenarioResult, costs = DEFAULT_COSTS) {
  const { drp, production, scheduling, mrp } = scenarioResult;

  const expediteCost = (mrp?.critical || 0) * costs.expeditePerUnit * 100;
  const stockoutRisk = (drp?.critical || 0) * costs.stockoutPerUnit * 200;
  const inventoryCarrying = (drp?.skusPlanned || 0) * costs.inventoryCarryPerUnit * 8; // 8 periods
  const overtimeCost = Math.max(0, (scheduling?.lateOrders || 0)) * costs.overtimePerHour * 8;
  const lateOrderPenalties = (scheduling?.lateOrders || 0) * costs.lateOrderPenalty;
  const totalExceptionCost = (mrp?.totalExceptions || 0) * 150 + (drp?.exceptions || 0) * 120;

  const totalCost = expediteCost + stockoutRisk + inventoryCarrying + overtimeCost + lateOrderPenalties + totalExceptionCost;
  const revenueAtRisk = stockoutRisk + lateOrderPenalties;
  const cashImpact = inventoryCarrying + expediteCost + overtimeCost;

  // Service level: start at 100, deduct for exceptions and late orders
  const totalPlanned = (drp?.skusPlanned || 1) * 8 + (scheduling?.orders || 0);
  const totalIssues = (drp?.critical || 0) + (mrp?.critical || 0) + (scheduling?.lateOrders || 0);
  const serviceLevel = Math.max(0, Math.round((1 - totalIssues / Math.max(totalPlanned, 1)) * 1000) / 10);

  return {
    totalCost,
    revenueAtRisk,
    cashImpact,
    serviceLevel,
    planExceptions: (mrp?.totalExceptions || 0) + (drp?.exceptions || 0),
    lateOrders: scheduling?.lateOrders || 0,
    breakdown: {
      expediteCost,
      stockoutRisk,
      inventoryCarrying,
      overtimeCost,
      lateOrderPenalties,
      totalExceptionCost,
    },
  };
}

/**
 * Per-exception financial impact calculator.
 * Attaches a dollar amount to each exception so planners can prioritize by cost.
 */
export function calculateExceptionImpact(exception, costs = DEFAULT_COSTS) {
  const qty = exception.qty || exception.affectedQty || 100; // fallback for exceptions without qty
  const type = (exception.type || '').toLowerCase();

  let amount = 0;
  let impactType = 'cost';

  if (type.includes('expedite')) {
    amount = qty * costs.expeditePerUnit;
    impactType = 'cost';
  } else if (type.includes('stockout') || type.includes('safety-stock')) {
    amount = qty * costs.stockoutPerUnit;
    impactType = 'risk';
  } else if (type.includes('reschedule-in')) {
    amount = qty * (costs.reschedulePerUnit || 7.5);
    impactType = 'cost';
  } else if (type.includes('reschedule-out')) {
    amount = qty * (costs.rescheduleOutPerUnit || 2.5); // carrying cost savings opportunity
    impactType = 'cost-avoidance';
  } else if (type.includes('capacity') || type.includes('overload')) {
    amount = (exception.hours || 8) * costs.overtimePerHour;
    impactType = 'cost';
  } else if (type.includes('cancel')) {
    amount = qty * (costs.cancelPerUnit || 7.5);
    impactType = 'savings';
  } else {
    // Generic exception
    amount = qty * 10;
    impactType = 'cost';
  }

  return {
    amount: Math.round(amount),
    type: impactType,
    formatted: `$${Math.round(amount).toLocaleString()}`,
  };
}

/**
 * Attach financial impact to every exception in an array.
 */
export function attachFinancialImpacts(exceptions, costs = DEFAULT_COSTS) {
  return exceptions.map(e => ({
    ...e,
    financialImpact: calculateExceptionImpact(e, costs),
  }));
}

export function compareScenarios(scenarios) {
  // scenarios is array of { label, multiplier, ...cascadeResult }
  return scenarios.map(s => ({
    label: s.label,
    multiplier: s.multiplier,
    ...calculateFinancialImpact(s),
  }));
}
