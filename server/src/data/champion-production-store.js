/**
 * Champion Production Store — In-memory production planning state
 *
 * Singleton initialized on server startup. Generates:
 * - Production plans per plant × product family (chase/level/hybrid strategies)
 * - Rough-Cut Capacity Planning (RCCP) per work center
 * - Exceptions: stockouts, capacity overloads, excess inventory, underutilization
 * - Plant calendars, production rates, firmed periods
 *
 * Uses seeded PRNG for deterministic demo data.
 */

import { families, products, skus, baseDemandPerProduct } from './champion-catalog.js';
import { plants, workCenters, plantProductSourcing, lanes } from './champion-network.js';
import { isInitialized as isDemandInitialized } from './champion-store.js';
import { runProductionPlan, roughCutCapacity } from '../engines/prod-plan-engine.js';

// ── Seeded PRNG (LCG, seed 7000) ──
let _seed = 7000;
function seededRandom() {
  _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
  return _seed / 0x7fffffff;
}

// ── State ──
let _initialized = false;
const _productionPlans = new Map();   // plantCode → { aggregatePlan, familyPlans: Map<familyId, plan> }
const _plantCalendars = new Map();    // plantCode → { workingDaysPerWeek, shifts, hoursPerShift, holidays, effectiveHoursPerWeek }
const _productionRates = new Map();   // 'plantCode|familyId' → { unitsPerHour, setupTimeHrs, changeoverTimeHrs, minRunSize, maxRunSize }
let _exceptions = [];                 // Array of exception objects
const _firmedPeriods = new Map();     // 'plantCode|familyId' → Set of period indices

// Supply-demand match heuristics (configurable)
let _heuristics = {
  lotSizing: 'LFL',           // LFL | FOQ | POQ | EOQ
  safetyStock: 'wos',         // fixed | wos | service | dynamic
  timeFence: 'moderate',      // strict | moderate | flexible | agile
  capacityPriority: 'stockout', // margin | stockout | customer | fifo
  smoothing: 'light',         // none | light | moderate | heavy
  inventoryTarget: 'balanced', // lean | balanced | conservative | seasonal
};

// ── Helpers ──

function getProductsForFamily(familyId) {
  // Walk: family → lines → products
  const familyObj = families.find(f => f.id === familyId);
  if (!familyObj) return [];
  return products.filter(p => {
    const sku = skus.find(s => s.productId === p.id);
    return sku && sku.familyId === familyId;
  });
}

function getFamilyFormat(familyId) {
  const fam = families.find(f => f.id === familyId);
  return fam?.format || 'dry';
}

function getFamilyName(familyId) {
  const fam = families.find(f => f.id === familyId);
  return fam?.name || familyId;
}

function getPlantName(plantCode) {
  const plant = plants.find(p => p.code === plantCode);
  return plant?.name || plantCode;
}

/**
 * Determine which work centers a family uses at a given plant.
 * Returns array of { code, hoursPerUnit, capacityHoursPerPeriod } for the engine.
 */
function getWorkCentersForFamily(plantCode, familyId, unitsPerHour) {
  const format = getFamilyFormat(familyId);
  const plantWCs = workCenters.filter(wc => wc.plant === plantCode);
  const relevantWCs = [];
  const hrsPerUnit = 1 / unitsPerHour;

  for (const wc of plantWCs) {
    let applies = false;
    let wcHrsPerUnit = hrsPerUnit;

    if (wc.type === 'extrusion' && (format === 'dry' || format === 'treat')) {
      applies = true;
      wcHrsPerUnit = hrsPerUnit * 0.6; // extrusion is 60% of total time
    } else if (wc.type === 'retort' && format === 'wet') {
      applies = true;
      wcHrsPerUnit = hrsPerUnit * 0.5;
    } else if (wc.type === 'freeze-dry' && format === 'freeze-dried') {
      applies = true;
      wcHrsPerUnit = hrsPerUnit * 0.7; // FD chamber is the bottleneck
    } else if (wc.type === 'coating' && (format === 'dry' || format === 'freeze-dried' || format === 'treat')) {
      applies = true;
      wcHrsPerUnit = hrsPerUnit * 0.2;
    } else if (wc.type === 'packaging') {
      applies = true;
      wcHrsPerUnit = hrsPerUnit * 0.2;
    }

    if (applies) {
      relevantWCs.push({
        code: wc.code,
        hoursPerUnit: wcHrsPerUnit,
        capacityHoursPerPeriod: wc.capacityHrsPerPeriod,
      });
    }
  }

  return relevantWCs;
}

/**
 * Get production rate parameters by format.
 */
function getRateForFormat(format) {
  switch (format) {
    case 'dry':
      return { unitsPerHour: 18 + seededRandom() * 8, setupTimeHrs: 1.5, changeoverTimeHrs: 0.5, minRunSize: 500, maxRunSize: 8000 };
    case 'wet':
      return { unitsPerHour: 11 + seededRandom() * 2, setupTimeHrs: 2.0, changeoverTimeHrs: 1.0, minRunSize: 1000, maxRunSize: 5000 };
    case 'freeze-dried':
      return { unitsPerHour: 7 + seededRandom() * 2, setupTimeHrs: 3.0, changeoverTimeHrs: 1.5, minRunSize: 200, maxRunSize: 2000 };
    case 'treat':
      return { unitsPerHour: 26 + seededRandom() * 6, setupTimeHrs: 1.0, changeoverTimeHrs: 0.3, minRunSize: 300, maxRunSize: 6000 };
    default:
      return { unitsPerHour: 20, setupTimeHrs: 1.5, changeoverTimeHrs: 0.5, minRunSize: 500, maxRunSize: 8000 };
  }
}

/**
 * Get cost per unit by format.
 */
function getCostPerUnit(format) {
  switch (format) {
    case 'dry':           return 2.50 + seededRandom() * 1.00;
    case 'wet':           return 1.80 + seededRandom() * 0.40;
    case 'freeze-dried':  return 8.00 + seededRandom() * 4.00;
    case 'treat':         return 4.00 + seededRandom() * 2.00;
    default:              return 3.00;
  }
}

/**
 * Get beginning inventory in weeks of average demand.
 * Engineered: some families well-stocked, some dangerously low.
 */
function getBeginningInventoryWeeks(familyId) {
  // Engineer specific families to have low inventory for exceptions
  const lowStockFamilies = ['ORI-DOG-DRY', 'ORI-FD', 'ACA-WET-DOG'];
  if (lowStockFamilies.includes(familyId)) {
    return 0.5 + seededRandom() * 0.5; // 0.5-1.0 weeks
  }
  const r = seededRandom();
  if (r < 0.35) return 0.5 + seededRandom() * 0.5;  // low stock
  if (r < 0.65) return 1.5 + seededRandom() * 1.5;   // normal
  return 3.0 + seededRandom() * 1.0;                  // well-stocked
}

// ── Initialization ──

export function initialize() {
  if (_initialized) return;

  _seed = 7000; // Reset seed for determinism
  const t0 = Date.now();

  // Generate 12 weekly periods starting 2026-04-06
  const periods = [];
  const baseDate = new Date('2026-04-06');
  for (let i = 0; i < 12; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 7);
    periods.push(d.toISOString().split('T')[0]);
  }

  // Initialize plant calendars
  _plantCalendars.set('PLT-DOGSTAR', {
    workingDaysPerWeek: 5,
    shifts: 2,
    hoursPerShift: 8,
    holidays: ['2026-05-25', '2026-07-04'], // Memorial Day, July 4th
    effectiveHoursPerWeek: 80,
    saturdayOT: false,
  });
  _plantCalendars.set('PLT-NORTHSTAR', {
    workingDaysPerWeek: 5,
    shifts: 2,
    hoursPerShift: 8,
    holidays: ['2026-05-18', '2026-07-01'], // Victoria Day, Canada Day
    effectiveHoursPerWeek: 80,
    saturdayOT: true,
  });

  let totalFamilies = 0;

  // For each plant, build production plans
  for (const plant of plants) {
    const sourcing = plantProductSourcing[plant.code];
    if (!sourcing) continue;

    const allFamilyIds = [...(sourcing.primary || []), ...(sourcing.overflow || [])];
    const familyPlans = new Map();

    for (const familyId of allFamilyIds) {
      const format = getFamilyFormat(familyId);
      const isOverflow = (sourcing.overflow || []).includes(familyId);
      const familyProducts = getProductsForFamily(familyId);

      // Generate gross requirements: sum demand across products in this family
      const grossReqs = new Array(12).fill(0);
      for (const prod of familyProducts) {
        const baseDemand = baseDemandPerProduct[prod.id] || 500;
        // If overflow, only 30% of demand goes to this plant
        const demandShare = isOverflow ? 0.30 : 1.0;

        for (let i = 0; i < 12; i++) {
          // ±20% variation with slight upward trend
          const variation = 0.80 + seededRandom() * 0.40;
          const trend = 1.0 + (i * 0.008); // ~1% growth per period
          grossReqs[i] += Math.round(baseDemand * demandShare * variation * trend);
        }
      }

      // Engineer spikes for critical exceptions
      if (familyId === 'ORI-DOG-DRY') {
        // Big spike in periods 4-6 (seasonal demand surge)
        grossReqs[4] = Math.round(grossReqs[4] * 1.35);
        grossReqs[5] = Math.round(grossReqs[5] * 1.40);
        grossReqs[6] = Math.round(grossReqs[6] * 1.30);
      }
      if (familyId === 'ACA-WET-DOG') {
        // Summer spike for wet food
        grossReqs[6] = Math.round(grossReqs[6] * 1.45);
        grossReqs[7] = Math.round(grossReqs[7] * 1.50);
        grossReqs[8] = Math.round(grossReqs[8] * 1.35);
      }
      if (familyId === 'ORI-FD') {
        // Promotional surge
        grossReqs[3] = Math.round(grossReqs[3] * 1.60);
        grossReqs[4] = Math.round(grossReqs[4] * 1.55);
      }

      // Production rates
      const rate = getRateForFormat(format);
      const rateKey = `${plant.code}|${familyId}`;
      _productionRates.set(rateKey, { ...rate });

      // Work centers for RCCP
      const familyWorkCenters = getWorkCentersForFamily(plant.code, familyId, rate.unitsPerHour);

      // Cost
      const costPerUnit = getCostPerUnit(format);

      // Beginning inventory
      const avgWeeklyDemand = grossReqs.reduce((s, v) => s + v, 0) / 12;
      const invWeeks = getBeginningInventoryWeeks(familyId);
      const beginningInventory = Math.round(avgWeeklyDemand * invWeeks);

      // Base rate for hybrid: ~85% of average demand to create interesting hybrid dynamics
      const baseRate = Math.round(avgWeeklyDemand * 0.85);
      const maxOvertimeRate = Math.round(avgWeeklyDemand * 0.20);

      // Run the production plan engine
      const plan = runProductionPlan({
        periods,
        grossReqs,
        beginningInventory,
        costPerUnit: Math.round(costPerUnit * 100) / 100,
        inventoryCarryingCost: Math.round(costPerUnit * 0.02 * 100) / 100,
        hiringCostPerUnit: Math.round(costPerUnit * 0.15 * 100) / 100,
        layoffCostPerUnit: Math.round(costPerUnit * 0.10 * 100) / 100,
        baseRate,
        maxOvertimeRate,
        overtimeCostPremium: 1.5,
        subcontractCostPremium: 2.0,
        workCenters: familyWorkCenters,
      });

      familyPlans.set(familyId, {
        familyId,
        familyName: getFamilyName(familyId),
        format,
        isOverflow,
        plantCode: plant.code,
        plantName: getPlantName(plant.code),
        grossReqs,
        beginningInventory,
        costPerUnit: Math.round(costPerUnit * 100) / 100,
        baseRate,
        maxOvertimeRate,
        plan,
        workCenters: familyWorkCenters,
      });

      // Initialize firmed periods (none firmed initially)
      _firmedPeriods.set(rateKey, new Set());

      totalFamilies++;
    }

    // Build aggregate plan for this plant
    const aggregateGrossReqs = new Array(12).fill(0);
    for (const [, fp] of familyPlans) {
      for (let i = 0; i < 12; i++) {
        aggregateGrossReqs[i] += fp.grossReqs[i];
      }
    }

    _productionPlans.set(plant.code, {
      plantCode: plant.code,
      plantName: getPlantName(plant.code),
      aggregateGrossReqs,
      familyPlans,
    });
  }

  // Generate exceptions
  _generateExceptions(periods);

  _initialized = true;
  const elapsed = Date.now() - t0;
  console.log(`[champion-production] Initialized: ${totalFamilies} families, ${_exceptions.length} exceptions in ${elapsed}ms`);
}

function _generateExceptions(periods) {
  _exceptions = [];
  let excId = 1;

  function nextId() {
    return `EXC-${String(excId++).padStart(3, '0')}`;
  }

  for (const [plantCode, plantData] of _productionPlans) {
    const plantName = plantData.plantName;

    for (const [familyId, fp] of plantData.familyPlans) {
      const familyName = fp.familyName;
      const avgDemand = fp.grossReqs.reduce((s, v) => s + v, 0) / 12;

      // Focus exceptions on the recommended strategy (hybrid) + level stockouts
      const recommended = fp.plan.recommended || 'hybrid';
      const hybridStrat = fp.plan.strategies.hybrid;
      const levelStrat = fp.plan.strategies.level;

      // Level strategy stockouts (these are informative — shows level won't work)
      if (levelStrat) {
        for (let i = 0; i < levelStrat.endingInventory.length; i++) {
          if (levelStrat.endingInventory[i] < 0) {
            _exceptions.push({
              id: nextId(),
              type: 'stockout',
              severity: 'warning',
              plant: plantCode,
              plantName,
              familyId,
              familyName,
              period: periods[i],
              periodIndex: i,
              strategy: 'level',
              shortfall: Math.abs(levelStrat.endingInventory[i]),
              message: `Level strategy stockout for ${familyName} in W${i + 1}: shortfall of ${Math.abs(levelStrat.endingInventory[i]).toLocaleString()} units. Level strategy not viable.`,
              recommendation: `Use hybrid or chase strategy for ${familyName}. Level rate of ${levelStrat.levelRate} cannot meet peak demand.`,
              status: 'open',
            });
            break; // Only report first stockout per family for level
          }
        }
      }

      // Recommended strategy (hybrid) RCCP overloads and near-overloads
      if (hybridStrat?.rccp) {
        for (const wc of hybridStrat.rccp) {
          let reportedOverload = false;
          for (let i = 0; i < wc.utilization.length; i++) {
            if (wc.utilization[i] > 100 && !reportedOverload) {
              _exceptions.push({
                id: nextId(),
                type: 'capacity-overload',
                severity: 'critical',
                plant: plantCode,
                plantName,
                familyId,
                familyName,
                period: periods[i],
                periodIndex: i,
                strategy: 'hybrid',
                workCenter: wc.code,
                utilization: wc.utilization[i],
                loadHours: wc.loadHours[i],
                capacityHours: wc.capacityHoursPerPeriod,
                message: `${wc.code} overloaded at ${wc.utilization[i].toFixed(1)}% for ${familyName} in W${i + 1}: ${wc.loadHours[i].toFixed(1)}h load vs ${wc.capacityHoursPerPeriod}h capacity.`,
                recommendation: `Add overtime shift, split production across periods, or evaluate outsourcing for ${familyName}. Consider activating Saturday OT at ${plantName}.`,
                status: 'open',
              });
              reportedOverload = true; // One overload per WC per family
            } else if (wc.utilization[i] > 85 && wc.utilization[i] <= 100 && !reportedOverload) {
              _exceptions.push({
                id: nextId(),
                type: 'near-overload',
                severity: 'warning',
                plant: plantCode,
                plantName,
                familyId,
                familyName,
                period: periods[i],
                periodIndex: i,
                strategy: 'hybrid',
                workCenter: wc.code,
                utilization: wc.utilization[i],
                message: `${wc.code} near capacity at ${wc.utilization[i].toFixed(1)}% for ${familyName} in W${i + 1}. Limited headroom.`,
                recommendation: `Monitor closely. Pre-build inventory in earlier periods if demand uptick expected.`,
                status: 'open',
              });
            }
          }
        }
      }

      // Hybrid strategy stockouts
      if (hybridStrat) {
        for (let i = 0; i < hybridStrat.endingInventory.length; i++) {
          if (hybridStrat.endingInventory[i] < 0) {
            _exceptions.push({
              id: nextId(),
              type: 'stockout',
              severity: 'critical',
              plant: plantCode,
              plantName,
              familyId,
              familyName,
              period: periods[i],
              periodIndex: i,
              strategy: 'hybrid',
              shortfall: Math.abs(hybridStrat.endingInventory[i]),
              message: `Hybrid strategy stockout for ${familyName} at ${plantName} in W${i + 1}: shortfall of ${Math.abs(hybridStrat.endingInventory[i]).toLocaleString()} units.`,
              recommendation: `Increase base rate, activate overtime earlier, or build safety stock. Review demand forecast for accuracy.`,
              status: 'open',
            });
          }
        }
      }

      {
        const strat = hybridStrat;
        const stratName = 'hybrid';
        if (strat) {
          for (let i = 0; i < strat.endingInventory.length; i++) {
            // Excess inventory: > 4 weeks of demand
            if (strat.endingInventory[i] > avgDemand * 4) {
              _exceptions.push({
                id: nextId(),
                type: 'excess-inventory',
                severity: 'info',
                plant: plantCode,
                plantName,
                family: familyId,
                familyName,
                sku: null,
                period: periods[i],
                periodIndex: i,
                strategy: stratName,
                excessUnits: Math.round(strat.endingInventory[i] - avgDemand * 2),
                weeksOfSupply: Math.round((strat.endingInventory[i] / avgDemand) * 10) / 10,
                message: `Excess inventory of ${familyName} at ${plantName} in ${periods[i]}: ${Math.round(strat.endingInventory[i]).toLocaleString()} units (${(strat.endingInventory[i] / avgDemand).toFixed(1)} weeks of supply).`,
                recommendation: `Reduce production rate or redistribute inventory to DCs with higher demand. Consider promotional activity.`,
                status: 'open',
              });
            }
          }

          // Subcontracting warnings from hybrid strategy
          if (strat.subcontract) {
            for (let i = 0; i < strat.subcontract.length; i++) {
              if (strat.subcontract[i] > 0) {
                _exceptions.push({
                  id: nextId(),
                  type: 'subcontract-needed',
                  severity: 'warning',
                  plant: plantCode,
                  plantName,
                  family: familyId,
                  familyName,
                  sku: null,
                  period: periods[i],
                  periodIndex: i,
                  strategy: stratName,
                  subcontractQty: strat.subcontract[i],
                  message: `Subcontracting ${strat.subcontract[i].toLocaleString()} units of ${familyName} needed in ${periods[i]} at ${plantName}. Base + OT capacity insufficient.`,
                  recommendation: `Secure co-packer capacity or pre-build in earlier periods. Evaluate whether NorthStar overflow capacity is available.`,
                  status: 'open',
                });
              }
            }
          }
        }
      }

      // Check for underutilized work centers in hybrid (only scan once per family)
      const hybrid = fp.plan.strategies.hybrid;
      if (hybrid?.rccp) {
        for (const wc of hybrid.rccp) {
          const avgUtil = wc.utilization.reduce((s, v) => s + v, 0) / wc.utilization.length;
          if (avgUtil < 30 && avgUtil > 0) {
            _exceptions.push({
              id: nextId(),
              type: 'underutilized',
              severity: 'info',
              plant: plantCode,
              plantName,
              family: familyId,
              familyName,
              sku: null,
              period: null,
              periodIndex: null,
              strategy: 'hybrid',
              workCenter: wc.code,
              avgUtilization: Math.round(avgUtil * 10) / 10,
              message: `${wc.code} averaging ${avgUtil.toFixed(1)}% utilization for ${familyName} at ${plantName}. Potential to absorb overflow production.`,
              recommendation: `Consider consolidating production runs or absorbing overflow from other families/plants.`,
              status: 'open',
            });
          }
        }
      }
    }
  }

  // Deduplicate: for RCCP exceptions, if the same work center is overloaded for the same
  // period across multiple strategies, keep only the hybrid one (or first if no hybrid)
  const seen = new Set();
  const deduped = [];
  for (const exc of _exceptions) {
    if (exc.type === 'capacity-overload' || exc.type === 'near-overload') {
      const key = `${exc.workCenter}|${exc.period}|${exc.family}|${exc.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    if (exc.type === 'stockout') {
      const key = `${exc.family}|${exc.period}|${exc.strategy}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    deduped.push(exc);
  }
  _exceptions = deduped;

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  _exceptions.sort((a, b) => (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9));
}

export function isInitialized() {
  return _initialized;
}

// ── Public API ──

export function getProductionSummary() {
  let plantsPlanned = 0;
  let familiesPlanned = 0;
  for (const [, plantData] of _productionPlans) {
    plantsPlanned++;
    familiesPlanned += plantData.familyPlans.size;
  }
  const criticalExceptions = _exceptions.filter(e => e.severity === 'critical').length;

  return {
    plantsPlanned,
    familiesPlanned,
    totalExceptions: _exceptions.length,
    criticalExceptions,
    periods: 12,
    selectedStrategy: 'hybrid',
  };
}

export function getPlantPlan(plantCode) {
  const plantData = _productionPlans.get(plantCode);
  if (!plantData) return null;

  const familyPlansArr = [];
  for (const [familyId, fp] of plantData.familyPlans) {
    familyPlansArr.push({
      ...fp,
      firmedPeriods: Array.from(_firmedPeriods.get(`${plantCode}|${familyId}`) || []),
    });
  }

  return {
    plantCode: plantData.plantCode,
    plantName: plantData.plantName,
    aggregateGrossReqs: plantData.aggregateGrossReqs,
    familyPlans: familyPlansArr,
    calendar: _plantCalendars.get(plantCode) || null,
    exceptions: _exceptions.filter(e => e.plant === plantCode),
  };
}

export function getAllPlantPlans() {
  const plantsArr = [];
  for (const [plantCode] of _productionPlans) {
    plantsArr.push(getPlantPlan(plantCode));
  }
  return { plants: plantsArr };
}

export function getFamilyPlan(plantCode, familyId) {
  const plantData = _productionPlans.get(plantCode);
  if (!plantData) return null;
  const fp = plantData.familyPlans.get(familyId);
  if (!fp) return null;

  return {
    ...fp,
    firmedPeriods: Array.from(_firmedPeriods.get(`${plantCode}|${familyId}`) || []),
    exceptions: _exceptions.filter(e => e.plant === plantCode && e.family === familyId),
    productionRate: _productionRates.get(`${plantCode}|${familyId}`) || null,
  };
}

export function getExceptions(filters = {}) {
  let result = [..._exceptions];

  if (filters.plant) {
    result = result.filter(e => e.plant === filters.plant);
  }
  if (filters.severity) {
    result = result.filter(e => e.severity === filters.severity);
  }
  if (filters.type) {
    result = result.filter(e => e.type === filters.type);
  }
  if (filters.status) {
    result = result.filter(e => e.status === filters.status);
  }

  return { exceptions: result };
}

export function acknowledgeException(exceptionId) {
  const exc = _exceptions.find(e => e.id === exceptionId);
  if (!exc) return { error: 'Exception not found' };
  if (exc.status !== 'open') return { error: `Exception already ${exc.status}` };
  exc.status = 'acknowledged';
  exc.acknowledgedAt = new Date().toISOString();
  return { success: true, exception: exc };
}

export function resolveException(exceptionId, resolution) {
  const exc = _exceptions.find(e => e.id === exceptionId);
  if (!exc) return { error: 'Exception not found' };
  if (exc.status === 'resolved') return { error: 'Exception already resolved' };
  exc.status = 'resolved';
  exc.resolution = resolution;
  exc.resolvedAt = new Date().toISOString();
  return { success: true, exception: exc };
}

export function firmPeriod(plantCode, familyId, periodIndex) {
  const key = `${plantCode}|${familyId}`;
  let set = _firmedPeriods.get(key);
  if (!set) {
    set = new Set();
    _firmedPeriods.set(key, set);
  }
  set.add(periodIndex);
  return { success: true, firmedPeriods: Array.from(set) };
}

export function unfirmPeriod(plantCode, familyId, periodIndex) {
  const key = `${plantCode}|${familyId}`;
  const set = _firmedPeriods.get(key);
  if (!set) return { success: true, firmedPeriods: [] };
  set.delete(periodIndex);
  return { success: true, firmedPeriods: Array.from(set) };
}

export function getFirmedPeriods(plantCode, familyId) {
  const key = `${plantCode}|${familyId}`;
  const set = _firmedPeriods.get(key);
  return { firmedPeriods: Array.from(set || []) };
}

export function getPlantCalendars() {
  const result = {};
  for (const [code, cal] of _plantCalendars) {
    result[code] = { ...cal, plantName: getPlantName(code), overtimeAvailable: cal.saturdayOT, overtimeNotes: cal.saturdayOT ? 'Saturday shifts available' : null };
  }
  return { calendars: result };
}

export function updatePlantCalendar(plantCode, updates) {
  const cal = _plantCalendars.get(plantCode);
  if (!cal) return { error: 'Plant not found' };
  Object.assign(cal, updates);
  // Recalculate effective hours
  cal.effectiveHoursPerWeek = cal.workingDaysPerWeek * cal.shifts * cal.hoursPerShift;
  return { success: true, calendar: { ...cal } };
}

export function getProductionRates(plantCode = null) {
  const result = [];
  for (const [key, rate] of _productionRates) {
    const [pc, famId] = key.split('|');
    if (plantCode && pc !== plantCode) continue;
    result.push({
      plantCode: pc,
      familyId: famId,
      familyName: getFamilyName(famId),
      format: getFamilyFormat(famId),
      unitsPerHour: Math.round(rate.unitsPerHour * 10) / 10,
      setupTimeHrs: rate.setupTimeHrs,
      changeoverTimeHrs: rate.changeoverTimeHrs,
      minRunSize: rate.minRunSize,
      maxRunSize: rate.maxRunSize,
    });
  }
  return { rates: result };
}

export function updateProductionRate(plantCode, familyId, updates) {
  const key = `${plantCode}|${familyId}`;
  const rate = _productionRates.get(key);
  if (!rate) return { error: 'Production rate not found' };
  Object.assign(rate, updates);
  return { success: true, rate: { ...rate } };
}

export function getRCCP(plantCode) {
  const plantData = _productionPlans.get(plantCode);
  if (!plantData) return null;

  // Aggregate RCCP across all families for the hybrid strategy
  const plantWCs = workCenters.filter(wc => wc.plant === plantCode);
  const periods = plantData.familyPlans.values().next().value?.plan?.periods;
  if (!periods) return null;

  const n = periods.length;
  const aggregated = {};

  for (const wc of plantWCs) {
    aggregated[wc.code] = {
      code: wc.code,
      name: wc.name,
      type: wc.type,
      capacityHoursPerPeriod: wc.capacityHrsPerPeriod,
      loadHours: new Array(n).fill(0),
      utilization: new Array(n).fill(0),
      overloaded: new Array(n).fill(false),
    };
  }

  // Sum load hours from all family plans (hybrid strategy)
  for (const [, fp] of plantData.familyPlans) {
    const hybrid = fp.plan.strategies.hybrid;
    if (!hybrid?.rccp) continue;

    for (const wcData of hybrid.rccp) {
      const agg = aggregated[wcData.code];
      if (!agg) continue;
      for (let i = 0; i < n; i++) {
        agg.loadHours[i] += wcData.loadHours[i] || 0;
      }
    }
  }

  // Recalculate utilization and overload flags
  for (const wc of Object.values(aggregated)) {
    for (let i = 0; i < n; i++) {
      const util = wc.capacityHoursPerPeriod > 0
        ? (wc.loadHours[i] / wc.capacityHoursPerPeriod) * 100
        : 0;
      wc.utilization[i] = Math.round(util * 100) / 100;
      wc.overloaded[i] = util > 100;
      wc.loadHours[i] = Math.round(wc.loadHours[i] * 100) / 100;
    }
  }

  return {
    plantCode,
    plantName: getPlantName(plantCode),
    periods,
    workCenters: Object.values(aggregated),
  };
}

// ── Heuristics ──

export function getHeuristics() {
  return { heuristics: { ..._heuristics } };
}

export function updateHeuristics(updates) {
  const validKeys = ['lotSizing', 'safetyStock', 'timeFence', 'capacityPriority', 'smoothing', 'inventoryTarget'];
  for (const [key, value] of Object.entries(updates)) {
    if (validKeys.includes(key)) {
      _heuristics[key] = value;
    }
  }
  return { success: true, heuristics: { ..._heuristics } };
}
